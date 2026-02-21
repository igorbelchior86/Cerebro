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
  EnrichmentField,
  IterativeEnrichmentProfile,
  IterativeEnrichmentSections,
  SecurityAgentSummary,
} from '@playbook-brain/types';
import { AutotaskClient } from '../clients/autotask.js';
import { NinjaOneClient } from '../clients/ninjaone.js';
import { ITGlueClient } from '../clients/itglue.js';
import { query, queryOne, execute } from '../db/index.js';
import { emailParser } from './email/email-parser.js';
import { callLLM } from './llm-adapter.js';

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
  rawBody?: string;
  updates?: Array<{ timestamp?: string; content?: string }>;
  createDate?: string;
  priority?: number;
  queueName?: string;
  canonicalRequesterName?: string;
  canonicalRequesterEmail?: string;
  canonicalAffectedName?: string;
  canonicalAffectedEmail?: string;
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
  loggedInAt?: string;
  reason: string;
  strongMatch: boolean;
  score: number;
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
    modelContains: /(elitebook|probook|zbook|hp laptop|pavilion|envy|spectre)/i,
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
          `SELECT id, title, description, ${includeCompany ? 'company' : `''::text as company`}, requester, raw_body, status, updates, created_at 
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
            rawBody: emailTicket.raw_body || '',
            updates: Array.isArray(emailTicket.updates) ? emailTicket.updates : [],
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
                rawBody: parsed.rawBody || '',
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
    const sourceFindings: SourceFinding[] = [];
    const rejectedEvidence: RejectedEvidence[] = [];
    const normalizedTicket = await this.normalizeTicketForPipeline(ticket).catch(() => null);
    if (normalizedTicket) {
      if (normalizedTicket.title) ticket.title = normalizedTicket.title;
      if (normalizedTicket.descriptionClean) ticket.description = normalizedTicket.descriptionClean;
      if (normalizedTicket.requesterName) ticket.canonicalRequesterName = normalizedTicket.requesterName;
      if (normalizedTicket.requesterEmail) ticket.canonicalRequesterEmail = normalizedTicket.requesterEmail;
      if (normalizedTicket.affectedUserName) ticket.canonicalAffectedName = normalizedTicket.affectedUserName;
      if (normalizedTicket.affectedUserEmail) ticket.canonicalAffectedEmail = normalizedTicket.affectedUserEmail;
      sourceFindings.push({
        source: 'external',
        round: 0,
        facet: 'base',
        queried: true,
        matched: true,
        summary: 'ticket text normalized for intake',
        details: [
          `method: ${normalizedTicket.method}`,
          `confidence: ${normalizedTicket.confidence.toFixed(2)}`,
          normalizedTicket.requesterName || normalizedTicket.requesterEmail
            ? `canonical requester: ${normalizedTicket.requesterName || 'unknown'}${normalizedTicket.requesterEmail ? ` <${normalizedTicket.requesterEmail}>` : ''}`
            : 'canonical requester: unavailable',
          normalizedTicket.affectedUserName || normalizedTicket.affectedUserEmail
            ? `canonical affected: ${normalizedTicket.affectedUserName || 'unknown'}${normalizedTicket.affectedUserEmail ? ` <${normalizedTicket.affectedUserEmail}>` : ''}`
            : 'canonical affected: unavailable',
        ],
        why_selected: ['round-0 normalization is mandatory before iterative enrichment'],
        tenant_id: tenantId,
        org_id: input.orgId || null,
        source_workspace: sourceWorkspace,
      });
    }

    const ticketNarrative = this.buildTicketNarrative(ticket);
    const inferredCompany = this.inferCompanyNameFromTicketText(ticketNarrative);
    const companyName = this.normalizeName(ticket.company || inferredCompany || '');
    const requesterName = this.normalizeName(ticket.canonicalRequesterName || ticket.requester || '');
    const facetContext = this.detectFacetContext(
      ticketNarrative
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
    let loggedInAt = '';
    let ninjaChecks: Signal[] = [];
    let ninjaContextSignals: Signal[] = [];
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
          ticketNarrative
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
        ticketText: ticketNarrative,
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
      loggedInAt = resolvedDevice.loggedInAt || '';
      deviceDetails = resolvedDevice.details ?? null;
      if (device?.id) {
        ninjaContextSignals = await this.buildNinjaContextSignals({
          ninjaoneClient,
          deviceId: String(device.id),
          orgId:
            input.orgId ||
            itglueOrgMatch?.id ||
            (ninjaOrgMatch ? String(ninjaOrgMatch.id) : null),
          tenantId,
          sourceWorkspace,
        });
      }

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
          `extended signals: ${ninjaContextSignals.length}`,
          loggedInUser ? `logged-in user: ${loggedInUser}` : 'logged-in user: not available',
          `credential scope: ${credentialScope}`,
        ],
        why_selected: [resolvedDevice.reason],
        tenant_id: tenantId,
        org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
        source_workspace: sourceWorkspace,
      });
      if (!device) {
        missingData.push({
          field: 'device_unresolved',
          why: `NinjaOne lookup did not produce a reliable device correlation (score=${resolvedDevice.score.toFixed(2)})`,
        });
      }
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

    const inferredPhoneProvider = this.inferPhoneProvider({
      ticketText: ticketNarrative,
      docs,
      itglueConfigs,
      itgluePasswords,
      signals: [...signals, ...ninjaChecks],
    });
    if (inferredPhoneProvider) {
      sourceFindings.push({
        source: 'external',
        round: 1,
        facet: 'telephony',
        queried: true,
        matched: true,
        summary: `phone provider inferred as ${inferredPhoneProvider}`,
        details: ['inferred from ticket + org-scoped docs/configs/passwords/signals'],
        why_selected: ['deterministic provider keyword matching before diagnosis/playbook generation'],
        tenant_id: tenantId,
        org_id: input.orgId || itglueOrgMatch?.id || (ninjaOrgMatch ? String(ninjaOrgMatch.id) : null) || null,
        source_workspace: sourceWorkspace,
      });
    } else if (facetContext.symptom.includes('telephony') || facetContext.technology.includes('goto')) {
      missingData.push({
        field: 'phone_provider',
        why: 'Telephony context detected but no provider signal found in ticket/docs/configs/passwords',
      });
    }

    // ROUND 2: ... -> AT history with refined terms
    const historyTerms = [
      ticket.title || '',
      ticket.description || '',
      ticketNarrative,
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
        const lastLogged = await this.resolveLastLoggedInContext(ninjaoneClient, String(device.id));
        if (lastLogged.userName) {
          loggedInUser = lastLogged.userName;
          loggedInAt = lastLogged.logonTime || loggedInAt;
        }
        else if (details) loggedInUser = this.extractLoggedInUser(details) || loggedInUser;
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
        org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
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
      round: 4,
      facet: 'external_refinement',
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
    if (!resolvedOrgId) {
      missingData.push({
        field: 'org_scope_unresolved',
        why: 'Could not deterministically resolve organization scope from ticket/company/domain signals',
      });
    }

    const entityResolution = this.resolveEntityScope({
      ticketText: ticketNarrative,
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
      ticketText: ticketNarrative,
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

    const scopedSignals = [...signals, ...ninjaChecks, ...ninjaContextSignals].filter((signal) => {
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
      inferredPhoneProvider,
    });

    const iterativeEnrichment = this.buildIterativeEnrichmentProfile({
      ticket,
      ticketNarrative,
      companyName,
      inferredCompany: inferredCompany || '',
      requesterName,
      entityResolution,
      device,
      deviceDetails,
      loggedInUser,
      loggedInAt,
      inferredPhoneProvider,
      sourceFindings,
      itglueConfigs,
      docs: scopedDocs,
      ninjaChecks: scopedSignals.filter((signal) => signal.source === 'ninja'),
      missingData,
    });

    const networkStack = this.buildNetworkStackFromEnrichment(iterativeEnrichment.sections);

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
      ...(networkStack ? { network_stack: networkStack } : {}),
      source_findings: sourceFindings,
      entity_resolution: entityResolution,
      evidence_digest: evidenceDigest,
      rejected_evidence: rejectedEvidence,
      capability_verification: capabilityVerification,
      iterative_enrichment: iterativeEnrichment,
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
          os: this.resolveDeviceOsLabel(device, deviceDetails),
          last_seen:
            this.normalizeTimeValue(device.lastActivityTime || device.lastContact || deviceDetails?.lastContact) ||
            new Date().toISOString(),
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
        score: 0,
      };
    }

    const normalizedTicket = input.ticketText.toLowerCase();
    const requesterTokens = this.buildRequesterTokens(input.requesterName);
    const actorEmails = this.extractEmails(input.ticketText);
    const actorTokens = [...new Set([...requesterTokens, ...this.buildRequesterTokens(input.ticketText)])];
    const configHints = input.itglueConfigs
      .map((c: any) => String(c?.attributes?.hostname || c?.attributes?.name || '').toLowerCase())
      .filter(Boolean);

    // 1) Primary strategy: ticket actor identity x Ninja last logged-in user.
    // This must win over weak hostname/config correlations.
    const USER_CORRELATION_DEVICE_LIMIT = 60;
    const userCandidates = await Promise.all(
      input.devices.slice(0, USER_CORRELATION_DEVICE_LIMIT).map(async (device) => {
        let details: any = null;
        let loggedInAt = '';
        let loggedInUser = this.extractLoggedInUser(device) || '';
        if (!loggedInUser && device?.id) {
          const lastLogged = await this.resolveLastLoggedInContext(input.ninjaoneClient, String(device.id));
          loggedInUser = lastLogged.userName;
          loggedInAt = lastLogged.logonTime;
        }
        if (!loggedInUser && device?.id) {
          details = await input.ninjaoneClient.getDeviceDetails(String(device.id)).catch(() => null);
          loggedInUser = this.extractLoggedInUser(details) || '';
        }
        const userMatch = this.scoreLoggedInUserMatch({
          loggedInUser,
          actorEmails,
          actorTokens,
        });
        return {
          device,
          details,
          loggedInUser,
          loggedInAt,
          score: userMatch.score,
          reasons: userMatch.reasons,
        };
      })
    );
    const bestUserCandidate = userCandidates.sort((a, b) => b.score - a.score)[0];
    const MIN_USER_MATCH_SELECTION_SCORE = 0.6;
    if (bestUserCandidate && bestUserCandidate.score >= MIN_USER_MATCH_SELECTION_SCORE) {
      const selectedDevice = bestUserCandidate.device;
      const selectedDetails = bestUserCandidate.details ||
        (selectedDevice?.id
          ? await input.ninjaoneClient.getDeviceDetails(String(selectedDevice.id)).catch(() => null)
          : null);
      const [rawChecks] = selectedDevice?.id
        ? await Promise.all([
            input.ninjaoneClient.getDeviceChecks(String(selectedDevice.id)).catch(() => []),
          ])
        : [[]];
      const checks: Signal[] = rawChecks.map((check) => ({
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
      const resolvedLastLogged = selectedDevice?.id
        ? await this.resolveLastLoggedInContext(input.ninjaoneClient, String(selectedDevice.id))
        : { userName: '', logonTime: '' };
      const loggedInUser =
        bestUserCandidate.loggedInUser ||
        resolvedLastLogged.userName ||
        this.extractLoggedInUser(selectedDetails) ||
        '';
      return {
        device: selectedDevice,
        checks,
        loggedInUser,
        loggedInAt: bestUserCandidate.loggedInAt || resolvedLastLogged.logonTime || '',
        reason: `${bestUserCandidate.reasons.join(', ')}; score=${bestUserCandidate.score.toFixed(2)}`,
        strongMatch: true,
        score: bestUserCandidate.score,
        details: selectedDetails,
      };
    }

    // 2) Secondary strategy: hostname/config correlation.
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
        score: 0,
      };
    }
    const MIN_DEVICE_SELECTION_SCORE = 0.35;
    if (winner.score < MIN_DEVICE_SELECTION_SCORE) {
      return {
        device: null,
        checks: [],
        loggedInUser: '',
        reason: `no reliable device match; top score=${winner.score.toFixed(2)}`,
        strongMatch: false,
        score: winner.score,
      };
    }

    const strongMatch = winner.score >= 0.65;
    const selectedDevice = winner.device;

    let details: any = null;
    let loggedInUser = '';
    let loggedInAt = '';
    let checks: Signal[] = [];
    if (selectedDevice?.id) {
      const [rawChecks, rawDetails] = await Promise.all([
        input.ninjaoneClient.getDeviceChecks(String(selectedDevice.id)).catch(() => []),
        input.ninjaoneClient.getDeviceDetails(String(selectedDevice.id)).catch(() => null),
      ]);
      details = rawDetails;
      const lastLogged = await this.resolveLastLoggedInContext(input.ninjaoneClient, String(selectedDevice.id));
      loggedInAt = lastLogged.logonTime || '';
      loggedInUser =
        lastLogged.userName ||
        this.extractLoggedInUser(rawDetails) ||
        '';
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
      loggedInAt,
      reason,
      strongMatch,
      score: winner.score,
      details,
    };
  }

  private scoreLoggedInUserMatch(input: {
    loggedInUser: string;
    actorEmails: string[];
    actorTokens: string[];
  }): { score: number; reasons: string[] } {
    const logged = String(input.loggedInUser || '').trim().toLowerCase();
    if (!logged) {
      return { score: 0, reasons: [] };
    }
    let score = 0;
    const reasons: string[] = [];
    const loggedLocal = logged.includes('@') ? logged.split('@')[0] || logged : logged;
    const loggedParts = logged
      .split(/[\\\\/@._\\-\\s]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3);

    if (input.actorEmails.some((email) => email.toLowerCase() === logged)) {
      score = Math.max(score, 1);
      reasons.push('last logged-in user exact email match');
    } else if (input.actorEmails.some((email) => {
      const local = (email.split('@')[0] || '').toLowerCase();
      return local && (logged.includes(local) || loggedLocal === local);
    })) {
      score = Math.max(score, 0.8);
      reasons.push('last logged-in user local-part match');
    }

    if (input.actorTokens.some((token) => loggedParts.includes(token) || logged.includes(token))) {
      score = Math.max(score, score >= 0.8 ? score : 0.65);
      reasons.push('last logged-in user token match');
    }

    return { score: Number(score.toFixed(3)), reasons };
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
    const firstNameLabel = text.match(/(?:first\s*name|firstname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1];
    const lastNameLabel = text.match(/(?:last\s*name|lastname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1];
    const labeledFullName =
      firstNameLabel && lastNameLabel
        ? `${this.capitalize(firstNameLabel)} ${this.capitalize(lastNameLabel)}`
        : null;

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
        [labeledFullName || '', input.requesterName, ...properNames].filter(
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
        const normalizedContactCompany = this.normalizeName(
          String(attrs.organization_name || attrs.company_name || attrs.organization || '')
        ).toLowerCase();
        const exactName = normalizedRequester && name.toLowerCase() === normalizedRequester ? 0.4 : 0;
        const emailScore = emailMatches.includes(email) && email ? 0.3 : 0;
        const phoneScore = phoneMatches.some((p) => phone.includes(p) || p.includes(phone)) && phone ? 0.2 : 0;
        const companyScore =
          normalizedCompany && normalizedContactCompany && this.fuzzyMatch(normalizedCompany, normalizedContactCompany)
            ? 0.1
            : 0;
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

    const hasTicketContact =
      personCandidates.length > 0 &&
      (emailMatches.length > 0 || phoneMatches.length > 0);
    if (hasTicketContact) {
      const name = personCandidates[0] || 'Ticket Contact';
      const contactKey = (emailMatches[0] || phoneMatches[0] || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const resolvedActor: EntityResolution['resolved_actor'] = {
        id: `ticket-actor-${contactKey || 'unknown'}`,
        name,
        confidence: 'medium',
        ...(emailMatches[0] ? { email: emailMatches[0] } : {}),
        ...(phoneMatches[0] ? { phone: phoneMatches[0] } : {}),
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
      details?.system?.manufacturer ||
      device?.manufacturer ||
      device?.vendor ||
      ''
    ).trim();
    const model = String(
      details?.model ||
      details?.system?.model ||
      device?.model ||
      details?.systemModel ||
      ''
    ).trim();
    const serial = String(
      details?.serialNumber ||
      details?.serial ||
      details?.system?.serialNumber ||
      details?.system?.biosSerialNumber ||
      device?.serialNumber ||
      ''
    ).trim();
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
    if (!input.targetOrgId && input.itemOrgId) {
      return {
        accepted: false,
        rejected: {
          id: input.itemId,
          source: input.source,
          reason: 'invalid_source_scope',
          summary: `${input.summary} (target org unresolved)`,
          tenant_id: input.scopeMeta.tenant_id,
          org_id: input.itemOrgId,
          source_workspace: input.scopeMeta.source_workspace,
          evidence_score: 0,
        },
      };
    }
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
    inferredPhoneProvider: string | null;
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

    if (input.inferredPhoneProvider) {
      factsConfirmed.push({
        id: `fact-provider-${input.inferredPhoneProvider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        fact: `Detected telephony provider: ${input.inferredPhoneProvider}`,
        evidence_score: 0.75,
        evidence_refs: ['provider:telephony'],
        source: 'provider_inference',
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
      tech_context_detected: [
        ...new Set(
          input.facetContext.technology.concat(
            input.inferredPhoneProvider ? [`telephony_provider:${input.inferredPhoneProvider.toLowerCase()}`] : []
          )
        ),
      ],
      sources_consulted_by_facet: sourcesByFacet,
      rejected_evidence: input.rejectedEvidence,
      capability_verification: input.capabilityVerification,
    };
  }

  private buildIterativeEnrichmentProfile(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    companyName: string;
    inferredCompany: string;
    requesterName: string;
    entityResolution: EntityResolution;
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
    inferredPhoneProvider: string | null;
    sourceFindings: SourceFinding[];
    itglueConfigs: any[];
    docs: Doc[];
    ninjaChecks: Signal[];
    missingData: Array<{ field: string; why: string }>;
  }): IterativeEnrichmentProfile {
    const ticketSection = this.buildTicketEnrichmentSection({
      ticket: input.ticket,
      companyName: input.companyName,
      inferredCompany: input.inferredCompany,
      requesterName: input.requesterName,
      entityResolution: input.entityResolution,
    });
    const identitySection = this.buildIdentityEnrichmentSection(input.entityResolution);
    const endpointSection = this.buildEndpointEnrichmentSection({
      ticketNarrative: input.ticketNarrative,
      device: input.device,
      deviceDetails: input.deviceDetails,
      loggedInUser: input.loggedInUser,
      loggedInAt: input.loggedInAt,
      ninjaChecks: input.ninjaChecks,
    });
    const networkSection = this.buildNetworkEnrichmentSection({
      ticketNarrative: input.ticketNarrative,
      device: input.device,
      deviceDetails: input.deviceDetails,
      docs: input.docs,
      itglueConfigs: input.itglueConfigs,
      ninjaChecks: input.ninjaChecks,
      inferredPhoneProvider: input.inferredPhoneProvider,
    });
    const infraSection = this.buildInfraEnrichmentSection({
      itglueConfigs: input.itglueConfigs,
      docs: input.docs,
    });

    const sections: IterativeEnrichmentSections = {
      ticket: ticketSection,
      identity: identitySection,
      endpoint: endpointSection,
      network: networkSection,
      infra: infraSection,
    };

    const fieldRecords = this.flattenEnrichmentFields(sections);
    const coverage = this.computeEnrichmentCoverage(fieldRecords);
    const rounds = this.buildEnrichmentRounds(fieldRecords, input.sourceFindings);
    const lastRound = rounds.at(-1);
    const completedRounds = lastRound?.round ?? 1;
    const lastRoundGain = lastRound?.gain_count ?? 0;

    let stopReason: IterativeEnrichmentProfile['stop_reason'] = 'source_exhausted';
    if (completedRounds >= 5) {
      stopReason = 'max_rounds_reached';
    } else if (coverage.completion_ratio >= 0.85) {
      stopReason = 'coverage_target_reached';
    } else if (lastRoundGain <= 1 || input.missingData.length > 0) {
      stopReason = 'marginal_gain';
    }

    return {
      schema_version: '1.0.0',
      completed_rounds: completedRounds,
      stop_reason: stopReason,
      rounds,
      sections,
      coverage,
    };
  }

  private buildTicketEnrichmentSection(input: {
    ticket: TicketLike;
    companyName: string;
    inferredCompany: string;
    requesterName: string;
    entityResolution: EntityResolution;
  }): IterativeEnrichmentSections['ticket'] {
    const ticketId = String(input.ticket.ticketNumber || input.ticket.id || '').trim();
    const requesterFromTicket = this.normalizeName(
      input.ticket.canonicalRequesterName || input.ticket.requester || input.requesterName || ''
    );
    const requesterEmailFromTicket = String(
      input.ticket.canonicalRequesterEmail || this.extractFirstEmail(input.ticket.requester || '')
    ).trim();
    const extractedEmail = input.entityResolution.extracted_entities.email[0] || '';
    const requesterEmail = requesterEmailFromTicket || extractedEmail || '';

    const resolvedActor = input.entityResolution.resolved_actor;
    const affectedName = this.normalizeName(
      input.ticket.canonicalAffectedName || resolvedActor?.name || requesterFromTicket || 'unknown'
    );
    const affectedEmail = String(
      input.ticket.canonicalAffectedEmail || resolvedActor?.email || requesterEmail || 'unknown'
    ).trim();

    const companyFromTicket = this.normalizeName(input.ticket.company || '');
    const companyValue = companyFromTicket || input.companyName || input.inferredCompany || 'unknown';
    const companyStatus = companyFromTicket
      ? 'confirmed'
      : companyValue !== 'unknown'
        ? 'inferred'
        : 'unknown';

    const actorRound = resolvedActor ? 3 : 1;
    const actorStatus = resolvedActor
      ? resolvedActor.confidence === 'strong'
        ? 'confirmed'
        : 'inferred'
      : requesterFromTicket
        ? 'inferred'
        : 'unknown';

    return {
      ticket_id: this.buildField({
        value: ticketId || 'unknown',
        status: ticketId ? 'confirmed' : 'unknown',
        confidence: ticketId ? 1 : 0,
        sourceSystem: 'ticket',
        sourceRef: 'ticket.id',
        round: 1,
      }),
      company: this.buildField({
        value: companyValue,
        status: companyStatus,
        confidence: companyStatus === 'confirmed' ? 1 : companyStatus === 'inferred' ? 0.7 : 0,
        sourceSystem: companyFromTicket ? 'ticket' : companyValue !== 'unknown' ? 'ticket_narrative' : 'unknown',
        sourceRef: companyFromTicket ? 'ticket.company' : companyValue !== 'unknown' ? 'ticket.domain_inference' : undefined,
        round: 1,
      }),
      requester_name: this.buildField({
        value: requesterFromTicket || 'unknown',
        status: requesterFromTicket ? 'confirmed' : 'unknown',
        confidence: requesterFromTicket ? 0.95 : 0,
        sourceSystem: input.ticket.canonicalRequesterName ? 'entity_resolution' : requesterFromTicket ? 'ticket' : 'unknown',
        sourceRef: input.ticket.canonicalRequesterName ? 'round0.canonical_requester' : requesterFromTicket ? 'ticket.requester' : undefined,
        round: 1,
      }),
      requester_email: this.buildField({
        value: requesterEmail || 'unknown',
        status: requesterEmailFromTicket ? 'confirmed' : requesterEmail ? 'inferred' : 'unknown',
        confidence: requesterEmailFromTicket ? 0.95 : requesterEmail ? 0.65 : 0,
        sourceSystem: input.ticket.canonicalRequesterEmail ? 'entity_resolution' : requesterEmailFromTicket ? 'ticket' : requesterEmail ? 'entity_resolution' : 'unknown',
        sourceRef: input.ticket.canonicalRequesterEmail ? 'round0.canonical_requester' : requesterEmailFromTicket ? 'ticket.requester' : requesterEmail ? 'entity_resolution.extracted_entities.email[0]' : undefined,
        round: input.ticket.canonicalRequesterEmail ? 0 : requesterEmailFromTicket ? 1 : requesterEmail ? 2 : 1,
      }),
      affected_user_name: this.buildField({
        value: affectedName,
        status: actorStatus,
        confidence: actorStatus === 'confirmed' ? 0.95 : actorStatus === 'inferred' ? 0.65 : 0,
        sourceSystem: input.ticket.canonicalAffectedName ? 'entity_resolution' : resolvedActor ? 'entity_resolution' : requesterFromTicket ? 'ticket' : 'unknown',
        sourceRef: input.ticket.canonicalAffectedName ? 'round0.canonical_affected' : resolvedActor ? 'entity_resolution.resolved_actor.name' : requesterFromTicket ? 'ticket.requester' : undefined,
        round: input.ticket.canonicalAffectedName ? 0 : actorRound,
      }),
      affected_user_email: this.buildField({
        value: affectedEmail,
        status: resolvedActor?.email
          ? resolvedActor.confidence === 'strong'
            ? 'confirmed'
            : 'inferred'
          : requesterEmail
            ? 'inferred'
            : 'unknown',
        confidence: resolvedActor?.email
          ? resolvedActor.confidence === 'strong'
            ? 0.95
            : 0.7
          : requesterEmail
            ? 0.6
            : 0,
        sourceSystem: input.ticket.canonicalAffectedEmail ? 'entity_resolution' : resolvedActor?.email ? 'entity_resolution' : requesterEmail ? 'ticket' : 'unknown',
        sourceRef: input.ticket.canonicalAffectedEmail ? 'round0.canonical_affected' : resolvedActor?.email ? 'entity_resolution.resolved_actor.email' : requesterEmail ? 'ticket.requester' : undefined,
        round: input.ticket.canonicalAffectedEmail ? 0 : resolvedActor?.email ? actorRound : requesterEmail ? 1 : 1,
      }),
      created_at: this.buildField({
        value: String(input.ticket.createDate || '').trim() || 'unknown',
        status: input.ticket.createDate ? 'confirmed' : 'unknown',
        confidence: input.ticket.createDate ? 0.95 : 0,
        sourceSystem: input.ticket.createDate ? 'ticket' : 'unknown',
        sourceRef: input.ticket.createDate ? 'ticket.createDate' : undefined,
        round: 1,
      }),
      title: this.buildField({
        value: String(input.ticket.title || '').trim() || 'unknown',
        status: input.ticket.title ? 'confirmed' : 'unknown',
        confidence: input.ticket.title ? 0.95 : 0,
        sourceSystem: input.ticket.title ? 'ticket' : 'unknown',
        sourceRef: input.ticket.title ? 'ticket.title' : undefined,
        round: 1,
      }),
      description_clean: this.buildField({
        value: String(input.ticket.description || '').trim() || 'unknown',
        status: input.ticket.description ? 'confirmed' : 'unknown',
        confidence: input.ticket.description ? 0.9 : 0,
        sourceSystem: input.ticket.description ? 'ticket' : 'unknown',
        sourceRef: input.ticket.description ? 'ticket.description' : undefined,
        round: 1,
      }),
    };
  }

  private buildIdentityEnrichmentSection(
    entityResolution: EntityResolution
  ): IterativeEnrichmentSections['identity'] {
    const resolvedEmail = entityResolution.resolved_actor?.email || '';
    const extractedEmail = entityResolution.extracted_entities.email[0] || '';
    const principal = resolvedEmail || extractedEmail || 'unknown';
    const hasStrongResolvedEmail =
      Boolean(resolvedEmail) && entityResolution.resolved_actor?.confidence === 'strong';

    return {
      user_principal_name: this.buildField({
        value: principal,
        status: hasStrongResolvedEmail ? 'confirmed' : principal !== 'unknown' ? 'inferred' : 'unknown',
        confidence: hasStrongResolvedEmail ? 0.9 : principal !== 'unknown' ? 0.6 : 0,
        sourceSystem: resolvedEmail ? 'entity_resolution' : extractedEmail ? 'ticket_narrative' : 'unknown',
        sourceRef: resolvedEmail
          ? 'entity_resolution.resolved_actor.email'
          : extractedEmail
            ? 'entity_resolution.extracted_entities.email[0]'
            : undefined,
        round: resolvedEmail ? 3 : extractedEmail ? 2 : 1,
      }),
      account_status: this.buildField({
        value: 'unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      mfa_state: this.buildField({
        value: 'unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      licenses_summary: this.buildField({
        value: 'Unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      groups_top: this.buildField({
        value: 'unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
    };
  }

  private buildEndpointEnrichmentSection(input: {
    ticketNarrative: string;
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
    ninjaChecks: Signal[];
  }): IterativeEnrichmentSections['endpoint'] {
    const deviceName = String(
      input.device?.hostname || input.device?.systemName || input.device?.id || ''
    ).trim();
    const deviceType = this.inferDeviceType({
      ticketNarrative: input.ticketNarrative,
      device: input.device,
      deviceDetails: input.deviceDetails,
    });
    const osName = String(
      input.device?.osName ||
      input.deviceDetails?.osName ||
      input.deviceDetails?.os?.name ||
      ''
    ).trim();
    const osVersion = String(
      input.device?.osVersion ||
      input.deviceDetails?.osVersion ||
      [input.deviceDetails?.os?.buildNumber, input.deviceDetails?.os?.releaseId].filter(Boolean).join(' / ') ||
      ''
    ).trim();
    const lastCheckIn = this.normalizeTimeValue(
      input.device?.lastActivityTime ||
      input.device?.lastContact ||
      input.deviceDetails?.lastContact ||
      input.deviceDetails?.lastUpdate ||
      ''
    );
    const securityAgent = this.inferSecurityAgent(input.ninjaChecks, input.deviceDetails);

    return {
      device_name: this.buildField({
        value: deviceName || 'unknown',
        status: deviceName ? 'confirmed' : 'unknown',
        confidence: deviceName ? 0.85 : 0,
        sourceSystem: deviceName ? 'ninjaone' : 'unknown',
        sourceRef: deviceName ? 'ninja.device.hostname' : undefined,
        round: 1,
      }),
      device_type: this.buildField({
        value: deviceType,
        status: deviceType !== 'unknown' ? 'inferred' : 'unknown',
        confidence: deviceType !== 'unknown' ? 0.65 : 0,
        sourceSystem: deviceType !== 'unknown' ? 'ninjaone' : 'unknown',
        sourceRef: deviceType !== 'unknown' ? 'ninja.device.os/type_heuristic' : undefined,
        round: 1,
      }),
      os_name: this.buildField({
        value: osName || 'unknown',
        status: osName ? 'confirmed' : 'unknown',
        confidence: osName ? 0.8 : 0,
        sourceSystem: osName ? 'ninjaone' : 'unknown',
        sourceRef: osName ? 'ninja.device.osName/os.name' : undefined,
        round: 1,
      }),
      os_version: this.buildField({
        value: osVersion || 'unknown',
        status: osVersion ? 'confirmed' : 'unknown',
        confidence: osVersion ? 0.75 : 0,
        sourceSystem: osVersion ? 'ninjaone' : 'unknown',
        sourceRef: osVersion ? 'ninja.device.osVersion/os.buildNumber+releaseId' : undefined,
        round: 1,
      }),
      last_check_in: this.buildField({
        value: lastCheckIn || 'unknown',
        status: lastCheckIn ? 'confirmed' : 'unknown',
        confidence: lastCheckIn ? 0.85 : 0,
        sourceSystem: lastCheckIn ? 'ninjaone' : 'unknown',
        sourceRef: lastCheckIn ? 'ninja.device.lastActivityTime' : undefined,
        round: 1,
      }),
      security_agent: this.buildField({
        value: securityAgent,
        status: securityAgent.state === 'unknown' ? 'unknown' : 'inferred',
        confidence: securityAgent.state === 'present' ? 0.7 : securityAgent.state === 'absent' ? 0.45 : 0,
        sourceSystem: securityAgent.state === 'unknown' ? 'unknown' : 'ninjaone',
        sourceRef: securityAgent.state === 'unknown' ? undefined : 'ninja.device.checks',
        round: 1,
      }),
      user_signed_in: this.buildField({
        value: input.loggedInUser || 'unknown',
        status: input.loggedInUser ? 'inferred' : 'unknown',
        confidence: input.loggedInUser ? 0.7 : 0,
        sourceSystem: input.loggedInUser ? 'ninjaone' : 'unknown',
        sourceRef: input.loggedInUser ? 'ninja.device.last-logged-on-user' : undefined,
        round: input.loggedInUser ? 3 : 1,
      }),
      user_signed_in_at: this.buildField({
        value: input.loggedInAt || (input.loggedInUser && lastCheckIn ? lastCheckIn : 'unknown'),
        status: input.loggedInAt || (input.loggedInUser && lastCheckIn) ? 'inferred' : 'unknown',
        confidence: input.loggedInAt || (input.loggedInUser && lastCheckIn) ? 0.7 : 0,
        sourceSystem: input.loggedInAt || input.loggedInUser ? 'ninjaone' : 'unknown',
        sourceRef: input.loggedInAt ? 'ninja.device.last-logged-on-user.logonTime' : input.loggedInUser && lastCheckIn ? 'ninja.device.lastActivityTime' : undefined,
        round: input.loggedInUser ? 3 : 1,
      }),
    };
  }

  private buildNetworkEnrichmentSection(input: {
    ticketNarrative: string;
    device: any | null;
    deviceDetails: any | null;
    docs: Doc[];
    itglueConfigs: any[];
    ninjaChecks: Signal[];
    inferredPhoneProvider: string | null;
  }): IterativeEnrichmentSections['network'] {
    const locationContext = this.inferLocationContext(input.ticketNarrative);
    const publicIp = this.resolvePublicIp(input.device, input.deviceDetails);
    const ispName = this.inferIspName({
      ticketNarrative: input.ticketNarrative,
      docs: input.docs,
      itglueConfigs: input.itglueConfigs,
    });
    const vpnState = this.inferVpnState(input.ninjaChecks, input.ticketNarrative);
    const phoneProviderConnected = Boolean(input.inferredPhoneProvider);

    return {
      location_context: this.buildField({
        value: locationContext,
        status: locationContext === 'unknown' ? 'unknown' : 'inferred',
        confidence: locationContext === 'unknown' ? 0 : 0.65,
        sourceSystem: locationContext === 'unknown' ? 'unknown' : 'ticket_narrative',
        sourceRef: locationContext === 'unknown' ? undefined : 'ticket.text',
        round: 1,
      }),
      public_ip: this.buildField({
        value: publicIp || 'unknown',
        status: publicIp ? 'confirmed' : 'unknown',
        confidence: publicIp ? 0.9 : 0,
        sourceSystem: publicIp ? 'ninjaone' : 'unknown',
        sourceRef: publicIp ? 'ninja.device.publicIP/ipAddresses' : undefined,
        round: 1,
      }),
      isp_name: this.buildField({
        value: ispName || 'unknown',
        status: ispName ? 'inferred' : 'unknown',
        confidence: ispName ? 0.6 : 0,
        sourceSystem: ispName ? 'cross_correlation' : 'unknown',
        sourceRef: ispName ? 'ticket/docs/itglue keyword' : undefined,
        round: ispName ? 2 : 1,
      }),
      vpn_state: this.buildField({
        value: vpnState,
        status: vpnState === 'unknown' ? 'unknown' : 'inferred',
        confidence: vpnState === 'connected' ? 0.7 : vpnState === 'disconnected' ? 0.6 : 0,
        sourceSystem: vpnState === 'unknown' ? 'unknown' : 'ninjaone',
        sourceRef: vpnState === 'unknown' ? undefined : 'ninja.checks:vpn',
        round: 1,
      }),
      phone_provider: this.buildField({
        value: phoneProviderConnected ? 'connected' : 'unknown',
        status: phoneProviderConnected ? 'inferred' : 'unknown',
        confidence: phoneProviderConnected ? 0.7 : 0,
        sourceSystem: phoneProviderConnected ? 'provider_inference' : 'unknown',
        sourceRef: phoneProviderConnected ? 'ticket/docs/configs/signals' : undefined,
        round: 1,
      }),
      phone_provider_name: this.buildField({
        value: input.inferredPhoneProvider || 'unknown',
        status: input.inferredPhoneProvider ? 'inferred' : 'unknown',
        confidence: input.inferredPhoneProvider ? 0.75 : 0,
        sourceSystem: input.inferredPhoneProvider ? 'provider_inference' : 'unknown',
        sourceRef: input.inferredPhoneProvider ? 'provider.keyword_match' : undefined,
        round: 1,
      }),
    };
  }

  private buildInfraEnrichmentSection(input: {
    itglueConfigs: any[];
    docs: Doc[];
  }): IterativeEnrichmentSections['infra'] {
    const firewall = this.extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
    const wifi = this.extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
    const sw = this.extractInfraMakeModel('switch', input.itglueConfigs, input.docs);

    return {
      firewall_make_model: this.buildField({
        value: firewall.value,
        status: firewall.status,
        confidence: firewall.confidence,
        sourceSystem: firewall.sourceSystem,
        sourceRef: firewall.sourceRef,
        round: firewall.round,
      }),
      wifi_make_model: this.buildField({
        value: wifi.value,
        status: wifi.status,
        confidence: wifi.confidence,
        sourceSystem: wifi.sourceSystem,
        sourceRef: wifi.sourceRef,
        round: wifi.round,
      }),
      switch_make_model: this.buildField({
        value: sw.value,
        status: sw.status,
        confidence: sw.confidence,
        sourceSystem: sw.sourceSystem,
        sourceRef: sw.sourceRef,
        round: sw.round,
      }),
    };
  }

  private buildNetworkStackFromEnrichment(
    sections: IterativeEnrichmentSections
  ): EvidencePack['network_stack'] | undefined {
    const stack: NonNullable<EvidencePack['network_stack']> = {};

    const isp = String(sections.network.isp_name.value || '').trim();
    if (isp && isp.toLowerCase() !== 'unknown') {
      stack.isp = isp;
    }

    const firewall = this.parseMakeModel(String(sections.infra.firewall_make_model.value || ''));
    if (firewall) {
      stack.firewall = firewall;
    }

    const wifi = this.parseMakeModel(String(sections.infra.wifi_make_model.value || ''));
    if (wifi) {
      stack.aps = [{ vendor: wifi.vendor, model: wifi.model }];
    }

    const sw = this.parseMakeModel(String(sections.infra.switch_make_model.value || ''));
    if (sw) {
      stack.switches = [{ vendor: sw.vendor, model: sw.model }];
    }

    if (!stack.isp && !stack.firewall && !stack.aps?.length && !stack.switches?.length) {
      return undefined;
    }

    return stack;
  }

  private parseMakeModel(value: string): { vendor: string; model: string } | null {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.toLowerCase() === 'unknown') return null;
    const parts = normalized.split(/\s+/).filter(Boolean);
    const vendor = parts[0];
    if (!vendor) return null;
    if (parts.length === 1) {
      return { vendor, model: vendor };
    }
    return {
      vendor,
      model: parts.slice(1).join(' '),
    };
  }

  private flattenEnrichmentFields(
    sections: IterativeEnrichmentSections
  ): Array<{ path: string; field: EnrichmentField<unknown> }> {
    const output: Array<{ path: string; field: EnrichmentField<unknown> }> = [];
    for (const [sectionKey, sectionValue] of Object.entries(sections) as Array<
      [string, Record<string, EnrichmentField<unknown>>]
    >) {
      for (const [fieldKey, fieldValue] of Object.entries(sectionValue)) {
        output.push({
          path: `${sectionKey}.${fieldKey}`,
          field: fieldValue,
        });
      }
    }
    return output;
  }

  private computeEnrichmentCoverage(
    records: Array<{ path: string; field: EnrichmentField<unknown> }>
  ): IterativeEnrichmentProfile['coverage'] {
    const total = records.length || 1;
    const confirmed = records.filter((record) => record.field.status === 'confirmed').length;
    const inferred = records.filter((record) => record.field.status === 'inferred').length;
    const unknown = records.filter((record) => record.field.status === 'unknown').length;
    const conflict = records.filter((record) => record.field.status === 'conflict').length;
    return {
      total,
      confirmed,
      inferred,
      unknown,
      conflict,
      completion_ratio: Number(((confirmed + inferred) / total).toFixed(3)),
    };
  }

  private buildEnrichmentRounds(
    records: Array<{ path: string; field: EnrichmentField<unknown> }>,
    sourceFindings: SourceFinding[]
  ): IterativeEnrichmentProfile['rounds'] {
    const maxRound = Math.max(
      1,
      ...records.map((record) => Number(record.field.round || 1)),
      ...sourceFindings.map((finding) => Number(finding.round || 0))
    );
    const rounds: IterativeEnrichmentProfile['rounds'] = [];
    for (let round = 1; round <= maxRound; round += 1) {
      const roundRecords = records.filter((record) => Number(record.field.round || 1) === round);
      const roundFindings = sourceFindings.filter((finding) => Number(finding.round || 0) === round);
      if (roundRecords.length === 0 && roundFindings.length === 0) {
        continue;
      }
      const confirmed = roundRecords
        .filter((record) => record.field.status === 'confirmed')
        .map((record) => record.path);
      const inferred = roundRecords
        .filter((record) => record.field.status === 'inferred')
        .map((record) => record.path);
      const unknown = roundRecords
        .filter((record) => record.field.status === 'unknown')
        .map((record) => record.path);
      rounds.push({
        round,
        label: this.roundLabel(round),
        sources_consulted: [...new Set(roundFindings.map((finding) => finding.source))],
        new_fields_confirmed: confirmed,
        new_fields_inferred: inferred,
        new_fields_unknown: unknown,
        gain_count: confirmed.length + inferred.length,
      });
    }
    return rounds;
  }

  private roundLabel(round: number): string {
    if (round === 1) return 'intake_to_org_cross';
    if (round === 2) return 'history_correlation';
    if (round === 3) return 'identity_endpoint_refinement';
    if (round === 4) return 'external_refinement';
    if (round === 5) return 'final_reconciliation';
    return `round_${round}`;
  }

  private buildField<T>(input: {
    value: T;
    status: EnrichmentField<T>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string | undefined;
    round: number;
    observedAt?: string | undefined;
  }): EnrichmentField<T> {
    const safeConfidence = Number(Math.max(0, Math.min(1, input.confidence)).toFixed(3));
    return {
      value: input.value,
      status: input.status,
      confidence: safeConfidence,
      source_system: input.sourceSystem,
      ...(input.sourceRef ? { source_ref: input.sourceRef } : {}),
      observed_at: input.observedAt || new Date().toISOString(),
      round: input.round,
    };
  }

  private inferDeviceType(input: {
    ticketNarrative: string;
    device: any | null;
    deviceDetails: any | null;
  }): 'desktop' | 'laptop' | 'mobile' | 'unknown' {
    const nodeClass = String(input.device?.nodeClass || input.deviceDetails?.nodeClass || '').toLowerCase();
    const chassis = String(input.deviceDetails?.system?.chassisType || '').toLowerCase();
    if (/(laptop|notebook)/.test(chassis)) return 'laptop';
    if (/(windows_workstation|linux_workstation|mac)/.test(nodeClass)) return 'desktop';
    if (/(android|apple_ios|apple_ipados)/.test(nodeClass)) return 'mobile';

    const source = [
      input.ticketNarrative,
      String(input.device?.osName || ''),
      String(input.device?.nodeClass || ''),
      String(input.device?.model || ''),
      String(input.deviceDetails?.system?.chassisType || ''),
      String(input.deviceDetails?.system?.model || ''),
      String(input.deviceDetails?.model || ''),
      String(input.deviceDetails?.systemModel || ''),
    ]
      .join(' ')
      .toLowerCase();
    if (/(iphone|android|ipad|mobile|cell)/i.test(source)) return 'mobile';
    if (/(laptop|notebook|macbook|thinkpad|latitude|elitebook|probook)/i.test(source)) return 'laptop';
    if (/(desktop|workstation|tower|optiplex|prodesk)/i.test(source)) return 'desktop';
    return 'unknown';
  }

  private inferSecurityAgent(checks: Signal[], deviceDetails: any): SecurityAgentSummary {
    const sourceText = [
      ...checks.map((check) => check.summary || ''),
      JSON.stringify(deviceDetails || {}),
    ]
      .join(' ')
      .toLowerCase();

    const knownAgents: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Microsoft Defender', pattern: /\bdefender\b/ },
      { name: 'CrowdStrike', pattern: /\bcrowdstrike\b/ },
      { name: 'SentinelOne', pattern: /\bsentinelone\b/ },
      { name: 'Sophos', pattern: /\bsophos\b/ },
      { name: 'Bitdefender', pattern: /\bbitdefender\b/ },
      { name: 'Trend Micro', pattern: /\btrend\s?micro\b/ },
      { name: 'Carbon Black', pattern: /\bcarbon\s?black\b/ },
    ];

    const detected = knownAgents.find((agent) => agent.pattern.test(sourceText));
    if (detected) {
      return { state: 'present', name: detected.name };
    }

    if (
      /(antivirus|endpoint security|edr|xdr)/i.test(sourceText) &&
      /(disabled|inactive|not installed|missing|stopped|failed)/i.test(sourceText)
    ) {
      return { state: 'absent', name: 'Unknown' };
    }

    return { state: 'unknown', name: 'Unknown' };
  }

  private inferLocationContext(
    ticketNarrative: string
  ): 'office' | 'remote' | 'unknown' {
    const source = String(ticketNarrative || '').toLowerCase();
    if (/(home|remote|offsite|work from home|wfh|vpn)/i.test(source)) return 'remote';
    if (/(office|onsite|on-site|conference room|headquarters|hq)/i.test(source)) return 'office';
    return 'unknown';
  }

  private inferVpnState(
    ninjaChecks: Signal[],
    ticketNarrative: string
  ): 'connected' | 'disconnected' | 'unknown' {
    const vpnChecks = ninjaChecks.filter((check) => /vpn/i.test(check.summary || check.type || ''));
    if (vpnChecks.length > 0) {
      const combined = vpnChecks.map((check) => `${check.type} ${check.summary}`.toLowerCase()).join(' ');
      if (/passed|ok|connected|up/.test(combined)) return 'connected';
      if (/failed|warn|down|disconnected|error/.test(combined)) return 'disconnected';
    }
    if (/vpn/i.test(ticketNarrative || '')) return 'unknown';
    return 'unknown';
  }

  private resolvePublicIp(device: any, deviceDetails: any): string {
    const candidates = [
      String(device?.ipAddress || ''),
      String(device?.publicIP || ''),
      String(deviceDetails?.publicIp || ''),
      String(deviceDetails?.publicIP || ''),
      String(deviceDetails?.public_ip || ''),
      String(deviceDetails?.wanIp || ''),
      String(deviceDetails?.wan_ip || ''),
      ...(Array.isArray(deviceDetails?.ipAddresses) ? deviceDetails.ipAddresses.map((ip: unknown) => String(ip || '')) : []),
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    const publicIp = candidates.find((value) => this.isPublicIPv4(value));
    return publicIp || '';
  }

  private normalizeTimeValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') {
      const millis = value > 1e12 ? value : value > 1e9 ? value * 1000 : value;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }
    const text = String(value).trim();
    if (!text) return '';
    const numeric = Number(text);
    if (!Number.isNaN(numeric)) return this.normalizeTimeValue(numeric);
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toISOString();
  }

  private isPublicIPv4(value: string): boolean {
    const match = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
    if (!match) return false;
    const octets = value.split('.').map((part) => Number(part));
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
    if (first === 10) return false;
    if (first === 127) return false;
    if (first === 192 && second === 168) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    return true;
  }

  private inferIspName(input: {
    ticketNarrative: string;
    docs: Doc[];
    itglueConfigs: any[];
  }): string {
    const sourceText = [
      input.ticketNarrative,
      ...input.docs.map((doc) => `${doc.title} ${doc.snippet}`),
      ...input.itglueConfigs.map((cfg) => JSON.stringify(cfg?.attributes || {})),
    ]
      .join(' ')
      .toLowerCase();
    const providers: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Comcast', pattern: /\bcomcast\b|\bxfinity\b/ },
      { name: 'AT&T', pattern: /\bat&t\b|\batt\b/ },
      { name: 'Verizon', pattern: /\bverizon\b/ },
      { name: 'Spectrum', pattern: /\bspectrum\b|\bcharter\b/ },
      { name: 'Cox', pattern: /\bcox\b/ },
      { name: 'Frontier', pattern: /\bfrontier\b/ },
      { name: 'Lumen/CenturyLink', pattern: /\bcenturylink\b|\blumen\b/ },
      { name: 'Optimum', pattern: /\boptimum\b|\baltice\b/ },
    ];
    const found = providers.find((provider) => provider.pattern.test(sourceText));
    return found ? found.name : '';
  }

  private extractInfraMakeModel(
    kind: 'firewall' | 'wifi' | 'switch',
    configs: any[],
    docs: Doc[]
  ): {
    value: string;
    status: EnrichmentField<string>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string;
    round: number;
  } {
    const configMatchers: Record<'firewall' | 'wifi' | 'switch', RegExp> = {
      firewall: /\bfirewall\b|\bfortigate\b|\bfortinet\b|\bsonicwall\b|\bpalo\s?alto\b|\bwatchguard\b|\bmx\d+\b/i,
      wifi: /\bwifi\b|\bwireless\b|\baccess\s?point\b|\bap\b|\bmeraki\s?mr\b|\bunifi\b|\baruba\b|\bruckus\b/i,
      switch: /\bswitch\b|\bcatalyst\b|\bprocurve\b|\baruba\b|\bnetgear\b|\bunifi\s?switch\b/i,
    };

    for (const config of configs) {
      const attrs = config?.attributes || {};
      const text = JSON.stringify(attrs);
      if (!configMatchers[kind].test(text)) continue;
      const vendor = String(attrs.manufacturer || attrs.vendor || attrs.brand || '').trim();
      const model = String(attrs.model || attrs.product_model || '').trim();
      const name = String(attrs.name || attrs.hostname || '').trim();
      const value = [vendor, model].filter(Boolean).join(' ').trim() || name || 'unknown';
      if (!value || value === 'unknown') continue;
      return {
        value,
        status: 'confirmed',
        confidence: 0.8,
        sourceSystem: 'itglue',
        sourceRef: `itglue_config:${String(config?.id || name || 'unknown')}`,
        round: 1,
      };
    }

    for (const doc of docs) {
      const text = `${doc.title} ${doc.snippet}`;
      if (!configMatchers[kind].test(text)) continue;
      return {
        value: String(doc.title || 'unknown').trim() || 'unknown',
        status: 'inferred',
        confidence: 0.55,
        sourceSystem: 'itglue',
        sourceRef: `itglue_doc:${doc.id}`,
        round: 2,
      };
    }

    return {
      value: 'unknown',
      status: 'unknown',
      confidence: 0,
      sourceSystem: 'unknown',
      round: 1,
    };
  }

  private extractEmails(text: string): string[] {
    return [
      ...new Set(
        (String(text || '')
          .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
          .map((value) => value.toLowerCase())
      ),
    ];
  }

  private extractFirstEmail(text: string): string {
    return this.extractEmails(text)[0] || '';
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

  private capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  private inferCompanyNameFromTicketText(text: string): string {
    const domains = this.extractEmailDomains(text || '');
    if (!domains.length) return '';

    const domain = String(domains[0] || '').toLowerCase();
    const root = domain.split('.')[0] || '';
    if (!root) return '';

    // Split common business suffixes when domain is concatenated (e.g. stintinomanagement)
    const suffixes = [
      'management',
      'homes',
      'technologies',
      'technology',
      'solutions',
      'support',
      'services',
      'group',
      'partners',
      'consulting',
      'systems',
      'security',
      'health',
      'care',
      'logistics',
      'holdings',
      'capital',
    ];

    let normalized = root.replace(/[-_]+/g, ' ');
    for (const suffix of suffixes) {
      const idx = normalized.indexOf(suffix);
      if (idx > 0) {
        normalized = `${normalized.slice(0, idx)} ${suffix}`;
        break;
      }
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized
      .split(' ')
      .filter(Boolean)
      .map((part) => this.capitalize(part))
      .join(' ');
  }

  private buildTicketNarrative(ticket: TicketLike): string {
    const updatesText = (ticket.updates || [])
      .map((u) => String(u?.content || '').trim())
      .filter(Boolean)
      .slice(0, 6)
      .join('\n');
    return [
      ticket.title || '',
      ticket.description || '',
      ticket.company || '',
      ticket.requester || '',
      ticket.rawBody || '',
      updatesText,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async normalizeTicketForPipeline(ticket: TicketLike): Promise<{
    title: string;
    descriptionClean: string;
    requesterName: string;
    requesterEmail: string;
    affectedUserName: string;
    affectedUserEmail: string;
    method: 'llm' | 'deterministic_fallback';
    confidence: number;
  }> {
    const narrative = this.buildTicketNarrative(ticket);
    const fallback = this.normalizeTicketDeterministically(ticket.title || '', narrative);

    try {
      const prompt = `Normalize this IT support ticket text and return ONLY valid JSON.

Rules:
- Keep only relevant support information.
- Remove signatures, legal disclaimers, portal boilerplate, and phishing warnings.
- Preserve concrete facts: people, emails, phones, issue, symptoms, constraints, requested confirmation.
- Keep output concise and factual.

Output JSON schema:
{
  "title": "string",
  "description_clean": "string",
  "requester_name": "string",
  "requester_email": "string",
  "affected_user_name": "string",
  "affected_user_email": "string",
  "confidence": 0.0
}

Ticket text:
"""${narrative.slice(0, 12000)}"""`;

      const llm = await callLLM(prompt);
      const parsed = this.extractJsonObject(llm.content);
      const title = String(parsed?.title || '').trim();
      const descriptionClean = String(parsed?.description_clean || '').trim();
      const requesterName = this.normalizeName(String(parsed?.requester_name || '').trim());
      const requesterEmail = String(parsed?.requester_email || '').trim().toLowerCase();
      const affectedUserName = this.normalizeName(String(parsed?.affected_user_name || '').trim());
      const affectedUserEmail = String(parsed?.affected_user_email || '').trim().toLowerCase();
      const confidenceRaw = Number(parsed?.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.75;

      if (descriptionClean.length >= 40) {
        const canonicalRequesterEmail = requesterEmail || this.extractFirstEmail(ticket.requester || '') || this.extractFirstEmail(narrative);
        const canonicalRequesterName = requesterName || this.normalizeName(ticket.requester || '') || '';
        const canonicalAffectedName = affectedUserName || canonicalRequesterName || '';
        const canonicalAffectedEmail = affectedUserEmail || canonicalRequesterEmail || '';
        return {
          title: title || fallback.title,
          descriptionClean,
          requesterName: canonicalRequesterName,
          requesterEmail: canonicalRequesterEmail,
          affectedUserName: canonicalAffectedName,
          affectedUserEmail: canonicalAffectedEmail,
          method: 'llm',
          confidence,
        };
      }
    } catch {
      // deterministic fallback below
    }

    return {
      ...fallback,
      method: 'deterministic_fallback',
      confidence: 0.55,
    };
  }

  private normalizeTicketDeterministically(title: string, narrative: string): {
    title: string;
    descriptionClean: string;
    requesterName: string;
    requesterEmail: string;
    affectedUserName: string;
    affectedUserEmail: string;
  } {
    const cleaned = String(narrative || '')
      .replace(/you can access your service ticket[\s\S]*$/i, '')
      .replace(/sincerely[\s\S]*$/i, '')
      .replace(/caution[\s\S]*$/i, '')
      .replace(/do not click any links? or attachments?[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const requesterEmail = this.extractFirstEmail(cleaned) || '';
    const requesterName = this.normalizeName(
      String(cleaned.match(/(?:first\s*name|firstname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1] || '') +
      ' ' +
      String(cleaned.match(/(?:last\s*name|lastname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1] || '')
    ).trim();

    return {
      title: String(title || '').trim() || 'Support Request',
      descriptionClean: cleaned || String(narrative || '').trim(),
      requesterName,
      requesterEmail,
      affectedUserName: requesterName,
      affectedUserEmail: requesterEmail,
    };
  }

  private extractJsonObject(raw: string): Record<string, unknown> {
    const text = String(raw || '').trim();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return {};
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }

  private inferPhoneProvider(input: {
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

  private async resolveLastLoggedInContext(
    ninjaoneClient: NinjaOneClient,
    deviceId: string
  ): Promise<{ userName: string; logonTime: string }> {
    const direct = await ninjaoneClient.getDeviceLastLoggedOnUser(deviceId).catch(() => null);
    const directUser = String(direct?.userName || '').trim();
    const directTime = this.normalizeTimeValue(direct?.logonTime || '');
    if (directUser) return { userName: directUser, logonTime: directTime };

    const report = await ninjaoneClient.listLastLoggedOnUsers({ pageSize: 1000 }).catch(() => null);
    const rows = Array.isArray(report?.results) ? report.results : [];
    const match = rows.find((row) => String(row.deviceId) === String(deviceId));
    const reportUser = String(match?.userName || '').trim();
    const reportTime = this.normalizeTimeValue(match?.logonTime || '');
    if (reportUser) return { userName: reportUser, logonTime: reportTime };

    return { userName: '', logonTime: '' };
  }

  private resolveDeviceOsLabel(device: any, details: any): string {
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

  private async buildNinjaContextSignals(input: {
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

    for (const activity of activities.slice(0, 8)) {
      const summary = String(
        activity.message ||
        activity.activity ||
        activity.activityType ||
        activity.activityClass ||
        'device activity'
      ).trim();
      signals.push({
        id: `ninja-activity-${input.deviceId}-${String(activity.id || summary).slice(0, 48)}`,
        source: 'ninja',
        timestamp: this.normalizeTimeValue(activity.createTime || activity.timestamp || '') || new Date().toISOString(),
        type: 'ticket_note',
        summary: `Activity: ${summary}`,
        raw_ref: activity,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      });
    }

    for (const iface of interfaces.slice(0, 4)) {
      const name = String(iface.adapterName || iface.interfaceName || 'interface').trim();
      const ips = Array.isArray(iface.ipAddress) ? iface.ipAddress : [iface.ipAddress];
      const ip = ips.map((v) => String(v || '').trim()).filter(Boolean)[0] || 'no-ip';
      signals.push({
        id: `ninja-iface-${input.deviceId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        source: 'ninja',
        timestamp: new Date().toISOString(),
        type: 'health_ok',
        summary: `Interface ${name}: ${ip}`,
        raw_ref: iface,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      });
    }

    for (const sw of softwareRows.slice(0, 10)) {
      const swName = String(sw.name || '').trim();
      if (!swName) continue;
      const version = String(sw.version || '').trim();
      const publisher = String(sw.publisher || '').trim();
      signals.push({
        id: `ninja-sw-${input.deviceId}-${swName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
        source: 'ninja',
        timestamp: this.normalizeTimeValue(sw.timestamp || '') || new Date().toISOString(),
        type: 'ticket_note',
        summary: `Software: ${swName}${version ? ` ${version}` : ''}${publisher ? ` (${publisher})` : ''}`,
        raw_ref: sw,
        tenant_id: input.tenantId,
        org_id: input.orgId,
        source_workspace: input.sourceWorkspace,
      });
    }

    return signals;
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
