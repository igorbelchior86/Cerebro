// ─────────────────────────────────────────────────────────────
// Chat Route — Agentic assistant: LLM plans tools → execute → LLM answers
//
// POST /chat  { message: string, history?: {role,content}[] }
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { createLLMProvider, type Message } from '../services/ai/llm-adapter.js';
import { queryOne } from '../db/index.js';
import { ITGlueClient } from '../clients/itglue.js';
import { NinjaOneClient } from '../clients/ninjaone.js';

const router: ExpressRouter = Router();

// ─── Credential helpers ───────────────────────────────────────

async function getStoredCreds<T>(service: string): Promise<T | null> {
  const row = await queryOne<{ credentials: T }>(
    'SELECT credentials FROM integration_credentials WHERE service = $1',
    [service]
  ).catch(() => null);
  return row?.credentials ?? null;
}

const ITGLUE_BASE: Record<string, string> = {
  us: 'https://api.itglue.com',
  eu: 'https://api.eu.itglue.com',
  au: 'https://api.au.itglue.com',
};

async function getITGlueClient(): Promise<ITGlueClient | null> {
  const creds = await getStoredCreds<{ apiKey: string; region?: string }>('itglue');
  if (!creds?.apiKey) return null;
  return new ITGlueClient({ apiKey: creds.apiKey, baseUrl: ITGLUE_BASE[creds.region ?? 'us'] ?? 'https://api.itglue.com' });
}

const NINJAONE_BASE: Record<string, string> = {
  us: 'https://app.ninjarmm.com',
  eu: 'https://eu.ninjarmm.com',
  oc: 'https://oc.ninjarmm.com',
};

async function getNinjaOneClient(): Promise<NinjaOneClient | null> {
  const creds = await getStoredCreds<{ clientId: string; clientSecret: string; region?: string }>('ninjaone');
  if (!creds?.clientId || !creds?.clientSecret) return null;
  return new NinjaOneClient({ clientId: creds.clientId, clientSecret: creds.clientSecret, baseUrl: NINJAONE_BASE[creds.region ?? 'us'] ?? 'https://app.ninjarmm.com' });
}

async function buildIntegrationStatus(): Promise<string> {
  const [at, ninja, itg] = await Promise.all([
    getStoredCreds<{ apiIntegrationCode?: string }>('autotask'),
    getStoredCreds<{ clientId?: string }>('ninjaone'),
    getStoredCreds<{ apiKey?: string; region?: string }>('itglue'),
  ]);
  return [
    '- Autotask PSA: ' + (at?.apiIntegrationCode ? 'configured ✓' : 'not configured ✗'),
    '- NinjaOne RMM: ' + (ninja?.clientId ? 'configured ✓' : 'not configured ✗'),
    '- IT Glue: ' + (itg?.apiKey ? `configured ✓ (region: ${itg.region ?? 'us'})` : 'not configured ✗'),
  ].join('\n');
}

// ─── Tool registry ────────────────────────────────────────────

const TOOLS_DESCRIPTION = `
Tools available (use only what's needed):
IT Glue: itglue_list_orgs{} | itglue_org_info{org_id} | itglue_org_documents{org_id} | itglue_org_configs{org_id} | itglue_org_contacts{org_id} | itglue_org_passwords{org_id} | itglue_search_docs{query,org_id?}
NinjaOne: ninja_list_orgs{} | ninja_org_devices{org_id} | ninja_org_alerts{org_id}
no_tool: no data needed
Note: use company name as org_id if you don't have a numeric ID — the system resolves it automatically.
`.trim();

interface ToolCall { tool: string; params: Record<string, string> }

// ─── Phase 1: LLM decides which tools to call ─────────────────

async function planTools(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  integrationStatus: string
): Promise<ToolCall[]> {

  const llm = createLLMProvider();

  const planPrompt = `You are a tool-calling planner for an IT operations assistant.
Given the conversation and the user's latest message, output ONLY a JSON array of tool calls needed to answer.
Output format: [{"tool": "tool_name", "params": {...}}]
Output ONLY valid JSON — no explanation, no markdown, no extra text.

Integration status:
${integrationStatus}

${TOOLS_DESCRIPTION}

Rules:
- IT Glue and NinjaOne have SEPARATE organization IDs — do not mix them.
- If the user asks about a company, call BOTH IT Glue and NinjaOne tools to give a complete answer (docs + live devices + alerts).
- For org_id params: if you have a numeric ID from history, use it. If not, use the COMPANY NAME as the org_id value — the system resolves names to IDs automatically. NEVER leave org_id empty or use placeholder text like "OrgName ID".
- Call all needed tools in a SINGLE batch — list tools AND detail tools together, using the company name as org_id when you don't have the numeric ID yet.
- If you already have enough info to answer (e.g. status question), use no_tool.
- Never call the same tool twice with the same params.`;

  const messages: Message[] = [
    { role: 'user', content: planPrompt },
    { role: 'assistant', content: 'Understood. I will output only a JSON array.' },
    ...history.slice(-2), // last 1 turn for context
    { role: 'user', content: `User message: "${message}"\n\nOutput the JSON array of tool calls:` },
  ];

  // Planner only needs to emit a small JSON array — cap at 600 tokens
  const response = await llm.complete('', messages, { maxTokens: 600, temperature: 0.0 });
  const raw = response.content.trim();

  // Extract JSON array from response (strip any accidental markdown fences)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [{ tool: 'no_tool', params: {} }];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ToolCall[];
    return Array.isArray(parsed) ? parsed : [{ tool: 'no_tool', params: {} }];
  } catch {
    return [{ tool: 'no_tool', params: {} }];
  }
}

// ─── Phase 2: Execute tool calls ──────────────────────────────

type ToolResult = { tool: string; params: Record<string, string>; data?: unknown; error?: string };

// Resolve org_id: if it's already numeric, return as-is.
// If it's a name/placeholder, fetch org list and fuzzy-match.
async function resolveOrgId(client: ITGlueClient, orgIdOrName: string): Promise<string> {
  if (/^\d+$/.test(orgIdOrName.trim())) return orgIdOrName.trim();
  const orgs = await client.getOrganizations(200);
  const needle = orgIdOrName.toLowerCase().replace(/\s*id\s*$/, '').trim();
  const match = orgs.find(o =>
    o.attributes.name.toLowerCase().includes(needle) ||
    needle.includes(o.attributes.name.toLowerCase())
  );
  if (!match) throw new Error(`Organization not found for: "${orgIdOrName}"`);
  return match.id;
}

async function resolveNinjaOrgId(ninja: NinjaOneClient, orgIdOrName: string): Promise<string> {
  if (/^\d+$/.test(orgIdOrName.trim())) return orgIdOrName.trim();
  const orgs = await ninja.listOrganizations();
  const needle = orgIdOrName.toLowerCase().replace(/\s*id\s*$/, '').trim();
  const match = orgs.find(o =>
    String(o.name).toLowerCase().includes(needle) ||
    needle.includes(String(o.name).toLowerCase())
  );
  if (!match) throw new Error(`NinjaOne organization not found for: "${orgIdOrName}"`);
  return String(match.id);
}

async function executeTools(toolCalls: ToolCall[], userMessage: string): Promise<ToolResult[]> {
  const [itglue, ninja] = await Promise.all([getITGlueClient(), getNinjaOneClient()]);

  // For org-specific tools missing org_id, fall back to resolving by message text
  const ORG_TOOLS = new Set(['itglue_org_info','itglue_org_documents','itglue_org_configs','itglue_org_contacts','itglue_org_passwords','ninja_org_devices','ninja_org_alerts']);
  const resolvedCalls = toolCalls.map(tc =>
    ORG_TOOLS.has(tc.tool) && !tc.params.org_id
      ? { ...tc, params: { ...tc.params, org_id: userMessage } }
      : tc
  );

  return Promise.all(resolvedCalls.map(async ({ tool, params }): Promise<ToolResult> => {
    if (tool === 'no_tool') return { tool, params, data: null };

    try {
      switch (tool) {
        // ── IT Glue tools ─────────────────────────────────────
        case 'itglue_list_orgs': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgs = await itglue.getOrganizations(50);
          return { tool, params, data: orgs.map(o => ({ id: o.id, name: o.attributes.name })) };
        }
        case 'itglue_org_info': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgId = await resolveOrgId(itglue, params.org_id!);
          const org = await itglue.getOrganizationById(orgId);
          const a = org.attributes as Record<string, unknown>;
          return { tool, params, data: { id: org.id, name: a['name'], status: a['organization_status_name'], type: a['organization_type_name'], domain: a['primary_domain'], phone: a['primary_phone'], city: a['city'], state: a['state'], country: a['country'], contacts_count: a['contacts_count'], configurations_count: a['configurations_count'] } };
        }
        case 'itglue_org_documents': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgId = await resolveOrgId(itglue, params.org_id!);
          const docs = await itglue.getOrganizationDocuments(orgId, 15);
          return { tool, params, data: docs.map(d => ({ id: d.id, name: (d as unknown as { attributes: { name: string } }).attributes?.name })) };
        }
        case 'itglue_org_configs': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgId = await resolveOrgId(itglue, params.org_id!);
          const configs = await itglue.getConfigurations(orgId, 15);
          return { tool, params, data: configs.map(c => ({ id: c.id, name: c.attributes.name, type: c.attributes.configuration_type_name, hostname: c.attributes.hostname, ip: c.attributes.primary_ip, os: c.attributes.operating_system_name, active: c.attributes.active })) };
        }
        case 'itglue_org_contacts': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgId = await resolveOrgId(itglue, params.org_id!);
          const contacts = await itglue.getContacts(orgId, 15);
          return { tool, params, data: contacts.map(c => ({ id: c.id, name: c.attributes.name ?? `${c.attributes.first_name ?? ''} ${c.attributes.last_name ?? ''}`.trim(), title: c.attributes.title, email: c.attributes.primary_email, phone: c.attributes.primary_phone })) };
        }
        case 'itglue_org_passwords': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const orgId = await resolveOrgId(itglue, params.org_id!);
          const passwords = await itglue.getPasswords(orgId, 15);
          return { tool, params, data: passwords.map(p => ({ id: p.id, name: p.attributes.name, username: p.attributes.username, url: p.attributes.url })) };
        }
        case 'itglue_search_docs': {
          if (!itglue) return { tool, params, error: 'IT Glue not configured' };
          const docs = await itglue.searchDocuments(params.query!, params.org_id, 10);
          return { tool, params, data: docs.map(d => ({ id: d.id, name: (d as unknown as { attributes: { name: string; organization_name?: string } }).attributes?.name, org: (d as unknown as { attributes: { organization_name?: string } }).attributes?.organization_name })) };
        }
        // ── NinjaOne tools ────────────────────────────────────
        case 'ninja_list_orgs': {
          if (!ninja) return { tool, params, error: 'NinjaOne not configured' };
          const orgs = await ninja.listOrganizations();
          return { tool, params, data: orgs.map(o => ({ id: o.id, name: o.name })) };
        }
        case 'ninja_org_devices': {
          if (!ninja) return { tool, params, error: 'NinjaOne not configured' };
          const orgId = await resolveNinjaOrgId(ninja, params.org_id!);
          const devices = await ninja.listDevicesByOrganization(orgId, { limit: 50 });
          return { tool, params, data: (devices ?? []).map((d) => ({ id: d.id, name: d.systemName ?? d.hostname, os: d.osName, lastContact: d.lastContact ?? d.lastActivityTime, online: d.online, ip: d.ipAddress })) };
        }
        case 'ninja_org_alerts': {
          if (!ninja) return { tool, params, error: 'NinjaOne not configured' };
          const orgId = await resolveNinjaOrgId(ninja, params.org_id!);
          const alerts = await ninja.listAlerts(orgId);
          return { tool, params, data: alerts.map(a => ({ uid: a.uid, severity: a.severity, message: a.message, device: a.deviceName })) };
        }
        default:
          return { tool, params, error: `Unknown tool: ${tool}` };
      }
    } catch (err) {
      return { tool, params, error: (err as Error).message };
    }
  }));
}

// ─── Compact tool result formatter ───────────────────────────

function relTime(unixOrIso: number | string | null | undefined): string {
  if (!unixOrIso) return '';
  const ms = typeof unixOrIso === 'number' ? unixOrIso * 1000 : Date.parse(String(unixOrIso));
  if (isNaN(ms)) return '';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

function formatToolResult(tool: string, data: unknown): string {
  if (data === null || data === undefined) return `[${tool}] No data`;
  const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : null;
  const obj = !arr ? (data as Record<string, unknown>) : null;

  switch (tool) {
    case 'itglue_list_orgs':
    case 'ninja_list_orgs': {
      if (!arr?.length) return `[${tool}] No organizations found`;
      const prefix = tool === 'ninja_list_orgs' ? 'NinjaOne' : 'IT Glue';
      const lines = arr.map(o => `  • ${o['name']} (ID: ${o['id']})`);
      return `[${prefix} Orgs] (${arr.length})\n${lines.join('\n')}`;
    }
    case 'itglue_org_info': {
      if (!obj) return '[IT Glue Org] No data';
      const parts = [`[IT Glue Org] ${obj['name']} (ID: ${obj['id']})`];
      if (obj['type']) parts.push(`Type: ${obj['type']}`);
      if (obj['status']) parts.push(`Status: ${obj['status']}`);
      if (obj['domain']) parts.push(`Domain: ${obj['domain']}`);
      if (obj['city'] || obj['state']) parts.push(`Location: ${[obj['city'], obj['state']].filter(Boolean).join(', ')}`);
      if (obj['contacts_count']) parts.push(`Contacts: ${obj['contacts_count']}`);
      if (obj['configurations_count']) parts.push(`Configs: ${obj['configurations_count']}`);
      return parts.join(' | ');
    }
    case 'itglue_org_configs': {
      if (!arr?.length) return '[IT Glue Configs] None found';
      const lines = arr.map(c => {
        const type = c['type'] ? ` [${c['type']}]` : '';
        const host = c['hostname'] ? ` | ${c['hostname']}` : '';
        const ip = c['ip'] ? ` | ${c['ip']}` : '';
        const os = c['os'] ? ` | ${c['os']}` : '';
        const active = c['active'] === false ? ' | INACTIVE' : '';
        return `  • ${c['name']}${type}${host}${ip}${os}${active}`;
      });
      return `[IT Glue Configs] (${arr.length})\n${lines.join('\n')}`;
    }
    case 'itglue_org_contacts': {
      if (!arr?.length) return '[IT Glue Contacts] None found';
      const lines = arr.map(c => {
        const title = c['title'] ? ` | ${c['title']}` : '';
        const email = c['email'] ? ` | ${c['email']}` : '';
        const phone = c['phone'] ? ` | ${c['phone']}` : '';
        return `  • ${c['name']}${title}${email}${phone}`;
      });
      return `[IT Glue Contacts] (${arr.length})\n${lines.join('\n')}`;
    }
    case 'itglue_org_passwords': {
      if (!arr?.length) return '[IT Glue Passwords] None found';
      const lines = arr.map(p => {
        const user = p['username'] ? ` | user: ${p['username']}` : '';
        const url = p['url'] ? ` | ${p['url']}` : '';
        return `  • ${p['name']}${user}${url}`;
      });
      return `[IT Glue Passwords] (${arr.length})\n${lines.join('\n')}`;
    }
    case 'itglue_org_documents':
    case 'itglue_search_docs': {
      if (!arr?.length) return '[IT Glue Docs] None found';
      const label = tool === 'itglue_search_docs' ? 'IT Glue Search Results' : 'IT Glue Docs';
      const lines = arr.map(d => {
        const org = d['org'] ? ` (${d['org']})` : '';
        return `  • ${d['name']}${org}`;
      });
      return `[${label}] (${arr.length})\n${lines.join('\n')}`;
    }
    case 'ninja_org_devices': {
      if (!arr?.length) return '[NinjaOne Devices] None found';
      const offline = arr.filter(d => d['online'] === false || d['online'] === undefined).length;
      const lines = arr.map(d => {
        const status = d['online'] === false ? 'OFFLINE' : d['online'] === true ? 'online' : 'unknown';
        const last = d['lastContact'] ? ` | last: ${relTime(d['lastContact'] as string | number)}` : '';
        const ip = d['ip'] ? ` | ${d['ip']}` : '';
        const os = d['os'] ? ` | ${d['os']}` : '';
        return `  • ${d['name'] ?? `ID:${d['id']}`} | ${status}${last}${ip}${os}`;
      });
      const offTag = offline > 0 ? ` ⚠ ${offline} OFFLINE` : '';
      return `[NinjaOne Devices] (${arr.length}${offTag})\n${lines.join('\n')}`;
    }
    case 'ninja_org_alerts': {
      if (!arr?.length) return '[NinjaOne Alerts] None';
      const lines = arr.map(a => {
        const sev = String(a['severity'] ?? '').toUpperCase();
        const icon = sev === 'CRITICAL' ? '🔴' : sev === 'WARNING' ? '🟡' : '🔵';
        const dev = a['device'] ? ` [${a['device']}]` : '';
        return `  ${icon}${dev} ${String(a['message'] ?? '').slice(0, 120)}`;
      });
      return `[NinjaOne Alerts] (${arr.length})\n${lines.join('\n')}`;
    }
    default:
      return `[${tool}] ${JSON.stringify(data).slice(0, 500)}`;
  }
}

// ─── System + answer prompt ───────────────────────────────────

const ANSWER_SYSTEM = `You are Cerebro, an intelligent IT operations assistant for MSP engineers.

RULES:
1. Respond in the same language the user writes in (Portuguese pt-BR if they write in Portuguese).
2. Real-time data from integrations is injected below — use it directly. NEVER say you cannot access data.
3. When data comes from BOTH IT Glue and NinjaOne, combine them into a unified answer. Make clear which source each piece of data comes from.
4. FORMAT RULE — CRITICAL: Each list item MUST fit on ONE single line. Use the bullet format already present in the data. NEVER split a single record across multiple lines. NEVER add sub-bullets like "ID:", "Nome:", "Username:" on separate lines. Correct: "• Microsoft 365 Admin | user: foo@bar.com | https://…". Wrong: separating ID / Nome / Username / URL onto different lines.
5. If a tool result shows no results, say so clearly.
6. Be concise and direct. No unnecessary suggestions like "access the portal".
7. Never hallucinate values — use only what's in the injected data.`;

// ─── POST /chat ───────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body as {
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const integrationStatus = await buildIntegrationStatus();

    // Phase 1: plan which tools to call
    const toolCalls = await planTools(message.trim(), history, integrationStatus);

    // Phase 2: execute tools in parallel
    const results = await executeTools(toolCalls, message.trim());

    // Build context block
    const contextParts: string[] = ['\n\n--- LIVE DATA ---', `Integration status:\n${integrationStatus}`];

    for (const r of results) {
      if (r.tool === 'no_tool') continue;
      if (r.error) {
        contextParts.push(`\n[${r.tool}] ERROR: ${r.error}`);
      } else {
        contextParts.push('\n' + formatToolResult(r.tool, r.data));
      }
    }
    contextParts.push('--- END DATA ---');

    // Phase 3: answer with real data
    const answerMessages: Message[] = [
      { role: 'user', content: ANSWER_SYSTEM + contextParts.join('\n') },
      { role: 'assistant', content: 'Entendido. Tenho os dados em tempo real. Pode perguntar.' },
      ...history.slice(-2),
      { role: 'user', content: message.trim() },
    ];

    const llm = createLLMProvider();
    const response = await llm.complete('', answerMessages, { maxTokens: 1500 });

    res.json({
      success: true,
      reply: response.content,
      toolsUsed: toolCalls.filter(t => t.tool !== 'no_tool').map(t => `${t.tool}(${JSON.stringify(t.params)})`),
      usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Unknown error' });
  }
});

export default router;
