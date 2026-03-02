// ─────────────────────────────────────────────────────────────
// Ticket Normalizer
// Parsing, normalizing, and standardizing ticket values, devices,
// organizations, and identities.
// ─────────────────────────────────────────────────────────────
import { isPublicIPv4 } from './prepare-context-helpers.js';
import {
  extractJsonObject,
  buildTicketNarrative,
  normalizeName,
  itgAttr,
  normalizeSimpleToken,
  generateNameAliases,
  extractSoftwareHintsFromTicket,
  flattenEnrichmentFields,
  getEnrichmentFieldByPath,
  setEnrichmentFieldByPath,
  buildField,
  postProcessUiTicketText,
  guardTicketUiRoleAssignment,
  extractFirstEmail,
  postProcessCanonicalTicketText,
  postProcessDisplayMarkdownTicketText,
  normalizeDisplayTextForVerbatimGuard,
  stripMarkdownForDisplayGuard,
  resolveNinjaOrg as resolveNinjaOrgHelper,
  extractLoggedInUser as extractLoggedInUserHelper,
  extractITGlueWanCandidate as extractITGlueWanCandidateHelper,
  inferIspName as inferIspNameHelper,
  extractITGlueInfraCandidates as extractITGlueInfraCandidatesHelper,
  extractInfraMakeModel as extractInfraMakeModelHelper,
  normalizeTicketDeterministically,
} from './prepare-context-helpers.js';
import { callLLM } from '../ai/llm-adapter.js';
import type {
  IterativeEnrichmentSections,
  TicketLike,
  Signal,
  ScopeMeta,
  TicketContextAppendix,
  ItglueEnrichedPayload,
  NinjaEnrichedPayload,
  DeviceResolutionResult,
  Doc,
  ITGlueWanCandidate,
  ITGlueInfraCandidate
} from './prepare-context.types.js';
// Quick local stub for NinjaOneClient if not otherwise imported
type NinjaOneClient = any;

export function mapAutotaskPriority(
  priority: number | undefined
): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (!priority) return 'Medium';
  if (priority === 1) return 'Critical';
  if (priority <= 2) return 'High';
  if (priority <= 3) return 'Medium';
  return 'Low';
}

export async function resolveNinjaOrg(
  ninjaoneClient: NinjaOneClient,
  companyName: string
): Promise<{ id: number; name: string } | null> {
  return resolveNinjaOrgHelper(ninjaoneClient, companyName);
}

export function extractLoggedInUser(deviceDetails: any): string | null {
  return extractLoggedInUserHelper(deviceDetails);
}

export function extractITGlueWanCandidate(input: {
  ticketNarrative: string;
  itglueAssets: any[];
  itglueConfigs: any[];
  docs: Doc[];
}): ITGlueWanCandidate | null {
  return extractITGlueWanCandidateHelper(input);
}

export function inferIspName(input: {
  ticketNarrative: string;
  docs: Doc[];
  itglueConfigs: any[];
}): string {
  return inferIspNameHelper(input);
}

export function extractITGlueInfraCandidates(input: {
  itgluePasswords: any[];
  itglueConfigs: any[];
  itglueAssets: any[];
  docs: Doc[];
}) {
  return extractITGlueInfraCandidatesHelper(input);
}

export function extractInfraMakeModel(
  kind: 'firewall' | 'wifi' | 'switch',
  configs: any[],
  docs: Doc[]
) {
  return extractInfraMakeModelHelper(kind, configs, docs);
}

export function parseMakeModel(value: string): { vendor: string; model: string } | null {
  const normalized = normalizeName(String(value || ''));
  if (!normalized || normalized.toLowerCase() === 'unknown') return null;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return {
    vendor: parts[0] || normalized,
    model: parts.slice(1).join(' '),
  };
}

export function rankITGlueDocsForTicket(ticketNarrative: string, docs: Doc[]): Doc[] {
  const terms = [...new Set(
    String(ticketNarrative || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4)
      .slice(0, 24)
  )];
  if (terms.length === 0 || docs.length <= 1) return docs;

  return [...docs].sort((a, b) => {
    const aText = `${a.title || ''} ${a.snippet || ''}`.toLowerCase();
    const bText = `${b.title || ''} ${b.snippet || ''}`.toLowerCase();
    const score = (text: string) =>
      terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    return score(bText) - score(aText);
  });
}

export function normalizeFusionResolutionValue(path: string, value: unknown): string {
  if (value === null || value === undefined) return 'unknown';
  const raw = typeof value === 'string' ? value : String(value);
  const trimmed = normalizeName(raw).trim();
  if (!trimmed) return 'unknown';

  const lowered = trimmed.toLowerCase();
  if (isFusionUnknownValue(lowered)) return 'unknown';
  if (path.includes('email') || path.includes('principal_name')) return lowered;
  if (['identity.account_status', 'identity.mfa_state', 'endpoint.device_type', 'network.vpn_state', 'network.location_context'].includes(path)) {
    return lowered;
  }
  return trimmed;
}

export function isFusionUnknownValue(value: unknown): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '' || ['unknown', 'n/a', 'na', 'none', 'null', 'undefined'].includes(normalized);
}


export async function normalizeTicketForPipeline(ticket: TicketLike): Promise<{
  title: string;
  descriptionCanonical: string;
  descriptionUi: string;
  descriptionDisplayMarkdown: string;
  descriptionDisplayFormat: 'plain' | 'markdown_llm';
  requesterName: string;
  requesterEmail: string;
  affectedUserName: string;
  affectedUserEmail: string;
  organizationHint: string;
  deviceHints: string[];
  symptoms: string[];
  technologyFacets: string[];
  method: 'llm' | 'deterministic_fallback';
  confidence: number;
}> {
  const narrative = buildTicketNarrative(ticket);
  const fallback = normalizeTicketDeterministically(ticket.title || '', narrative);

  try {
    const prompt = `Normalize this IT support ticket text and return ONLY valid JSON.

Rules:
1. description_canonical: Keep the original text and intent, but remove signatures, legal disclaimers, external portal boilerplate, and phishing warnings. This field should be plain text suitable for downstream pipeline parsing.
2. description_ui: Reinterpret and radically simplify the ticket for the technician UI. Focus EXCLUSIVELY on "what the user wants" or "what is broken". Be direct and concise.
3. Preserve concrete facts: people, emails, phones, device models/serials, organization hints.
4. DO NOT confuse requester and affected user. If requester is asking on behalf of a different/new employee and the affected employee name is not explicitly stated, keep the affected employee unnamed (e.g., "new employee (name not provided)").
5. Keep output concise and factual.

Output JSON schema:
{
"title": "string",
"description_canonical": "string",
"description_ui": "string",
"requester_name": "string",
"requester_email": "string",
"affected_user_name": "string",
"affected_user_email": "string",
"organization_hint": "string",
"device_hints": ["string"],
"symptoms": ["string"],
"technology_facets": ["string"],
"confidence": 0.0
}

Ticket text:
"""${narrative.slice(0, 12000)}"""`;

    const llm = await callLLM(prompt);
    const parsed = extractJsonObject(llm.content);
    const title = String(parsed?.title || '').trim();
    const descriptionCanonical = postProcessCanonicalTicketText(String(parsed?.description_canonical || ''));
    let descriptionUi = postProcessUiTicketText(String(parsed?.description_ui || ''));
    const requesterName = normalizeName(String(parsed?.requester_name || '').trim());
    const requesterEmail = String(parsed?.requester_email || '').trim().toLowerCase();
    const affectedUserName = normalizeName(String(parsed?.affected_user_name || '').trim());
    const affectedUserEmail = String(parsed?.affected_user_email || '').trim().toLowerCase();
    const organizationHint = String(parsed?.organization_hint || '').trim();
    const deviceHints = Array.isArray(parsed?.device_hints) ? parsed.device_hints.map(String) : [];
    const symptoms = Array.isArray(parsed?.symptoms) ? parsed.symptoms.map(String) : [];
    const technologyFacets = Array.isArray(parsed?.technology_facets) ? parsed.technology_facets.map(String) : [];
    const confidenceRaw = Number(parsed?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.75;

    descriptionUi = guardTicketUiRoleAssignment({
      descriptionUi,
      requesterName,
      ticketRequester: ticket.requester || '',
      canonicalText: descriptionCanonical || fallback.descriptionClean,
      narrative,
    });

    const canonicalRequesterEmail = requesterEmail || extractFirstEmail(ticket.requester || '') || extractFirstEmail(narrative) || '';
    const canonicalRequesterName = requesterName || normalizeName(ticket.requester || '') || '';
    const canonicalAffectedName = affectedUserName || canonicalRequesterName || '';
    const canonicalAffectedEmail = affectedUserEmail || canonicalRequesterEmail || '';
    const canonicalDisplayText = descriptionCanonical || postProcessCanonicalTicketText(fallback.descriptionClean);

    let descriptionDisplayMarkdown = '';
    const strictFormat = await formatDisplayMarkdownVerbatimWithLLM(canonicalDisplayText).catch(() => '');
    if (isDisplayMarkdownVerbatimEnough(canonicalDisplayText, strictFormat)) {
      descriptionDisplayMarkdown = strictFormat;
    }

    return {
      title: title || fallback.title,
      descriptionCanonical: canonicalDisplayText,
      descriptionUi:
        descriptionUi ||
        guardTicketUiRoleAssignment({
          descriptionUi: postProcessUiTicketText(fallback.descriptionClean),
          requesterName: canonicalRequesterName,
          ticketRequester: ticket.requester || '',
          canonicalText: descriptionCanonical || fallback.descriptionClean,
          narrative,
        }),
      descriptionDisplayMarkdown:
        descriptionDisplayMarkdown ||
        canonicalDisplayText,
      descriptionDisplayFormat: descriptionDisplayMarkdown ? 'markdown_llm' : 'plain',
      requesterName: canonicalRequesterName,
      requesterEmail: canonicalRequesterEmail,
      affectedUserName: canonicalAffectedName,
      affectedUserEmail: canonicalAffectedEmail,
      organizationHint,
      deviceHints,
      symptoms,
      technologyFacets,
      method: 'llm',
      confidence,
    };
  } catch {
    return {
      ...fallback,
      descriptionCanonical: postProcessCanonicalTicketText(fallback.descriptionClean),
      descriptionUi: guardTicketUiRoleAssignment({
        descriptionUi: postProcessUiTicketText(fallback.descriptionClean),
        requesterName: fallback.requesterName,
        ticketRequester: ticket.requester || '',
        canonicalText: fallback.descriptionClean,
        narrative,
      }),
      descriptionDisplayMarkdown: postProcessCanonicalTicketText(fallback.descriptionClean),
      descriptionDisplayFormat: 'plain',
      organizationHint: '',
      deviceHints: [],
      symptoms: [],
      technologyFacets: [],
      method: 'deterministic_fallback',
      confidence: 0.55,
    };
  }
}

export async function formatDisplayMarkdownVerbatimWithLLM(sourceText: string): Promise<string> {
  const text = String(sourceText || '').trim();
  if (!text) return '';
  const prompt = `Format the following ticket text as Markdown for readability.

CRITICAL RULES (strict):
- Preserve the original wording for the ticket content and signature details.
- Do NOT paraphrase, summarize, reinterpret, rename, or reorder facts.
- You MAY add minimal formatting labels/headings for structure (for example: "Request", "Signature", "Notes") when helpful.
- You MAY add Markdown syntax, whitespace, line breaks, bullets, and tables.
- Keep added labels minimal and generic; do not invent new facts.
- If the text contains a repeated roster/list of people (for example onboarding users: 3 or more person-like entries), prefer a Markdown table instead of plain paragraphs.
- If field extraction is clear, use columns like Name | Employment Type | Device Type (and optionally other obvious columns).
- If field extraction is NOT clear, still use a table (for example Name | Details) and preserve the original wording inside cells.
- Do not drop ambiguous rows; preserve them verbatim in a row/cell.
- Preserve the signature/contact block if present.
- Output Markdown only (no code fences, no explanation).

Text:
"""${text.slice(0, 12000)}"""`;
  const llm = await callLLM(prompt);
  return postProcessDisplayMarkdownTicketText(String(llm.content || ''));
}

export function isDisplayMarkdownVerbatimEnough(sourceText: string, markdownText: string): boolean {
  const source = normalizeDisplayTextForVerbatimGuard(sourceText);
  const rendered = normalizeDisplayTextForVerbatimGuard(stripMarkdownForDisplayGuard(markdownText));
  if (!source || !rendered) return false;

  const sourceTokens = source.split(' ').filter(Boolean);
  const renderedTokens = rendered.split(' ').filter(Boolean);
  if (!sourceTokens.length || !renderedTokens.length) return false;

  if (source === rendered) return true;

  let matched = 0;
  let j = 0;
  for (let i = 0; i < sourceTokens.length && j < renderedTokens.length; i += 1) {
    const token = sourceTokens[i];
    while (j < renderedTokens.length && renderedTokens[j] !== token) j += 1;
    if (j < renderedTokens.length && renderedTokens[j] === token) {
      matched += 1;
      j += 1;
    }
  }

  const coverage = matched / Math.max(1, sourceTokens.length);
  const sourceSet = new Set(sourceTokens);
  const formattingWords = new Set([
    'request', 'requests', 'requester', 'signature', 'contact', 'notes', 'goal', 'priority',
    'users', 'items', 'details', 'name', 'role', 'employment', 'location', 'device',
  ]);
  let novel = 0;
  for (const token of renderedTokens) {
    if (!sourceSet.has(token) && !formattingWords.has(token)) novel += 1;
  }
  const novelRatio = novel / Math.max(1, renderedTokens.length);
  const lengthRatio = rendered.length / Math.max(1, source.length);

  if (sourceTokens.length < 12) {
    return coverage >= 0.9 && novelRatio <= 0.12 && lengthRatio >= 0.75 && lengthRatio <= 1.4;
  }
  return coverage >= 0.9 && novelRatio <= 0.08 && lengthRatio >= 0.7 && lengthRatio <= 1.5;
}

export function inferPhoneProvider(input: {
  ticketText: string;
  docs: Doc[];
  itglueConfigs: any[];
  itgluePasswords: any[];
  signals: Signal[];
}): string | null {
  const sourceText = [
    input.ticketText,
    ...input.docs.map((d) => `${d.title} ${d.snippet}`),
    ...input.itglueConfigs.map((c: any) => JSON.stringify(c?.attributes || {})),
    ...input.itgluePasswords.map((p: any) => JSON.stringify(p?.attributes || {})),
    ...input.signals.map((s) => `${s.source} ${s.type} ${s.summary}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const providerMatchers: Array<{ name: string; pattern: RegExp }> = [
    { name: 'GoTo Connect', pattern: /\bgoto(\s?connect)?\b|\bgotoconnect\b/ },
    { name: 'RingCentral', pattern: /\bring\s?central\b/ },
    { name: '8x8', pattern: /\b8x8\b/ },
    { name: 'Zoom Phone', pattern: /\bzoom\s?phone\b/ },
    { name: 'Microsoft Teams Phone', pattern: /\bteams\s?phone\b|\bmicrosoft\s?teams\b/ },
    { name: 'Vonage', pattern: /\bvonage\b/ },
    { name: 'Dialpad', pattern: /\bdialpad\b/ },
  ];
  const found = providerMatchers.find((m) => m.pattern.test(sourceText));
  return found ? found.name : null;
}

export async function resolveLastLoggedInContext(
  ninjaoneClient: NinjaOneClient,
  deviceId: string
): Promise<{ userName: string; logonTime: string }> {
  const direct = await ninjaoneClient.getDeviceLastLoggedOnUser(deviceId).catch(() => null);
  const directUser = String(direct?.userName || '').trim();
  const directTime = direct?.logonTime ? new Date(direct.logonTime).toISOString() : '';
  if (directUser) return { userName: directUser, logonTime: directTime };

  const report = await ninjaoneClient.listLastLoggedOnUsers({ pageSize: 1000 }).catch(() => null);
  const rows = Array.isArray(report?.results) ? report.results : [];
  const match = rows.find((row: any) => String(row.deviceId) === String(deviceId));
  const reportUser = String(match?.userName || '').trim();
  const reportTime = match?.logonTime ? new Date(match.logonTime).toISOString() : '';
  if (reportUser) return { userName: reportUser, logonTime: reportTime };

  return { userName: '', logonTime: '' };
}

export function resolveDeviceOsLabel(device: any, details: any): string {
  const name = String(device?.osName || details?.osName || details?.os?.name || '').trim();
  const version = String(
    device?.osVersion ||
    details?.osVersion ||
    [details?.os?.buildNumber, details?.os?.releaseId].filter(Boolean).join(' / ') ||
    ''
  ).trim();
  const combined = [name, version].filter(Boolean).join(' ');
  return combined || 'Unknown';
}

export async function buildNinjaContextSignals(input: {
  ninjaoneClient: NinjaOneClient;
  deviceId: string;
  orgId: string | null;
  tenantId: string | null;
  sourceWorkspace: string;
}): Promise<Signal[]> {
  const signals: Signal[] = [];
  const [activities, interfaces, softwareRows] = await Promise.all([
    input.ninjaoneClient.getDeviceActivities(input.deviceId, { pageSize: 30 }).catch(() => []),
    input.ninjaoneClient.getDeviceNetworkInterfaces(input.deviceId).catch(() => []),
    input.ninjaoneClient.querySoftware({ pageSize: 200, df: `deviceId = ${input.deviceId}` }).catch(() => []),
  ]);

  (activities as any[]).forEach((act) => {
    signals.push({
      id: `ninja-act-${act.id}`,
      source: 'ninja',
      timestamp: act.activityTime,
      type: 'device_activity',
      summary: `${act.activityType}: ${act.activityName}`,
      raw_ref: act,
      tenant_id: input.tenantId,
      org_id: input.orgId,
      source_workspace: input.sourceWorkspace,
    });
  });

  (interfaces as any[]).forEach((iface, idx) => {
    if (iface.ipAddress && isPublicIPv4(iface.ipAddress)) {
      signals.push({
        id: `ninja-iface-${idx}`,
        source: 'ninja',
        timestamp: new Date().toISOString(),
        type: 'network_anchor',
        summary: `Public Interface: ${iface.ipAddress} (${iface.adapterName || 'NIC'})`,
        raw_ref: iface,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      });
    }
  });

  const softwareHints = extractSoftwareHintsFromTicket(buildTicketNarrative({} as any)); // Mock ticket for hints
  (softwareRows as any[]).forEach((sw) => {
    const swName = String(sw.name || '').toLowerCase();
    if (softwareHints.some(hint => swName.includes(hint))) {
      signals.push({
        id: `ninja-sw-${sw.id}`,
        source: 'ninja',
        timestamp: new Date().toISOString(),
        type: 'software_inventory',
        summary: `Relevant Software: ${sw.name} ${sw.version || ''}`,
        raw_ref: sw,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      });
    }
  });

  return signals;
}
