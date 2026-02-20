// ─────────────────────────────────────────────────────────────
// PrepareContext Service — Orquestra coleta de dados
// ─────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type {
  EvidencePack,
  Signal,
  RelatedCase,
  Doc,
  ExternalStatus,
} from '@playbook-brain/types';
import { AutotaskClient } from '../clients/autotask.js';
import { NinjaOneClient } from '../clients/ninjaone.js';
import { ITGlueClient } from '../clients/itglue.js';
import { query, queryOne, execute } from '../db/index.js';
import { emailParser } from './email/email-parser.js';

interface PrepareContextInput {
  sessionId: string;
  ticketId: string;
  orgId?: string;
  organizationIds?: {
    autotask?: string;
    ninjaone?: string;
    itglue?: string;
  };
}

interface SourceFinding {
  source: 'autotask' | 'ninjaone' | 'itglue' | 'external';
  round?: number;
  queried: boolean;
  matched: boolean;
  summary: string;
  details: string[];
}

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

interface NinjaOneCreds {
  clientId: string;
  clientSecret: string;
  region?: 'us' | 'eu' | 'oc';
}

interface ITGlueCreds {
  apiKey: string;
  region?: 'us' | 'eu' | 'au';
}

const NINJAONE_BASE: Record<string, string> = {
  us: 'https://app.ninjarmm.com',
  eu: 'https://eu.ninjarmm.com',
  oc: 'https://oc.ninjarmm.com',
};

const ITGLUE_BASE: Record<string, string> = {
  us: 'https://api.itglue.com',
  eu: 'https://api.eu.itglue.com',
  au: 'https://api.au.itglue.com',
};

export class PrepareContextService {
  constructor() {}

  private hasCompanyColumnCache: boolean | null = null;

  private async getSessionTenantId(sessionId: string): Promise<string | null> {
    const row = await queryOne<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM triage_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );
    return row?.tenant_id || null;
  }

  private async getIntegrationCredentials<T>(
    service: 'autotask' | 'ninjaone' | 'itglue',
    tenantId?: string | null
  ): Promise<T | null> {
    try {
      if (tenantId) {
        const tenantScoped = await queryOne<{ credentials: T }>(
          `SELECT credentials
           FROM integration_credentials
           WHERE tenant_id = $1 AND service = $2
           LIMIT 1`,
          [tenantId, service]
        );
        if (tenantScoped?.credentials) return tenantScoped.credentials;
      }

      const latest = await queryOne<{ credentials: T }>(
        `SELECT credentials
         FROM integration_credentials
         WHERE service = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [service]
      );
      return latest?.credentials ?? null;
    } catch {
      return null;
    }
  }

  private buildAutotaskClient(creds: AutotaskCreds | null): AutotaskClient {
    const apiIntegrationCode =
      creds?.apiIntegrationCode ||
      process.env.AUTOTASK_API_INTEGRATION_CODE ||
      process.env.AUTOTASK_API_INTEGRATIONCODE ||
      '';
    const username =
      creds?.username ||
      process.env.AUTOTASK_USERNAME ||
      process.env.AUTOTASK_API_USER ||
      '';
    const secret =
      creds?.secret ||
      process.env.AUTOTASK_SECRET ||
      process.env.AUTOTASK_API_SECRET ||
      '';
    const zoneUrl = creds?.zoneUrl || process.env.AUTOTASK_ZONE_URL || undefined;

    return new AutotaskClient({
      apiIntegrationCode,
      username,
      secret,
      ...(zoneUrl ? { zoneUrl } : {}),
    });
  }

  private buildNinjaClient(creds: NinjaOneCreds | null): NinjaOneClient {
    const clientId = creds?.clientId || process.env.NINJAONE_CLIENT_ID || '';
    const clientSecret = creds?.clientSecret || process.env.NINJAONE_CLIENT_SECRET || '';
    const region: 'us' | 'eu' | 'oc' = creds?.region ?? 'us';
    const baseUrl = NINJAONE_BASE[region];
    return new NinjaOneClient({
      clientId,
      clientSecret,
      ...(baseUrl ? { baseUrl } : {}),
    });
  }

  private buildITGlueClient(creds: ITGlueCreds | null): ITGlueClient {
    const apiKey = creds?.apiKey || process.env.ITGLUE_API_KEY || '';
    const region: 'us' | 'eu' | 'au' = creds?.region ?? 'us';
    const baseUrl = ITGLUE_BASE[region];
    return new ITGlueClient({
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    });
  }

  private async resolveClientsForSession(sessionId: string): Promise<{
    autotaskClient: AutotaskClient;
    ninjaoneClient: NinjaOneClient;
    itglueClient: ITGlueClient;
    credentialScope: 'tenant' | 'workspace_fallback';
  }> {
    const tenantId = await this.getSessionTenantId(sessionId);
    const [autotaskCreds, ninjaCreds, itglueCreds] = await Promise.all([
      this.getIntegrationCredentials<AutotaskCreds>('autotask', tenantId),
      this.getIntegrationCredentials<NinjaOneCreds>('ninjaone', tenantId),
      this.getIntegrationCredentials<ITGlueCreds>('itglue', tenantId),
    ]);

    return {
      autotaskClient: this.buildAutotaskClient(autotaskCreds),
      ninjaoneClient: this.buildNinjaClient(ninjaCreds),
      itglueClient: this.buildITGlueClient(itglueCreds),
      credentialScope: tenantId ? 'tenant' : 'workspace_fallback',
    };
  }

  private async hasCompanyColumn(): Promise<boolean> {
    if (this.hasCompanyColumnCache !== null) return this.hasCompanyColumnCache;
    const rows = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'tickets_processed'
           AND column_name = 'company'
       ) AS exists`
    );
    this.hasCompanyColumnCache = Boolean(rows[0]?.exists);
    return this.hasCompanyColumnCache;
  }

  /**
   * Principal: Coleta dados de múltiplas fontes e monta EvidencePack
   */
  async prepare(input: PrepareContextInput): Promise<EvidencePack> {
    console.log(`[PrepareContext] Starting for ticket ${input.ticketId}`);

    const startTime = Date.now();
    const missingData: Array<{ field: string; why: string }> = [];
    const { autotaskClient, ninjaoneClient, itglueClient, credentialScope } =
      await this.resolveClientsForSession(input.sessionId);

    // ─── Coleta de Dados (Autotask ou Email Ingestion) ───────────
    let ticket: any = null;
    let signals: Signal[] = [];

    // Check if it's an email-ingested ticket (starts with T)
    const isEmailTicket = input.ticketId.startsWith('T');

    if (isEmailTicket) {
      console.log(`[PrepareContext] Detected email-ingested ticket: ${input.ticketId}`);
      try {
        const includeCompany = await this.hasCompanyColumn();
        const emailTicket = await queryOne<any>(
          `SELECT id, title, description, ${includeCompany ? 'company' : `''::text as company`}, requester, status, updates, created_at 
           FROM tickets_processed WHERE id = $1`,
          [input.ticketId]
        );

        if (emailTicket) {
          ticket = {
            id: emailTicket.id,
            ticketNumber: emailTicket.id,
            title: emailTicket.title,
            description: emailTicket.description,
            company: emailTicket.company || '',
            requester: emailTicket.requester || '',
            createDate: emailTicket.created_at,
            priority: 3, // Default normal
            queueName: 'Email Ingestion',
          };
          console.log(`[PrepareContext] Successfully fetched email ticket data from DB`);

          // Process signals from updates
          const updates = emailTicket.updates || [];
          signals = updates.map((update: any, idx: number) => ({
            id: `email-update-${idx}`,
            source: 'email' as const,
            timestamp: update.timestamp,
            type: 'ticket_note',
            summary: update.content?.substring(0, 200) || '',
            raw_ref: update,
          }));
        } else {
          console.warn(`[PrepareContext] Email ticket ${input.ticketId} not found in tickets_processed. Trying raw fallback...`);
          const raw = await queryOne<any>(
            `SELECT email_data
             FROM tickets_raw
             WHERE (email_data->>'subject') ILIKE '%' || $1 || '%'
                OR (email_data->'body'->>'content') ILIKE '%' || $1 || '%'
             ORDER BY ingested_at DESC
             LIMIT 1`,
            [input.ticketId]
          );
          if (raw?.email_data) {
            const parsed = emailParser.parseEmail(
              String(raw.email_data.subject || ''),
              String(raw.email_data?.body?.content || ''),
              String(raw.email_data.receivedDateTime || '')
            );
            if (parsed) {
              ticket = {
                id: parsed.id,
                ticketNumber: parsed.id,
                title: parsed.title,
                description: parsed.description,
                company: parsed.company || '',
                requester: parsed.requester || '',
                createDate: parsed.createdAt,
                priority: 3,
                queueName: 'Email Ingestion',
              };
              console.log(`[PrepareContext] Raw fallback succeeded for ${input.ticketId}`);
            }
          }
        }
      } catch (err) {
        console.error(`[PrepareContext] Error fetching email ticket:`, err);
      }
    } else {
      // Original Autotask Flow
      try {
        const ticketIdNum = parseInt(input.ticketId, 10);
        if (isNaN(ticketIdNum)) {
          throw new Error(`Invalid numeric ticket ID: ${input.ticketId}`);
        }
        ticket = await autotaskClient.getTicket(ticketIdNum);
        console.log(`[PrepareContext] Got Autotask ticket ${input.ticketId}`);

        // Coleta notas (signals)
        const notes = await autotaskClient.getTicketNotes(ticketIdNum);
        signals = notes.map((note, idx) => ({
          id: `autotask-note-${idx}`,
          source: 'autotask' as const,
          timestamp: note.createDate,
          type: 'ticket_note',
          summary: note.noteText?.substring(0, 200) || '',
          raw_ref: note,
        }));
      } catch (error) {
        missingData.push({
          field: 'autotask_ticket',
          why: `Failed to fetch Autotask ticket: ${(error as Error).message}`,
        });
      }
    }

    if (!ticket) {
      throw new Error(`Cannot prepare context without valid ticket from Autotask or Database`);
    }

    const companyName = this.normalizeName(ticket.company || '');
    const requesterName = this.normalizeName(ticket.requester || '');
    const sourceFindings: SourceFinding[] = [];

    // round state
    let relatedCases: RelatedCase[] = [];
    let docs: Doc[] = [];
    let device: any = null;
    let loggedInUser = '';
    let ninjaChecks: Signal[] = [];
    let ninjaOrgMatch: { id: number; name: string } | null = null;
    let ninjaOrgDevices: any[] = [];
    let ninjaAlerts: any[] = [];
    let itglueOrgMatch: { id: string; name: string } | null = null;
    let itglueConfigs: any[] = [];
    let itglueContacts: any[] = [];

    // ROUND 1: AT/Intake -> IT Glue
    try {
      if (companyName) {
        itglueOrgMatch = await this.resolveITGlueOrg(
          itglueClient,
          companyName,
          `${ticket.title || ''}\n${ticket.description || ''}\n${ticket.requester || ''}`
        );
      }

      let runbooks: any[] = [];
      let runbooksEndpointUnavailable = false;
      try {
        runbooks = itglueOrgMatch
          ? await itglueClient.getRunbooks(itglueOrgMatch.id)
          : await itglueClient.getRunbooks();
      } catch (err) {
        const msg = String((err as Error)?.message || '').toLowerCase();
        if (msg.includes('404')) {
          runbooksEndpointUnavailable = true;
          runbooks = [];
        } else {
          throw err;
        }
      }

      if (itglueOrgMatch) {
        [itglueConfigs, itglueContacts] = await Promise.all([
          itglueClient.getConfigurations(itglueOrgMatch.id).catch(() => []),
          itglueClient.getContacts(itglueOrgMatch.id).catch(() => []),
        ]);
      }

      docs = runbooks.slice(0, 5).map((doc, idx) => ({
        id: doc.id,
        source: 'itglue' as const,
        title: doc.name,
        snippet: doc.body?.substring(0, 500) || '',
        relevance: 0.5 - idx * 0.05,
        raw_ref: doc as unknown as Record<string, unknown>,
      }));

      sourceFindings.push({
        source: 'itglue',
        round: 1,
        queried: true,
        matched: Boolean(itglueOrgMatch || docs.length || itglueConfigs.length || itglueContacts.length),
        summary: docs.length > 0
          ? `organization context loaded with ${docs.length} runbook/document(s)`
          : runbooksEndpointUnavailable
            ? 'runbooks endpoint unavailable; using org/config/contact context'
            : 'organization context had no runbook/document',
        details: [
          itglueOrgMatch ? `org match: ${itglueOrgMatch.name} (${itglueOrgMatch.id})` : 'org match: none',
          `configs: ${itglueConfigs.length}`,
          `contacts: ${itglueContacts.length}`,
          runbooksEndpointUnavailable ? 'runbooks endpoint: unavailable (404)' : `runbooks: ${docs.length}`,
          `credential scope: ${credentialScope}`,
        ],
      });
    } catch (error) {
      missingData.push({
        field: 'itglue_docs',
        why: `Failed to fetch IT Glue docs: ${(error as Error).message}`,
      });
      sourceFindings.push({
        source: 'itglue',
        round: 1,
        queried: true,
        matched: false,
        summary: 'organization context query failed',
        details: [`error: ${(error as Error).message}`],
      });
    }

    // ROUND 1: ... -> Ninja
    try {
      const orgSeed = companyName || itglueOrgMatch?.name || '';
      if (orgSeed) {
        ninjaOrgMatch = await this.resolveNinjaOrg(ninjaoneClient, orgSeed);
      }
      if (ninjaOrgMatch) {
        [ninjaOrgDevices, ninjaAlerts] = await Promise.all([
          ninjaoneClient.listDevicesByOrganization(String(ninjaOrgMatch.id), { limit: 100 }),
          ninjaoneClient.listAlerts(String(ninjaOrgMatch.id)),
        ]);
      } else {
        ninjaOrgDevices = await ninjaoneClient.listDevices({ limit: 100 });
      }

      const requesterTokens = this.buildRequesterTokens(requesterName);
      const configHints = itglueConfigs
        .map((c: any) => String(c?.attributes?.hostname || c?.attributes?.name || '').toLowerCase())
        .filter(Boolean);

      const requesterMatchedDevices = ninjaOrgDevices.filter((d: any) => {
        const candidate = `${d.hostname || ''} ${d.systemName || ''}`.toLowerCase();
        const requesterMatch = requesterTokens.some((t) => candidate.includes(t));
        const configMatch = configHints.some((h) => h && candidate.includes(h));
        return requesterMatch || configMatch;
      });

      device = requesterMatchedDevices[0] || ninjaOrgDevices[0] || null;
      if (device?.id) {
        const [checks, details] = await Promise.all([
          ninjaoneClient.getDeviceChecks(String(device.id)).catch(() => []),
          ninjaoneClient.getDeviceDetails(String(device.id)).catch(() => null),
        ]);
        ninjaChecks = checks.map((check) => ({
          id: `ninja-check-${check.id}`,
          source: 'ninja' as const,
          timestamp: check.lastCheck,
          type: check.status === 'passed' ? 'health_ok' : 'health_warn',
          summary: `${check.name}: ${check.status}`,
          raw_ref: check,
        }));
        loggedInUser = this.extractLoggedInUser(details) || '';
      }

      sourceFindings.push({
        source: 'ninjaone',
        round: 1,
        queried: true,
        matched: Boolean(device || ninjaOrgMatch || ninjaOrgDevices.length),
        summary: device
          ? `device candidate selected: ${device.hostname || device.systemName || device.id}`
          : 'no device candidate selected',
        details: [
          ninjaOrgMatch ? `org match: ${ninjaOrgMatch.name} (${ninjaOrgMatch.id})` : 'org match: none',
          `devices: ${ninjaOrgDevices.length}`,
          `alerts: ${ninjaAlerts.length}`,
          `health checks: ${ninjaChecks.length}`,
          loggedInUser ? `logged-in user: ${loggedInUser}` : 'logged-in user: not available',
          `credential scope: ${credentialScope}`,
        ],
      });
    } catch (error) {
      missingData.push({
        field: 'ninjaone_device',
        why: `Failed to fetch NinjaOne data: ${(error as Error).message}`,
      });
      sourceFindings.push({
        source: 'ninjaone',
        round: 1,
        queried: true,
        matched: false,
        summary: 'device lookup failed',
        details: [`error: ${(error as Error).message}`],
      });
    }

    // ROUND 2: ... -> AT history with refined terms
    const historyTerms = [
      ticket.title || '',
      ticket.description || '',
      requesterName,
      loggedInUser,
      String(device?.hostname || ''),
      String(device?.systemName || ''),
      ...docs.slice(0, 2).map((d) => d.title || ''),
    ].filter(Boolean);
    relatedCases = await this.findRelatedCasesByTerms(historyTerms, input.orgId);
    sourceFindings.push({
      source: 'autotask',
      round: 2,
      queried: true,
      matched: relatedCases.length > 0,
      summary: relatedCases.length > 0
        ? `historical correlation found ${relatedCases.length} related case(s)`
        : 'historical correlation found no related case',
      details: [`search terms used: ${Math.min(historyTerms.length, 6)}`],
    });

    // ROUND 3: Ninja refinement with logged-in user + IT Glue refinement
    if (ninjaOrgDevices.length > 0 && (requesterName || loggedInUser)) {
      const refinementTokens = this.buildRequesterTokens(loggedInUser || requesterName);
      const refined = ninjaOrgDevices.find((d: any) => {
        const candidate = `${d.hostname || ''} ${d.systemName || ''}`.toLowerCase();
        return refinementTokens.some((t) => candidate.includes(t));
      });
      if (refined && (!device || String(refined.id) !== String(device.id))) {
        device = refined;
        const details = await ninjaoneClient.getDeviceDetails(String(device.id)).catch(() => null);
        if (details) {
          loggedInUser = this.extractLoggedInUser(details) || loggedInUser;
        }
      }
      sourceFindings.push({
        source: 'ninjaone',
        round: 3,
        queried: true,
        matched: Boolean(device),
        summary: device ? `refined device context: ${device.hostname || device.systemName || device.id}` : 'no refined device context',
        details: [loggedInUser ? `logged-in user after refinement: ${loggedInUser}` : 'logged-in user unavailable after refinement'],
      });
    }

    const deviceHost = String(device?.hostname || device?.systemName || '').toLowerCase();
    const refinedConfigs = deviceHost
      ? itglueConfigs.filter((c: any) => {
          const a = c?.attributes || {};
          const value = `${a.hostname || ''} ${a.name || ''}`.toLowerCase();
          return value.includes(deviceHost);
        })
      : [];
    const requesterTokens = this.buildRequesterTokens(loggedInUser || requesterName);
    const refinedContacts = requesterTokens.length
      ? itglueContacts.filter((c: any) => {
          const a = c?.attributes || {};
          const value = `${a.name || ''} ${a.first_name || ''} ${a.last_name || ''} ${a.primary_email || ''}`.toLowerCase();
          return requesterTokens.some((t) => value.includes(t));
        })
      : [];

    sourceFindings.push({
      source: 'itglue',
      round: 3,
      queried: true,
      matched: Boolean(refinedConfigs.length || refinedContacts.length),
      summary: refinedConfigs.length || refinedContacts.length
        ? 'refined org context linked requester/device in IT Glue'
        : 'no additional IT Glue links found in refinement',
      details: [
        `refined configs: ${refinedConfigs.length}`,
        `refined contacts: ${refinedContacts.length}`,
      ],
    });

    // ─── Status de Provedores Externos ───────────────────────────
    // Placeholder: em produção, chamar status page APIs
    const externalStatus: ExternalStatus[] = [];
    sourceFindings.push({
      source: 'external',
      queried: false,
      matched: false,
      summary: 'external status query not executed for this ticket',
      details: ['no external provider adapter configured in current pipeline'],
    });

    sourceFindings.unshift({
      source: 'autotask',
      round: 1,
      queried: true,
      matched: true,
      summary: `ticket intake resolved${companyName ? `, org "${companyName}" identified` : ''}${requesterName ? `, requester "${requesterName}" identified` : ''}`,
      details: [
        `ticket id: ${ticket.ticketNumber || String(ticket.id)}`,
        `related cases: ${relatedCases.length}`,
      ],
    });

    // ─── Monta EvidencePack ──────────────────────────────────────
    const basePackObject = {
      session_id: input.sessionId,
      ticket: {
        id: ticket.ticketNumber || String(ticket.id),
        title: ticket.title || '',
        description: ticket.description || '',
        created_at: ticket.createDate || new Date().toISOString(),
        priority: this.mapAutotaskPriority((ticket as any).priority),
        queue: (ticket as any).queueName || 'Unknown',
        category: 'Support',
      },
      org: {
        id: input.orgId || itglueOrgMatch?.id || (ninjaOrgMatch ? String(ninjaOrgMatch.id) : 'unknown'),
        name: companyName || itglueOrgMatch?.name || ninjaOrgMatch?.name || 'Organization',
      },
      signals: [...signals, ...ninjaChecks],
      related_cases: relatedCases,
      external_status: externalStatus,
      docs: docs,
      source_findings: sourceFindings,
      evidence_rules: {
        require_evidence_for_claims: true,
        no_destructive_steps_without_gating: true,
      },
      prepared_at: new Date().toISOString(),
    };

    const evidencePack: EvidencePack = {
      ...basePackObject,
      ...(device && {
        device: {
          ninja_device_id: device.id,
          hostname: device.hostname,
          os: device.osName,
          last_seen: device.lastActivityTime,
          confidence: 'high' as const,
        },
      }),
      ...(missingData.length > 0 && { missing_data: missingData }),
    } as EvidencePack;

    const duration = Date.now() - startTime;
    console.log(`[PrepareContext] Completed in ${duration}ms`);

    return evidencePack;
  }

  /**
   * Busca casos passados similares no banco
   */
  private async findRelatedCases(ticketTitle: string, orgId?: string): Promise<RelatedCase[]> {
    return this.findRelatedCasesByTerms([ticketTitle], orgId);
  }

  private async findRelatedCasesByTerms(terms: string[], orgId?: string): Promise<RelatedCase[]> {
    try {
      const keyword = this.pickHistoryKeyword(terms);
      const cases = await query<{ ticket_id: string; summary: string; resolution: string; resolved_at: string }>(
        `
        SELECT 
          t.ticket_id,
          array_agg(DISTINCT l.payload->>'summary') as summary,
          array_agg(DISTINCT l.payload->>'content') as resolution,
          max(t.updated_at) as resolved_at
        FROM triage_sessions t
        LEFT JOIN llm_outputs l ON t.id = l.session_id
        WHERE t.status = 'approved' 
        AND (t.ticket_id ILIKE $1 OR l.payload->>'summary' ILIKE $2)
        ${orgId ? 'AND t.org_id = $3' : ''}
        GROUP BY t.ticket_id
        LIMIT 3
        `,
        orgId ? [`%${keyword}%`, `%${keyword}%`, orgId] : [`%${keyword}%`, `%${keyword}%`]
      );

      return cases.map((c) => ({
        ticket_id: c.ticket_id,
        symptom: Array.isArray(c.summary) ? c.summary[0] : String(c.summary),
        resolution: Array.isArray(c.resolution) ? c.resolution[0] : String(c.resolution),
        resolved_at: c.resolved_at,
      }));
    } catch (error) {
      console.log('[PrepareContext] Could not find related cases:', error);
      return [];
    }
  }

  private pickHistoryKeyword(terms: string[]): string {
    const all = terms
      .flatMap((t) => String(t || '').split(/\s+/))
      .map((t) => t.trim())
      .filter((t) => t.length >= 4)
      .slice(0, 50);
    if (all.length === 0) return 'ticket';
    const noise = new Set(['with', 'from', 'that', 'this', 'please', 'ticket', 'setup', 'conference', 'room']);
    const best = all.find((t) => !noise.has(t.toLowerCase()));
    return best || all[0] || 'ticket';
  }

  /**
   * Mapeia prioridade do Autotask para formato padronizado
   */
  private mapAutotaskPriority(
    priority: number | undefined
  ): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (!priority) return 'Medium';
    if (priority === 1) return 'Critical';
    if (priority <= 2) return 'High';
    if (priority <= 3) return 'Medium';
    return 'Low';
  }

  private normalizeName(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  private buildRequesterTokens(value: string): string[] {
    const normalized = this.normalizeName(value).toLowerCase();
    if (!normalized) return [];
    return normalized
      .split(/[\s@._-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .slice(0, 4);
  }

  private extractLoggedInUser(deviceDetails: any): string | null {
    if (!deviceDetails || typeof deviceDetails !== 'object') return null;
    const directKeys = ['loggedInUser', 'currentUser', 'lastLoggedInUser', 'consoleUser', 'username', 'userName'];
    for (const key of directKeys) {
      const value = deviceDetails[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    const props = deviceDetails.properties;
    if (props && typeof props === 'object') {
      for (const [key, value] of Object.entries(props)) {
        if (!/user|login|logon|account/i.test(String(key))) continue;
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
    }
    return null;
  }

  private fuzzyMatch(name: string, candidate: string): boolean {
    const n = this.normalizeName(name).toLowerCase();
    const c = this.normalizeName(candidate).toLowerCase();
    if (!n || !c) return false;
    return c === n || c.includes(n) || n.includes(c);
  }

  private extractEmailDomains(text: string): string[] {
    const source = String(text || '').toLowerCase();
    const matches = source.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g) || [];
    const domains = matches
      .map((m) => m.split('@')[1] || '')
      .map((d) => d.trim())
      .filter(Boolean);
    return [...new Set(domains)].slice(0, 3);
  }

  private async resolveNinjaOrg(
    ninjaoneClient: NinjaOneClient,
    companyName: string
  ): Promise<{ id: number; name: string } | null> {
    const orgs = await ninjaoneClient.listOrganizations();
    const found = orgs.find((o: any) => this.fuzzyMatch(companyName, String(o?.name || '')));
    return found ? { id: Number(found.id), name: String(found.name) } : null;
  }

  private async resolveITGlueOrg(
    itglueClient: ITGlueClient,
    companyName: string,
    hintText?: string
  ): Promise<{ id: string; name: string } | null> {
    const orgs = await itglueClient.getOrganizations();
    const byName = orgs.find((o: any) => this.fuzzyMatch(companyName, String(o?.attributes?.name || '')));
    if (byName) {
      return { id: String(byName.id), name: String(byName.attributes?.name || companyName) };
    }

    const domains = this.extractEmailDomains(hintText || '');
    if (domains.length === 0) return null;

    const byDomain = orgs.find((o: any) => {
      const primaryDomain = String(o?.attributes?.primary_domain || '').toLowerCase();
      return primaryDomain && domains.some((d) => d === primaryDomain || d.endsWith(`.${primaryDomain}`) || primaryDomain.endsWith(`.${d}`));
    });

    return byDomain ? { id: String(byDomain.id), name: String(byDomain.attributes?.name || companyName) } : null;
  }
}

/**
 * Persist EvidencePack ao banco
 */
export async function persistEvidencePack(sessionId: string, pack: EvidencePack): Promise<void> {
  try {
    // Check if it exists first because we don't have a unique constraint on session_id
    const existing = await queryOne(`SELECT id FROM evidence_packs WHERE session_id = $1`, [sessionId]);

    if (existing) {
      await execute(
        `UPDATE evidence_packs SET payload = $1, created_at = NOW() WHERE session_id = $2`,
        [JSON.stringify(pack), sessionId]
      );
    } else {
      await execute(
        `INSERT INTO evidence_packs (session_id, payload, created_at) VALUES ($1, $2, NOW())`,
        [sessionId, JSON.stringify(pack)]
      );
    }
    console.log(`[DB] Persisted EvidencePack for session ${sessionId}`);
  } catch (error) {
    console.error('[DB] Failed to persist EvidencePack:', error);
    throw error;
  }
}

/**
 * Recupera EvidencePack do banco
 */
export async function getEvidencePack(sessionId: string): Promise<EvidencePack | null> {
  try {
    const result = await queryOne<{ payload: EvidencePack }>(
      `SELECT payload FROM evidence_packs WHERE session_id = $1`,
      [sessionId]
    );
    return result?.payload || null;
  } catch (error) {
    console.error('[DB] Failed to retrieve EvidencePack:', error);
    return null;
  }
}
