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
  SourceFinding,
  EntityResolution,
  EvidenceDigest,
  RejectedEvidence,
  CapabilityVerification,
  DigestAction,
  DigestFact,
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

type TicketLike = {
  id?: string | number;
  ticketNumber?: string;
  title?: string;
  description?: string;
  company?: string;
  requester?: string;
  createDate?: string;
  priority?: number;
  queueName?: string;
};

interface ScopeMeta {
  tenant_id: string | null;
  org_id: string | null;
  source_workspace: string;
}

interface FacetContext {
  symptom: string[];
  technology: string[];
  entities: string[];
  requiresCapabilityVerification: boolean;
}

interface DeviceResolutionResult {
  device: any | null;
  checks: Signal[];
  loggedInUser: string;
  reason: string;
  strongMatch: boolean;
  details?: any | null;
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

const FACET_TERMS = {
  symptom: {
    connection: ['connection', 'internet', 'offline', 'network', 'latency', 'packet loss'],
    telephony: ['phone', 'voip', 'calling', 'extension', 'dial tone', 'gotoconnect', 'goto'],
    vpn: ['vpn', 'tunnel', 'remote access', 'always on'],
    printing: ['printer', 'print', 'spooler', 'toner'],
    hardware: ['laptop', 'monitor', 'dock', 'usb-c', 'thunderbolt', 'displayport', 'hdmi', 'adapter', 'hardware'],
  },
  technology: {
    fortinet: ['fortinet', 'fortigate', 'forticlient'],
    goto: ['goto', 'gotoconnect', 'goto connect', 'gotomeeting'],
    m365: ['m365', 'office 365', 'exchange', 'sharepoint', 'teams', 'entra'],
    vpn: ['vpn', 'forticlient', 'wireguard', 'openvpn'],
  },
};

const CAPABILITY_SPEC_RULES: Array<{
  manufacturer: RegExp;
  modelContains: RegExp;
  spec_source_url: string;
  compatibility_outcome: 'supported' | 'supported_with_dock' | 'not_supported';
}> = [
  {
    manufacturer: /dell/i,
    modelContains: /(latitude|precision|xps)/i,
    spec_source_url: 'https://www.dell.com/support/home',
    compatibility_outcome: 'supported_with_dock',
  },
  {
    manufacturer: /lenovo/i,
    modelContains: /(thinkpad|thinkbook)/i,
    spec_source_url: 'https://pcsupport.lenovo.com',
    compatibility_outcome: 'supported_with_dock',
  },
  {
    manufacturer: /hp/i,
    modelContains: /(elitebook|probook|zbook)/i,
    spec_source_url: 'https://support.hp.com',
    compatibility_outcome: 'supported_with_dock',
  },
];

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
    tenantId: string | null;
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
      tenantId,
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
    const { autotaskClient, ninjaoneClient, itglueClient, credentialScope, tenantId } =
      await this.resolveClientsForSession(input.sessionId);
    const sourceWorkspace = tenantId ? `tenant:${tenantId}` : 'workspace:latest';

    // ─── Coleta de Dados (Autotask ou Email Ingestion) ───────────
    let ticket: TicketLike | null = null;
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
            tenant_id: tenantId,
            org_id: input.orgId || null,
            source_workspace: sourceWorkspace,
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
          tenant_id: tenantId,
          org_id: input.orgId || null,
          source_workspace: sourceWorkspace,
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
    const rejectedEvidence: RejectedEvidence[] = [];
    const facetContext = this.detectFacetContext(
      `${ticket.title || ''} ${ticket.description || ''} ${ticket.requester || ''}`
    );
    const scopeMeta: ScopeMeta = {
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
    };

    // round state
    let relatedCases: RelatedCase[] = [];
    let docs: Doc[] = [];
    let device: any = null;
    let deviceDetails: any | null = null;
    let loggedInUser = '';
    let ninjaChecks: Signal[] = [];
    let ninjaOrgMatch: { id: number; name: string } | null = null;
    let ninjaOrgDevices: any[] = [];
    let ninjaAlerts: any[] = [];
    let itglueOrgMatch: { id: string; name: string } | null = null;
    let itglueConfigs: any[] = [];
    let itglueContacts: any[] = [];
    let itgluePasswords: any[] = [];
    let itglueAssets: any[] = [];

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
        [itglueConfigs, itglueContacts, itgluePasswords] = await Promise.all([
          itglueClient.getConfigurations(itglueOrgMatch.id).catch(() => []),
          itglueClient.getContacts(itglueOrgMatch.id).catch(() => []),
          itglueClient.getPasswords(itglueOrgMatch.id).catch(() => []),
        ]);
        if (facetContext.symptom.includes('hardware')) {
          const assetTypes = await itglueClient.getFlexibleAssetTypes(20).catch(() => []);
          const assetCandidates = await Promise.all(
            assetTypes.slice(0, 3).map((t: any) =>
              itglueClient.getFlexibleAssets(String(t.id), itglueOrgMatch!.id, 30).catch(() => [])
            )
          );
          itglueAssets = assetCandidates.flat();
        }
      }

      docs = runbooks.slice(0, 5).map((doc, idx) => ({
        id: doc.id,
        source: 'itglue' as const,
        title: doc.name,
        snippet: doc.body?.substring(0, 500) || '',
        relevance: 0.5 - idx * 0.05,
        raw_ref: doc as unknown as Record<string, unknown>,
        tenant_id: tenantId,
        org_id: itglueOrgMatch?.id || null,
        source_workspace: sourceWorkspace,
      }));

      const boostTerms = this.getFacetBoostTerms(facetContext);
      if (boostTerms.length > 0) {
        const boostedDocs = await Promise.all(
          boostTerms.slice(0, 3).map((term) =>
            itglueClient.searchDocuments(term, itglueOrgMatch?.id).catch(() => [])
          )
        );
        const flattened = boostedDocs.flat().slice(0, 4);
        docs = docs.concat(
          flattened.map((doc: any, idx: number) => ({
            id: String(doc.id),
            source: 'itglue' as const,
            title: String(doc.name || `Context doc ${idx + 1}`),
            snippet: String((doc as any).body || '').substring(0, 500),
            relevance: 0.45 - idx * 0.05,
            raw_ref: doc as unknown as Record<string, unknown>,
            tenant_id: tenantId,
            org_id: itglueOrgMatch?.id || null,
            source_workspace: sourceWorkspace,
          }))
        );
      }

      sourceFindings.push({
        source: 'itglue',
        round: 1,
        facet: 'base',
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
          `passwords: ${itgluePasswords.length}`,
          `assets: ${itglueAssets.length}`,
          runbooksEndpointUnavailable ? 'runbooks endpoint: unavailable (404)' : `runbooks: ${docs.length}`,
          `credential scope: ${credentialScope}`,
        ],
        why_selected: [
          'base retrieval always includes contacts, configs, passwords, documents, assets, recent alerts, and related changes',
          ...(boostTerms.length ? [`facet boost terms: ${boostTerms.join(', ')}`] : []),
        ],
        tenant_id: tenantId,
        org_id: itglueOrgMatch?.id || null,
        source_workspace: sourceWorkspace,
      });
    } catch (error) {
      missingData.push({
        field: 'itglue_docs',
        why: `Failed to fetch IT Glue docs: ${(error as Error).message}`,
      });
      sourceFindings.push({
        source: 'itglue',
        round: 1,
        facet: 'base',
        queried: true,
        matched: false,
        summary: 'organization context query failed',
        details: [`error: ${(error as Error).message}`],
        why_rejected: ['itglue collection error'],
        tenant_id: tenantId,
        org_id: null,
        source_workspace: sourceWorkspace,
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

      const resolvedDevice = await this.resolveDeviceDeterministically({
        devices: ninjaOrgDevices,
        ticketText: `${ticket.title || ''} ${ticket.description || ''}`,
        requesterName,
        itglueConfigs,
        ninjaoneClient,
        sourceWorkspace,
        tenantId,
        orgId: ninjaOrgMatch ? String(ninjaOrgMatch.id) : itglueOrgMatch?.id || null,
      });

      device = resolvedDevice.device;
      ninjaChecks = resolvedDevice.checks;
      loggedInUser = resolvedDevice.loggedInUser;
      deviceDetails = resolvedDevice.details ?? null;

      sourceFindings.push({
        source: 'ninjaone',
        round: 1,
        facet: 'base',
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
        why_selected: [resolvedDevice.reason],
        tenant_id: tenantId,
        org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
        source_workspace: sourceWorkspace,
      });
    } catch (error) {
      missingData.push({
        field: 'ninjaone_device',
        why: `Failed to fetch NinjaOne data: ${(error as Error).message}`,
      });
      sourceFindings.push({
        source: 'ninjaone',
        round: 1,
        facet: 'base',
        queried: true,
        matched: false,
        summary: 'device lookup failed',
        details: [`error: ${(error as Error).message}`],
        why_rejected: ['ninjaone collection error'],
        tenant_id: tenantId,
        org_id: null,
        source_workspace: sourceWorkspace,
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
    relatedCases = (await this.findRelatedCasesByTerms(historyTerms, input.orgId)).map((rc) => ({
      ...rc,
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
    }));
    sourceFindings.push({
      source: 'autotask',
      round: 2,
      facet: 'related_changes',
      queried: true,
      matched: relatedCases.length > 0,
      summary: relatedCases.length > 0
        ? `historical correlation found ${relatedCases.length} related case(s)`
        : 'historical correlation found no related case',
      details: [`search terms used: ${Math.min(historyTerms.length, 6)}`],
      why_selected: ['related_changes is always collected from historical sessions'],
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
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
        facet: 'entity_linking',
        queried: true,
        matched: Boolean(device),
        summary: device ? `refined device context: ${device.hostname || device.systemName || device.id}` : 'no refined device context',
        details: [loggedInUser ? `logged-in user after refinement: ${loggedInUser}` : 'logged-in user unavailable after refinement'],
        why_selected: ['round-3 refinement re-evaluates device alignment using resolved actor tokens'],
        tenant_id: tenantId,
        org_id:
          input.orgId ||
          itglueOrgMatch?.id ||
          (ninjaOrgMatch ? String(ninjaOrgMatch.id) : null),
        source_workspace: sourceWorkspace,
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
      facet: 'entity_linking',
      queried: true,
      matched: Boolean(refinedConfigs.length || refinedContacts.length),
      summary: refinedConfigs.length || refinedContacts.length
        ? 'refined org context linked requester/device in IT Glue'
        : 'no additional IT Glue links found in refinement',
      details: [
        `refined configs: ${refinedConfigs.length}`,
        `refined contacts: ${refinedContacts.length}`,
      ],
      why_selected: ['round-3 refinement aligns entities after initial source crossing'],
      tenant_id: tenantId,
      org_id: itglueOrgMatch?.id || null,
      source_workspace: sourceWorkspace,
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
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
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
      why_selected: ['ticket intake is authoritative for first-pass org and actor hints'],
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
    });

    const resolvedOrgId =
      input.orgId ||
      itglueOrgMatch?.id ||
      (ninjaOrgMatch ? String(ninjaOrgMatch.id) : null);
    scopeMeta.org_id = resolvedOrgId || null;

    const entityResolution = this.resolveEntityScope({
      ticketText: `${ticket.title || ''}\n${ticket.description || ''}`,
      requesterName,
      companyName,
      contacts: itglueContacts,
      orgScopeId: resolvedOrgId || null,
      tenantId,
      sourceWorkspace,
    });

    if (entityResolution.status !== 'resolved') {
      missingData.push({
        field: 'named_entity',
        why:
          entityResolution.disambiguation_question ||
          'Named entity unresolved inside org scope; disambiguation required before final playbook',
      });
    }

    const capabilityVerification = this.verifyCapabilityChain({
      required: facetContext.requiresCapabilityVerification,
      device,
      deviceDetails,
      ticketText: `${ticket.title || ''} ${ticket.description || ''}`,
      itglueAssets,
      sourceWorkspace,
      tenantId,
      orgId: resolvedOrgId || null,
    });

    if (
      capabilityVerification.required &&
      (!capabilityVerification.device_match_strong || !capabilityVerification.model_spec_confirmed)
    ) {
      missingData.push({
        field: 'capability_verification',
        why:
          'Capability ticket requires strong device match and official model specification before final conclusion',
      });
    }

    const scopedDocs = docs.filter((doc) => {
      const decision = this.enforceOrgBoundary({
        itemId: `doc:${doc.id}`,
        itemOrgId: doc.org_id || null,
        targetOrgId: resolvedOrgId || null,
        source: 'itglue',
        summary: doc.title,
        scopeMeta,
      });
      if (decision.rejected) rejectedEvidence.push(decision.rejected);
      return decision.accepted;
    });

    const scopedSignals = [...signals, ...ninjaChecks].filter((signal) => {
      const candidateOrgId = signal.org_id || resolvedOrgId || null;
      const decision = this.enforceOrgBoundary({
        itemId: `signal:${signal.id}`,
        itemOrgId: candidateOrgId,
        targetOrgId: resolvedOrgId || null,
        source: signal.source,
        summary: signal.summary,
        scopeMeta,
      });
      if (decision.rejected) rejectedEvidence.push(decision.rejected);
      return decision.accepted;
    });

    const scopedRelatedCases = relatedCases.filter((relatedCase) => {
      const decision = this.enforceOrgBoundary({
        itemId: `case:${relatedCase.ticket_id}`,
        itemOrgId: relatedCase.org_id || resolvedOrgId || null,
        targetOrgId: resolvedOrgId || null,
        source: 'history',
        summary: relatedCase.symptom,
        scopeMeta,
      });
      if (decision.rejected) rejectedEvidence.push(decision.rejected);
      return decision.accepted;
    });

    const evidenceDigest = this.buildEvidenceDigest({
      ticket,
      sourceFindings,
      missingData,
      entityResolution,
      signals: scopedSignals,
      docs: scopedDocs,
      relatedCases: scopedRelatedCases,
      rejectedEvidence,
      capabilityVerification,
      facetContext,
      scopeMeta,
      device,
      loggedInUser,
      requesterName,
    });

    // ─── Monta EvidencePack ──────────────────────────────────────
    const basePackObject = {
      session_id: input.sessionId,
      tenant_id: tenantId,
      source_workspace: sourceWorkspace,
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
        id: resolvedOrgId || 'unknown',
        name: companyName || itglueOrgMatch?.name || ninjaOrgMatch?.name || 'Organization',
      },
      ...(entityResolution.resolved_actor && {
        user: {
          name: entityResolution.resolved_actor.name,
          email: entityResolution.resolved_actor.email || '',
        },
      }),
      signals: scopedSignals,
      related_cases: scopedRelatedCases,
      external_status: externalStatus,
      docs: scopedDocs,
      source_findings: sourceFindings,
      entity_resolution: entityResolution,
      evidence_digest: evidenceDigest,
      rejected_evidence: rejectedEvidence,
      capability_verification: capabilityVerification,
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
          hostname: device.hostname || device.systemName || String(device.id),
          os: device.osName || device.osVersion || 'Unknown',
          last_seen: device.lastActivityTime || device.lastContact || new Date().toISOString(),
          confidence: capabilityVerification.device_match_strong ? 'high' as const : 'medium' as const,
        },
      }),
      ...(missingData.length > 0 && { missing_data: missingData }),
    } as EvidencePack;

    const duration = Date.now() - startTime;
    console.log(`[PrepareContext] Completed in ${duration}ms`);

    return evidencePack;
  }

  private detectFacetContext(ticketText: string): FacetContext {
    const normalized = ticketText.toLowerCase();
    const symptom = Object.entries(FACET_TERMS.symptom)
      .filter(([, terms]) => terms.some((term) => normalized.includes(term)))
      .map(([facet]) => facet);
    const technology = Object.entries(FACET_TERMS.technology)
      .filter(([, terms]) => terms.some((term) => normalized.includes(term)))
      .map(([facet]) => facet);
    const entityCandidates = this.extractEmailDomains(ticketText).concat(
      (ticketText.match(/[A-Z]{2,}-\d{2,}/g) || []).map((v) => v.toLowerCase())
    );
    return {
      symptom,
      technology,
      entities: [...new Set(entityCandidates)].slice(0, 8),
      requiresCapabilityVerification:
        symptom.includes('hardware') &&
        /(monitor|usb-c|thunderbolt|display|dock|adapter)/i.test(ticketText),
    };
  }

  private getFacetBoostTerms(facets: FacetContext): string[] {
    const boosts: string[] = [];
    if (facets.technology.includes('fortinet')) {
      boosts.push('fortinet firewall configuration', 'fortinet vpn credentials');
    }
    if (facets.technology.includes('goto') || facets.symptom.includes('telephony')) {
      boosts.push('goto voip troubleshooting', 'telephony runbook');
    }
    if (facets.symptom.includes('vpn') || facets.technology.includes('vpn')) {
      boosts.push('vpn identity endpoint troubleshooting', 'firewall vpn tunnel checks');
    }
    if (facets.requiresCapabilityVerification) {
      boosts.push('multi monitor support', 'usb-c alt mode', 'thunderbolt compatibility');
    }
    return [...new Set(boosts)];
  }

  private async resolveDeviceDeterministically(input: {
    devices: any[];
    ticketText: string;
    requesterName: string;
    itglueConfigs: any[];
    ninjaoneClient: NinjaOneClient;
    sourceWorkspace: string;
    tenantId: string | null;
    orgId: string | null;
  }): Promise<DeviceResolutionResult> {
    if (!input.devices.length) {
      return {
        device: null,
        checks: [],
        loggedInUser: '',
        reason: 'no devices available in org scope',
        strongMatch: false,
      };
    }

    const normalizedTicket = input.ticketText.toLowerCase();
    const requesterTokens = this.buildRequesterTokens(input.requesterName);
    const configHints = input.itglueConfigs
      .map((c: any) => String(c?.attributes?.hostname || c?.attributes?.name || '').toLowerCase())
      .filter(Boolean);

    const scored = input.devices
      .map((device) => {
        const identity = `${device.hostname || ''} ${device.systemName || ''}`.toLowerCase();
        let score = 0;
        const reasons: string[] = [];
        if (identity && normalizedTicket.includes(identity)) {
          score += 0.55;
          reasons.push('hostname mentioned in ticket');
        }
        if (requesterTokens.some((token) => identity.includes(token))) {
          score += 0.25;
          reasons.push('hostname correlated with requester token');
        }
        if (configHints.some((hint) => hint && identity.includes(hint))) {
          score += 0.2;
          reasons.push('hostname correlated with IT Glue configuration');
        }
        return { device, score, reasons };
      })
      .sort((a, b) => b.score - a.score);

    const winner = scored[0];
    if (!winner) {
      return {
        device: null,
        checks: [],
        loggedInUser: '',
        reason: 'no scored device candidates in org scope',
        strongMatch: false,
      };
    }
    const strongMatch = winner.score >= 0.65;
    const selectedDevice = winner.device;

    let details: any = null;
    let loggedInUser = '';
    let checks: Signal[] = [];
    if (selectedDevice?.id) {
      const [rawChecks, rawDetails] = await Promise.all([
        input.ninjaoneClient.getDeviceChecks(String(selectedDevice.id)).catch(() => []),
        input.ninjaoneClient.getDeviceDetails(String(selectedDevice.id)).catch(() => null),
      ]);
      details = rawDetails;
      loggedInUser = this.extractLoggedInUser(rawDetails) || '';
      checks = rawChecks.map((check) => ({
        id: `ninja-check-${check.id}`,
        source: 'ninja' as const,
        timestamp: check.lastCheck,
        type: check.status === 'passed' ? 'health_ok' : 'health_warn',
        summary: `${check.name}: ${check.status}`,
        raw_ref: check,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      }));
    }

    const reason =
      winner.reasons.length > 0
        ? `${winner.reasons.join(', ')}; score=${winner.score.toFixed(2)}`
        : `fallback to first available device; score=${winner.score.toFixed(2)}`;

    return {
      device: selectedDevice,
      checks,
      loggedInUser,
      reason,
      strongMatch,
      details,
    };
  }

  private resolveEntityScope(input: {
    ticketText: string;
    requesterName: string;
    companyName: string;
    contacts: any[];
    orgScopeId: string | null;
    tenantId: string | null;
    sourceWorkspace: string;
  }): EntityResolution {
    const text = input.ticketText;
    const emailMatches = [
      ...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((e) => e.toLowerCase())),
    ];
    const phoneMatches = [
      ...new Set((text.match(/(?:\+?\d[\d\-\s().]{7,}\d)/g) || []).map((p) => p.trim())),
    ];
    const locationMatches = [
      ...new Set(
        (text.match(/(?:site|office|location)\s*[:\-]\s*([^\n,.]+)/gi) || []).map((v) =>
          v.replace(/(?:site|office|location)\s*[:\-]\s*/i, '').trim()
        )
      ),
    ];
    const productMatches = [
      ...new Set(
        this.getFacetBoostTerms(this.detectFacetContext(text))
          .map((s) => s.split(' ')[0])
          .filter((value): value is string => Boolean(value && value.trim()))
      ),
    ];
    const properNames = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
    const personCandidates = [
      ...new Set(
        [input.requesterName, ...properNames].filter(
          (value): value is string => Boolean(value && value.trim())
        )
      ),
    ];
    const companyCandidates = [
      ...new Set([input.companyName].filter((value): value is string => Boolean(value && value.trim()))),
    ];

    const normalizedRequester = this.normalizeName(input.requesterName).toLowerCase();
    const normalizedCompany = this.normalizeName(input.companyName).toLowerCase();
    const scoredCandidates = input.contacts
      .map((contact: any) => {
        const attrs = contact?.attributes || {};
        const name = this.normalizeName(
          String(attrs.name || `${attrs.first_name || ''} ${attrs.last_name || ''}` || '').trim()
        );
        const email = String(attrs.primary_email || '').toLowerCase();
        const phone = String(attrs.primary_phone || '');
        const exactName = normalizedRequester && name.toLowerCase() === normalizedRequester ? 0.4 : 0;
        const emailScore = emailMatches.includes(email) && email ? 0.3 : 0;
        const phoneScore = phoneMatches.some((p) => phone.includes(p) || p.includes(phone)) && phone ? 0.2 : 0;
        const companyScore = normalizedCompany ? 0.1 : 0;
        const score = Number((exactName + emailScore + phoneScore + companyScore).toFixed(3));
        return {
          id: String(contact.id || `contact-${name}`),
          name: name || 'Unknown Contact',
          score,
          score_breakdown: {
            exact_name: exactName,
            email: emailScore,
            phone: phoneScore,
            company_normalized: companyScore,
          },
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(input.companyName ? { company: input.companyName } : {}),
        };
      })
      .sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0];
    const second = scoredCandidates[1];
    const hasStrongMatch = Boolean(best && best.score >= 0.75 && (!second || best.score - second.score >= 0.15));

    if (hasStrongMatch && best) {
      const resolvedActor: EntityResolution['resolved_actor'] = {
        id: best.id,
        name: best.name,
        confidence: 'strong',
        ...(best.email ? { email: best.email } : {}),
        ...(best.phone ? { phone: best.phone } : {}),
      };
      return {
        extracted_entities: {
          person: personCandidates,
          company: companyCandidates,
          phone: phoneMatches,
          email: emailMatches,
          location: locationMatches,
          product_or_domain: productMatches,
        },
        resolved_actor: resolvedActor,
        status: 'resolved',
      };
    }

    if (best && best.score > 0) {
      const list = scoredCandidates.slice(0, 4);
      return {
        extracted_entities: {
          person: personCandidates,
          company: companyCandidates,
          phone: phoneMatches,
          email: emailMatches,
          location: locationMatches,
          product_or_domain: productMatches,
        },
        actor_candidates: list,
        disambiguation_question: `Please confirm actor identity in org ${input.orgScopeId || 'scope'}: ${list
          .map((c) => `${c.name}${c.email ? ` <${c.email}>` : ''}`)
          .join(' | ')}`,
        status: 'ambiguous',
      };
    }

    return {
      extracted_entities: {
        person: personCandidates,
        company: companyCandidates,
        phone: phoneMatches,
        email: emailMatches,
        location: locationMatches,
        product_or_domain: productMatches,
      },
      disambiguation_question:
        'Actor could not be resolved from org-scoped contacts; request explicit user/email confirmation',
      status: 'unresolved',
    };
  }

  private verifyCapabilityChain(input: {
    required: boolean;
    device: any | null;
    deviceDetails: any | null;
    ticketText: string;
    itglueAssets: any[];
    sourceWorkspace: string;
    tenantId: string | null;
    orgId: string | null;
  }): CapabilityVerification {
    if (!input.required) {
      return {
        required: false,
        device_match_strong: true,
        model_spec_confirmed: true,
      };
    }

    const extracted = this.extractDeviceHardwareInfo(input.device, input.deviceDetails, input.itglueAssets);
    const vendorRule = CAPABILITY_SPEC_RULES.find((rule) =>
      rule.manufacturer.test(extracted.manufacturer || '') &&
      rule.modelContains.test(extracted.model || '')
    );

    return {
      required: true,
      device_match_strong: Boolean(input.device && extracted.matchReason !== 'device not resolved'),
      model_spec_confirmed: Boolean(vendorRule),
      device_match_reason: extracted.matchReason,
      ...(extracted.manufacturer ? { manufacturer: extracted.manufacturer } : {}),
      ...(extracted.model ? { model: extracted.model } : {}),
      ...(extracted.serial ? { serial: extracted.serial } : {}),
      ...(extracted.dockOrAdapter ? { dock_or_adapter: extracted.dockOrAdapter } : {}),
      ...(vendorRule?.spec_source_url ? { spec_source_url: vendorRule.spec_source_url } : {}),
      ...(vendorRule?.compatibility_outcome
        ? { compatibility_outcome: vendorRule.compatibility_outcome }
        : {}),
    };
  }

  private extractDeviceHardwareInfo(device: any, details: any, assets: any[]): {
    manufacturer?: string;
    model?: string;
    serial?: string;
    dockOrAdapter?: string;
    matchReason: string;
  } {
    if (!device) {
      return { matchReason: 'device not resolved' };
    }
    const manufacturer = String(
      details?.manufacturer ||
      details?.vendor ||
      device?.manufacturer ||
      device?.vendor ||
      ''
    ).trim();
    const model = String(details?.model || device?.model || details?.systemModel || '').trim();
    const serial = String(details?.serialNumber || details?.serial || device?.serialNumber || '').trim();
    const dockAsset = assets.find((asset: any) =>
      /dock|adapter|usb-c|thunderbolt/i.test(String(JSON.stringify(asset?.attributes || {})))
    );
    const dockOrAdapter = dockAsset
      ? String((dockAsset?.attributes?.name || dockAsset?.attributes?.description || 'Dock/Adapter')).trim()
      : undefined;

    const result: {
      manufacturer?: string;
      model?: string;
      serial?: string;
      dockOrAdapter?: string;
      matchReason: string;
    } = {
      matchReason: `resolved via ninja inventory${dockOrAdapter ? ' + itglue asset correlation' : ''}`,
    };
    if (manufacturer) result.manufacturer = manufacturer;
    if (model) result.model = model;
    if (serial) result.serial = serial;
    if (dockOrAdapter) result.dockOrAdapter = dockOrAdapter;
    return result;
  }

  private enforceOrgBoundary(input: {
    itemId: string;
    itemOrgId: string | null;
    targetOrgId: string | null;
    source: string;
    summary: string;
    scopeMeta: ScopeMeta;
  }): { accepted: boolean; rejected?: RejectedEvidence } {
    if (!input.itemOrgId || !input.targetOrgId || input.itemOrgId === input.targetOrgId) {
      return { accepted: true };
    }

    return {
      accepted: false,
      rejected: {
        id: input.itemId,
        source: input.source,
        reason: 'org_mismatch',
        summary: input.summary,
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.itemOrgId,
        source_workspace: input.scopeMeta.source_workspace,
        evidence_score: 0,
      },
    };
  }

  private buildEvidenceDigest(input: {
    ticket: TicketLike;
    sourceFindings: SourceFinding[];
    missingData: Array<{ field: string; why: string }>;
    entityResolution: EntityResolution;
    signals: Signal[];
    docs: Doc[];
    relatedCases: RelatedCase[];
    rejectedEvidence: RejectedEvidence[];
    capabilityVerification: CapabilityVerification;
    facetContext: FacetContext;
    scopeMeta: ScopeMeta;
    device: any;
    loggedInUser: string;
    requesterName: string;
  }): EvidenceDigest {
    const factsConfirmed: DigestFact[] = [];
    const factsConflicted: DigestFact[] = [];

    const ticketFactId = `fact-ticket-${String(input.ticket.ticketNumber || input.ticket.id || 'unknown')}`;
    factsConfirmed.push({
      id: ticketFactId,
      fact: `Ticket scope: ${input.ticket.title || 'Untitled ticket'}`,
      evidence_score: 1,
      evidence_refs: [ticketFactId],
      source: 'ticket',
      tenant_id: input.scopeMeta.tenant_id,
      org_id: input.scopeMeta.org_id,
      source_workspace: input.scopeMeta.source_workspace,
    });

    if (input.entityResolution.resolved_actor) {
      const actor = input.entityResolution.resolved_actor;
      factsConfirmed.push({
        id: `fact-actor-${actor.id}`,
        fact: `Resolved actor: ${actor.name}${actor.email ? ` <${actor.email}>` : ''}`,
        evidence_score: actor.confidence === 'strong' ? 1 : 0.7,
        evidence_refs: [`entity:${actor.id}`],
        source: 'entity_resolution',
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    } else if (input.entityResolution.actor_candidates?.length) {
      factsConflicted.push({
        id: 'fact-actor-ambiguous',
        fact: `Actor candidates: ${input.entityResolution.actor_candidates.map((c) => c.name).join(', ')}`,
        evidence_score: 0.2,
        evidence_refs: input.entityResolution.actor_candidates.map((c) => `entity:${c.id}`),
        source: 'entity_resolution',
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    }

    if (input.device) {
      factsConfirmed.push({
        id: `fact-device-${String(input.device.id)}`,
        fact: `Device candidate: ${input.device.hostname || input.device.systemName || input.device.id}${input.loggedInUser ? ` (logged in: ${input.loggedInUser})` : ''}`,
        evidence_score: input.capabilityVerification.device_match_strong ? 0.9 : 0.55,
        evidence_refs: [`device:${String(input.device.id)}`],
        source: 'ninjaone',
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    }

    input.docs.slice(0, 4).forEach((doc) => {
      factsConfirmed.push({
        id: `fact-doc-${doc.id}`,
        fact: `Doc evidence: ${doc.title}`,
        evidence_score: Number(Math.max(0.35, doc.relevance).toFixed(2)),
        evidence_refs: [`doc:${doc.id}`],
        source: doc.source,
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    });

    input.signals.slice(0, 6).forEach((signal) => {
      factsConfirmed.push({
        id: `fact-signal-${signal.id}`,
        fact: `Signal: ${signal.summary}`,
        evidence_score: 0.6,
        evidence_refs: [`signal:${signal.id}`],
        source: signal.source,
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    });

    if (input.requesterName && input.loggedInUser && input.requesterName.toLowerCase() !== input.loggedInUser.toLowerCase()) {
      factsConflicted.push({
        id: 'fact-conflict-requester-loggedin',
        fact: `Requester "${input.requesterName}" differs from logged-in user "${input.loggedInUser}"`,
        evidence_score: 0.25,
        evidence_refs: ['ticket:requester', 'ninja:logged_in_user'],
        source: 'cross_correlation',
        tenant_id: input.scopeMeta.tenant_id,
        org_id: input.scopeMeta.org_id,
        source_workspace: input.scopeMeta.source_workspace,
      });
    }

    const missingCritical = [...input.missingData];

    const candidateActions: DigestAction[] = this.buildFacetActions(input.facetContext)
      .map((action) => ({
        ...action,
        evidence_refs: action.evidence_refs
          .flatMap((kind) => this.resolveEvidenceRefsByKind(kind, factsConfirmed))
          .slice(0, 6),
      }))
      .filter((action) => action.evidence_refs.length > 0);

    const sourcesByFacet: Record<string, string[]> = {};
    for (const finding of input.sourceFindings) {
      const facet = finding.facet || 'base';
      if (!sourcesByFacet[facet]) sourcesByFacet[facet] = [];
      if (!sourcesByFacet[facet].includes(finding.source)) {
        sourcesByFacet[facet].push(finding.source);
      }
    }

    return {
      facts_confirmed: factsConfirmed,
      facts_conflicted: factsConflicted,
      missing_critical: missingCritical,
      candidate_actions: candidateActions,
      tech_context_detected: [...new Set(input.facetContext.technology)],
      sources_consulted_by_facet: sourcesByFacet,
      rejected_evidence: input.rejectedEvidence,
      capability_verification: input.capabilityVerification,
    };
  }

  private buildFacetActions(facets: FacetContext): DigestAction[] {
    const actions: DigestAction[] = [
      {
        action: 'Confirm current symptom with requester and exact start time',
        evidence_refs: ['kind:ticket'],
        rationale: 'Baseline triage action anchored in ticket narrative',
      },
    ];
    if (facets.symptom.includes('connection')) {
      actions.push({
        action: 'Run endpoint connectivity checks and compare against last known-good baseline',
        evidence_refs: ['kind:signal', 'kind:device'],
      });
    }
    if (facets.symptom.includes('telephony') || facets.technology.includes('goto')) {
      actions.push({
        action: 'Validate VoIP registration and call path from GoTo/FQDN context',
        evidence_refs: ['kind:doc', 'kind:signal'],
      });
    }
    if (facets.symptom.includes('vpn') || facets.technology.includes('fortinet')) {
      actions.push({
        action: 'Verify firewall VPN tunnel state and identity/session logs',
        evidence_refs: ['kind:doc', 'kind:signal'],
      });
    }
    if (facets.requiresCapabilityVerification) {
      actions.push({
        action: 'Confirm device video capability against official vendor specs before final recommendation',
        evidence_refs: ['kind:device', 'kind:doc'],
      });
    }
    return actions;
  }

  private resolveEvidenceRefsByKind(kind: string, facts: DigestFact[]): string[] {
    if (kind === 'kind:ticket') {
      return facts.filter((fact) => fact.id.startsWith('fact-ticket-')).map((fact) => fact.id);
    }
    if (kind === 'kind:signal') {
      return facts.filter((fact) => fact.id.startsWith('fact-signal-')).map((fact) => fact.id);
    }
    if (kind === 'kind:doc') {
      return facts.filter((fact) => fact.id.startsWith('fact-doc-')).map((fact) => fact.id);
    }
    if (kind === 'kind:device') {
      return facts.filter((fact) => fact.id.startsWith('fact-device-')).map((fact) => fact.id);
    }
    return [];
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
