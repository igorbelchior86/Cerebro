// ─────────────────────────────────────────────────────────────
// PrepareContext Service — Orquestra coleta de dados
// ─────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
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
import { shouldBlockDiagnosisOutput } from './evidence-guardrails.js';
import { webSearch, type SearchResult } from './web-search.js';
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

interface TicketSSOT {
  ticket_id: string;
  company: string;
  requester_name: string;
  requester_email: string;
  affected_user_name: string;
  affected_user_email: string;
  created_at: string;
  title: string;
  description_clean: string;
  user_principal_name: string;
  account_status: string;
  mfa_state: string;
  licenses_summary: string;
  groups_top: string;
  device_name: string;
  device_type: string;
  os_name: string;
  os_version: string;
  last_check_in: string;
  security_agent: SecurityAgentSummary | { state: 'unknown'; name?: string };
  user_signed_in: string;
  location_context: string;
  public_ip: string;
  isp_name: string;
  vpn_state: string;
  phone_provider: string;
  phone_provider_name: string;
  firewall_make_model: string;
  wifi_make_model: string;
  switch_make_model: string;
  fusion_audit?: Record<string, unknown>;
}

export interface TicketTextArtifact {
  ticket_id: string;
  session_id: string;
  source: 'autotask' | 'email' | 'unknown';
  title_original: string;
  text_original: string;
  text_clean: string;
  text_clean_display_markdown?: string;
  text_clean_display_format?: 'plain' | 'markdown_llm';
  normalization_method: 'llm' | 'deterministic_fallback';
  normalization_confidence: number;
  created_at: string;
}

export interface TicketContextAppendix {
  ticket_id: string;
  session_id: string;
  created_at: string;
  history_correlation?: {
    mode: 'autotask_email_fallback';
    round: number;
    search_terms: string[];
    strategies: string[];
    matched_case_ids: string[];
    matched_case_count: number;
    blocked_reason?: 'missing_org_or_company_scope';
  };
  history_confidence_calibration?: {
    round: number;
    field_adjustments: Array<{
      path: string;
      action: 'boost' | 'decrease' | 'context_only';
      delta_confidence: number;
      previous_confidence: number;
      new_confidence: number;
      support_case_ids: string[];
      contradiction_case_ids?: string[];
      reason: string;
    }>;
    contradictions: Array<{
      path: string;
      current_value: string;
      observed_values: string[];
      case_ids: string[];
      note: string;
    }>;
  };
  fusion_summary?: {
    applied_resolution_count: number;
    link_count: number;
    inference_count: number;
    used_llm: boolean;
  };
  final_refinement?: {
    round: number;
    targets: string[];
    terms: string[];
    itglue_docs_added: number;
    ninja_device_reselected: boolean;
    ninja_signals_added: number;
    fields_updated: string[];
  };
}

interface ScopeMeta {
  tenant_id: string | null;
  org_id: string | null;
  source_workspace: string;
}

interface ITGlueWanCandidate {
  isp_name?: string;
  location_hint?: string;
  public_ip?: string;
  confidence: number;
  source_ref: string;
  source_system: 'itglue_asset' | 'itglue_config' | 'itglue_doc';
}

interface ITGlueInfraCandidate {
  kind: 'firewall' | 'wifi' | 'switch';
  value: string;
  confidence: number;
  source_ref: string;
  source_system: 'itglue_password_metadata' | 'itglue_config' | 'itglue_doc';
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

interface ItglueEnrichedField {
  value: string;
  confidence: number;
  source_system: string;
  evidence_refs: string[];
}

interface ItglueEnrichedPayload {
  org_id: string;
  source_hash: string;
  fields: Record<string, ItglueEnrichedField>;
  created_at: string;
}

interface NinjaEnrichedField {
  value: string;
  confidence: number;
  source_system: string;
  evidence_refs: string[];
}

interface NinjaEnrichedPayload {
  org_id: string;
  source_hash: string;
  fields: Record<string, NinjaEnrichedField>;
  created_at: string;
}

interface FusionLink {
  id: string;
  kind: 'identity_alias' | 'device_user' | 'ticket_software_device' | 'org_scope' | 'heuristic';
  from_entity: string;
  to_entity: string;
  confidence: number;
  evidence_refs: string[];
  note?: string;
}

interface FusionInference {
  id: string;
  claim: string;
  type: 'identity_link' | 'device_assignment' | 'software_relevance' | 'field_assembly' | 'heuristic';
  confidence: number;
  evidence_chain: string[];
  assumptions?: string[];
  disconfirmers?: string[];
}

interface FusionFieldCandidate {
  path: string;
  source: string;
  value: unknown;
  status: string;
  confidence: number;
  evidence_refs: string[];
}

interface FusionFieldResolution {
  path: string;
  value: unknown;
  status: 'confirmed' | 'inferred' | 'unknown' | 'conflict';
  confidence: number;
  resolution_mode: 'direct' | 'assembled' | 'inferred' | 'fallback' | 'unknown';
  evidence_refs: string[];
  inference_refs?: string[];
  note?: string;
}

interface FusionAdjudicationOutput {
  resolutions: FusionFieldResolution[];
  links?: FusionLink[];
  inferences?: FusionInference[];
  conflicts?: Array<{ field: string; note: string; evidence_refs?: string[] }>;
}

interface HistoryCalibrationResult {
  sections: IterativeEnrichmentSections;
  appendix: NonNullable<TicketContextAppendix['history_confidence_calibration']>;
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

const ITGLUE_EXTRACTOR_VERSION = 'v2-summary-2026-02-23';
const NINJA_EXTRACTOR_VERSION = 'v1-summary-2026-02-23';
const ITGLUE_ROUND2_REQUEST_BUDGET = 120;
const ITGLUE_MAX_SCOPE_ORGS = 4;
const ITGLUE_MAX_FLEXIBLE_ASSET_TYPES_PER_SCOPE = 24;
const ITGLUE_MAX_DOCUMENT_EXPANSIONS = 12;

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
  constructor() { }

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
    const originalTicketTitle = String(ticket.title || '').trim();
    const originalTicketNarrative = this.buildTicketNarrative(ticket);
    const normalizedTicket = await this.normalizeTicketForPipeline(ticket).catch(() => null);
    if (normalizedTicket) {
      await persistTicketTextArtifact(input.ticketId, input.sessionId, {
        ticket_id: input.ticketId,
        session_id: input.sessionId,
        source: input.ticketId.toString().startsWith('EMAIL-')
          ? 'email'
          : !Number.isNaN(Number(input.ticketId))
            ? 'autotask'
            : 'unknown',
        title_original: originalTicketTitle,
        text_original: originalTicketNarrative,
        text_clean: normalizedTicket.descriptionCanonical,
        ...(normalizedTicket.descriptionDisplayMarkdown
          ? {
              text_clean_display_markdown: normalizedTicket.descriptionDisplayMarkdown,
              text_clean_display_format: normalizedTicket.descriptionDisplayFormat,
            }
          : {}),
        normalization_method: normalizedTicket.method,
        normalization_confidence: normalizedTicket.confidence,
        created_at: new Date().toISOString(),
      });
      if (normalizedTicket.title) ticket.title = normalizedTicket.title;
      if (normalizedTicket.descriptionUi) ticket.description = normalizedTicket.descriptionUi;
      if (normalizedTicket.descriptionCanonical) ticket.rawBody = normalizedTicket.descriptionCanonical;
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
          `clean_display: ${normalizedTicket.descriptionDisplayFormat}`,
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
    const inferredCompany = this.inferCompanyNameFromTicketText(ticketNarrative) || this.inferCompanyNameFromTicketText(originalTicketNarrative);
    const companyName = this.selectPreferredCompanyName({
      intakeCompany: String(ticket.company || ''),
      inferredCompany,
    });
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
    let ninjaSoftwareInventory: any[] = [];
    let ninjaOrgDetails: Record<string, unknown> | null = null;
    let ninjaCollectionErrors: string[] = [];
    let ninjaEnriched: NinjaEnrichedPayload | null = null;
    let resolvedDeviceScore = 0;
    let itglueOrgMatch: { id: string; name: string } | null = null;
    let itglueOrgDetails: Record<string, unknown> | null = null;
    let itglueConfigs: any[] = [];
    let itglueContacts: any[] = [];
    let itgluePasswords: any[] = [];
    let itglueAssets: any[] = [];
    let itglueLocations: any[] = [];
    let itglueDomains: any[] = [];
    let itglueSslCertificates: any[] = [];
    let itglueDocumentsRaw: any[] = [];
    let itglueDocumentAttachmentsById: Record<string, any[]> = {};
    let itglueDocumentRelatedItemsById: Record<string, any[]> = {};
    let itglueCollectionErrors: string[] = [];
    let itglueScopeOrgs: Array<{ id: string; name: string; reason: string }> = [];
    let itglueRequestBudgetRemaining = ITGLUE_ROUND2_REQUEST_BUDGET;
    let itglueAssetTypesTotal = 0;
    let itglueAssetTypesSelectedPerScope = 0;
    let itglueEnriched: ItglueEnrichedPayload | null = null;

    // ROUND 1: AT/Intake -> IT Glue (Targeting Org/Contacts/Standards)
    try {
      const orgSeed = normalizedTicket?.organizationHint || companyName || '';
      if (orgSeed) {
        itglueOrgMatch = await this.resolveITGlueOrg(
          itglueClient,
          orgSeed,
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
        const budgetedITG = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
          if (itglueRequestBudgetRemaining <= 0) {
            throw new Error(`IT Glue request budget exceeded in round 2 before ${label}`);
          }
          itglueRequestBudgetRemaining -= 1;
          return fn();
        };
        const safeBudgetedITG = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
          try {
            return await budgetedITG(label, fn);
          } catch (error) {
            const msg = String((error as Error)?.message || error);
            if (/429/.test(msg)) {
              itglueCollectionErrors.push(`rate_limit:${label}: ${msg}`);
            }
            throw error;
          }
        };

        itglueScopeOrgs = await this.resolveITGlueOrgFamilyScopes(itglueClient, itglueOrgMatch, companyName)
          .catch((err: unknown) => {
            itglueCollectionErrors.push(`scope_resolution: ${(err as Error)?.message || String(err)}`);
            return [{ id: itglueOrgMatch!.id, name: itglueOrgMatch!.name, reason: 'matched' }];
          });
        itglueScopeOrgs = itglueScopeOrgs.slice(0, ITGLUE_MAX_SCOPE_ORGS);

        const assetTypesResult = await Promise.allSettled([
          safeBudgetedITG('flexible_asset_types', () => itglueClient.getFlexibleAssetTypes(200)),
        ]).then((results) => results[0]);

        if (assetTypesResult.status !== 'fulfilled') {
          itglueCollectionErrors.push(
            `flexible_asset_types: ${(assetTypesResult.reason as Error)?.message || String(assetTypesResult.reason)}`
          );
        }
        if (assetTypesResult.status === 'fulfilled') {
          itglueAssetTypesTotal = Array.isArray(assetTypesResult.value) ? assetTypesResult.value.length : 0;
        }

        for (const scope of itglueScopeOrgs) {
          const scopeLabel = `${scope.name} (${scope.id})`;
          const coreResults = await Promise.allSettled([
            safeBudgetedITG(`org_details[${scope.id}]`, () => itglueClient.getOrganizationById(scope.id).then((org) => org?.attributes || {})),
            safeBudgetedITG(`configurations[${scope.id}]`, () => itglueClient.getConfigurations(scope.id, 200)),
            safeBudgetedITG(`contacts[${scope.id}]`, () => itglueClient.getContacts(scope.id, 200)),
            safeBudgetedITG(`passwords[${scope.id}]`, () => itglueClient.getPasswords(scope.id, 200)),
            safeBudgetedITG(`locations[${scope.id}]`, () => itglueClient.getLocations(scope.id, 200)),
            safeBudgetedITG(`domains[${scope.id}]`, () => itglueClient.getDomains(scope.id, 200)),
            safeBudgetedITG(`ssl_certs[${scope.id}]`, () => itglueClient.getSslCertificates(scope.id, 200)),
            safeBudgetedITG(`documents_raw[${scope.id}]`, () => itglueClient.getOrganizationDocumentsRaw(scope.id, 200)),
          ]);

          const [
            orgDetailsResult,
            configsResult,
            contactsResult,
            passwordsResult,
            locationsResult,
            domainsResult,
            sslResult,
            documentsRawResult,
          ] = coreResults;

          if (orgDetailsResult.status === 'fulfilled') {
            if (!itglueOrgDetails || scope.id === itglueOrgMatch.id) {
              itglueOrgDetails = orgDetailsResult.value;
            }
          } else {
            itglueCollectionErrors.push(`org_details[${scopeLabel}]: ${(orgDetailsResult.reason as Error)?.message || String(orgDetailsResult.reason)}`);
          }

          if (configsResult.status === 'fulfilled') {
            itglueConfigs = this.mergeRowsById(itglueConfigs, configsResult.value);
          } else {
            itglueCollectionErrors.push(`configs[${scopeLabel}]: ${(configsResult.reason as Error)?.message || String(configsResult.reason)}`);
          }
          if (contactsResult.status === 'fulfilled') {
            itglueContacts = this.mergeRowsById(itglueContacts, contactsResult.value);
          } else {
            itglueCollectionErrors.push(`contacts[${scopeLabel}]: ${(contactsResult.reason as Error)?.message || String(contactsResult.reason)}`);
          }
          if (passwordsResult.status === 'fulfilled') {
            itgluePasswords = this.mergeRowsById(itgluePasswords, passwordsResult.value);
          } else {
            itglueCollectionErrors.push(`passwords[${scopeLabel}]: ${(passwordsResult.reason as Error)?.message || String(passwordsResult.reason)}`);
          }
          if (locationsResult.status === 'fulfilled') {
            itglueLocations = this.mergeRowsById(itglueLocations, locationsResult.value);
          } else {
            itglueCollectionErrors.push(`locations[${scopeLabel}]: ${(locationsResult.reason as Error)?.message || String(locationsResult.reason)}`);
          }
          if (domainsResult.status === 'fulfilled') {
            itglueDomains = this.mergeRowsById(itglueDomains, domainsResult.value);
          } else {
            itglueCollectionErrors.push(`domains[${scopeLabel}]: ${(domainsResult.reason as Error)?.message || String(domainsResult.reason)}`);
          }
          if (sslResult.status === 'fulfilled') {
            itglueSslCertificates = this.mergeRowsById(itglueSslCertificates, sslResult.value);
          } else {
            itglueCollectionErrors.push(`ssl_certificates[${scopeLabel}]: ${(sslResult.reason as Error)?.message || String(sslResult.reason)}`);
          }
          if (documentsRawResult.status === 'fulfilled') {
            itglueDocumentsRaw = this.mergeRowsById(itglueDocumentsRaw, documentsRawResult.value);
          } else {
            itglueCollectionErrors.push(`documents_raw[${scopeLabel}]: ${(documentsRawResult.reason as Error)?.message || String(documentsRawResult.reason)}`);
          }

          if (assetTypesResult.status === 'fulfilled') {
            const scopedAssetTypes = this.selectITGlueFlexibleAssetTypesForTicket({
              assetTypes: assetTypesResult.value,
              ticketNarrative,
              docs,
              maxTypes: ITGLUE_MAX_FLEXIBLE_ASSET_TYPES_PER_SCOPE,
            });
            itglueAssetTypesSelectedPerScope = Math.max(itglueAssetTypesSelectedPerScope, scopedAssetTypes.length);
            const assetCandidates = await Promise.allSettled(
              scopedAssetTypes.map((t: any) =>
                safeBudgetedITG(`flexible_assets[${scope.id}][${String(t?.id || 'unknown')}]`, () =>
                  itglueClient.getFlexibleAssets(String(t.id), scope.id, 200)
                )
              )
            );
            assetCandidates.forEach((result, idx) => {
              if (result.status === 'fulfilled') {
                itglueAssets = this.mergeRowsById(itglueAssets, result.value);
                return;
              }
              const assetTypeName = String(
                scopedAssetTypes[idx]?.attributes?.name ||
                scopedAssetTypes[idx]?.attributes?.['name'] ||
                scopedAssetTypes[idx]?.id ||
                `type_${idx}`
              );
              itglueCollectionErrors.push(
                `flexible_assets[${scopeLabel}](${assetTypeName}): ${(result.reason as Error)?.message || String(result.reason)}`
              );
            });
          }
        }

        const docIdsForExpansion = [...new Set(
          itglueDocumentsRaw
            .map((doc: any) => String(doc?.id || '').trim())
            .filter(Boolean)
        )]
          .slice(0, Math.max(0, Math.min(ITGLUE_MAX_DOCUMENT_EXPANSIONS, Math.floor(itglueRequestBudgetRemaining / 2))));
        const attachmentResults = await Promise.allSettled(
          docIdsForExpansion.map((docId) => safeBudgetedITG(`document_attachments[${docId}]`, () => itglueClient.getDocumentAttachments(docId, 100)))
        );
        const relatedItemResults = await Promise.allSettled(
          docIdsForExpansion.map((docId) => safeBudgetedITG(`document_related_items[${docId}]`, () => itglueClient.getDocumentRelatedItems(docId, 100)))
        );
        docIdsForExpansion.forEach((docId, idx) => {
          const attach = attachmentResults[idx];
          const rel = relatedItemResults[idx];
          if (attach?.status === 'fulfilled') {
            itglueDocumentAttachmentsById[docId] = attach.value;
          } else if (attach) {
            itglueCollectionErrors.push(`document_attachments(${docId}): ${(attach.reason as Error)?.message || String(attach.reason)}`);
          }
          if (rel?.status === 'fulfilled') {
            itglueDocumentRelatedItemsById[docId] = rel.value;
          } else if (rel) {
            itglueCollectionErrors.push(`document_related_items(${docId}): ${(rel.reason as Error)?.message || String(rel.reason)}`);
          }
        });
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

      if (docs.length === 0 && itglueDocumentsRaw.length > 0) {
        docs = itglueDocumentsRaw.slice(0, 8).map((doc: any, idx: number) => {
          const attrs = doc?.attributes || {};
          const title = String(
            this.itgAttr(attrs, 'name') ||
            this.itgAttr(attrs, 'cached_resource_name') ||
            `IT Glue Document ${idx + 1}`
          );
          const snippet = String(this.itgAttr(attrs, 'content') || '').replace(/\s+/g, ' ').trim().slice(0, 500);
          const orgId = String(this.itgAttr(attrs, 'organization_id') || itglueOrgMatch?.id || '');
          return {
            id: String(doc?.id || `itg-doc-${idx}`),
            source: 'itglue' as const,
            title,
            snippet,
            relevance: Number((0.42 - idx * 0.03).toFixed(3)),
            raw_ref: doc as Record<string, unknown>,
            tenant_id: tenantId,
            org_id: orgId || null,
            source_workspace: sourceWorkspace,
          };
        });
      }

      sourceFindings.push({
        source: 'itglue',
        round: 2,
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
          ...(itglueScopeOrgs.length > 0 ? [`scope orgs: ${itglueScopeOrgs.map((s) => `${s.name} (${s.id}) [${s.reason}]`).join(' | ')}`] : []),
          `configs: ${itglueConfigs.length}`,
          `contacts: ${itglueContacts.length}`,
          `passwords: ${itgluePasswords.length}`,
          `assets: ${itglueAssets.length}`,
          `locations: ${itglueLocations.length}`,
          `domains: ${itglueDomains.length}`,
          `ssl_certs: ${itglueSslCertificates.length}`,
          `documents_raw: ${itglueDocumentsRaw.length}`,
          `document_attachments: ${Object.keys(itglueDocumentAttachmentsById).length} docs expanded`,
          `document_related_items: ${Object.keys(itglueDocumentRelatedItemsById).length} docs expanded`,
          runbooksEndpointUnavailable ? 'runbooks endpoint: unavailable (404)' : `runbooks: ${docs.length}`,
          ...(itglueCollectionErrors.length ? [`partial errors: ${itglueCollectionErrors.length}`] : []),
          `itglue round2 request budget: used ${ITGLUE_ROUND2_REQUEST_BUDGET - itglueRequestBudgetRemaining}/${ITGLUE_ROUND2_REQUEST_BUDGET} (remaining ${itglueRequestBudgetRemaining})`,
          itglueAssetTypesTotal > 0
            ? `flexible asset types selected per scope: ${itglueAssetTypesSelectedPerScope}/${itglueAssetTypesTotal}`
            : 'flexible asset types selected per scope: unavailable',
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

      if (itglueOrgMatch) {
        const rawSnapshot = {
          org_id: itglueOrgMatch.id,
          org_name: itglueOrgMatch.name,
          scope_orgs: itglueScopeOrgs,
          configs: itglueConfigs,
          contacts: itglueContacts,
          passwords: itgluePasswords,
          assets: itglueAssets,
          locations: itglueLocations,
          domains: itglueDomains,
          ssl_certificates: itglueSslCertificates,
          documents_raw: itglueDocumentsRaw,
          document_attachments_by_id: itglueDocumentAttachmentsById,
          document_related_items_by_id: itglueDocumentRelatedItemsById,
          collection_errors: itglueCollectionErrors,
          organization_details: itglueOrgDetails || {},
          docs,
        };
        const snapshotHash = this.hashSnapshot(rawSnapshot);
        await persistItglueOrgSnapshot(itglueOrgMatch.id, rawSnapshot, snapshotHash);
        itglueEnriched = await this.getOrRefreshItglueEnriched({
          orgId: itglueOrgMatch.id,
          snapshot: rawSnapshot,
          sourceHash: snapshotHash,
        });
      }
    } catch (error) {
      missingData.push({
        field: 'itglue_docs',
        why: `Failed to fetch IT Glue docs: ${(error as Error).message}`,
      });
      sourceFindings.push({
        source: 'itglue',
        round: 2,
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

    // ROUND 3: AT+ITG -> Ninja (Targeting Devices, Health, Alerts)
    try {
      const orgSeed = normalizedTicket?.organizationHint || itglueOrgMatch?.name || companyName || '';
      if (orgSeed) {
        ninjaOrgMatch = await this.resolveNinjaOrg(ninjaoneClient, orgSeed);
      }
      if (ninjaOrgMatch) {
        const ninjaOrgFetch = await Promise.allSettled([
          ninjaoneClient.getOrganization(String(ninjaOrgMatch.id)),
          ninjaoneClient.listDevicesByOrganization(String(ninjaOrgMatch.id), { limit: 200 }),
          ninjaoneClient.listAlerts(String(ninjaOrgMatch.id)),
          ninjaoneClient.querySoftware({ pageSize: 300 }),
        ]);
        if (ninjaOrgFetch[0].status === 'fulfilled') {
          ninjaOrgDetails = ninjaOrgFetch[0].value as Record<string, unknown>;
        } else {
          ninjaCollectionErrors.push(`organization: ${(ninjaOrgFetch[0].reason as Error)?.message || String(ninjaOrgFetch[0].reason)}`);
        }
        if (ninjaOrgFetch[1].status === 'fulfilled') {
          ninjaOrgDevices = ninjaOrgFetch[1].value;
        } else {
          ninjaOrgDevices = [];
          ninjaCollectionErrors.push(`devices: ${(ninjaOrgFetch[1].reason as Error)?.message || String(ninjaOrgFetch[1].reason)}`);
        }
        if (ninjaOrgFetch[2].status === 'fulfilled') {
          ninjaAlerts = ninjaOrgFetch[2].value;
        } else {
          ninjaAlerts = [];
          ninjaCollectionErrors.push(`alerts: ${(ninjaOrgFetch[2].reason as Error)?.message || String(ninjaOrgFetch[2].reason)}`);
        }
        if (ninjaOrgFetch[3].status === 'fulfilled') {
          const orgDeviceIds = new Set((ninjaOrgDevices || []).map((d: any) => Number(d?.id)).filter(Number.isFinite));
          ninjaSoftwareInventory = (ninjaOrgFetch[3].value || []).filter((row: any) => {
            const deviceId = Number(row?.deviceId);
            return orgDeviceIds.size === 0 || orgDeviceIds.has(deviceId);
          });
        } else {
          ninjaSoftwareInventory = [];
          ninjaCollectionErrors.push(`software_query: ${(ninjaOrgFetch[3].reason as Error)?.message || String(ninjaOrgFetch[3].reason)}`);
        }
      } else {
        ninjaOrgDevices = await ninjaoneClient.listDevices({ limit: 100 });
      }

      const resolvedDevice = await this.resolveDeviceDeterministically({
        devices: ninjaOrgDevices,
        ticketText: ticketNarrative,
        requesterName,
        itglueConfigs,
        deviceHints: normalizedTicket?.deviceHints || [],
        ninjaoneClient,
        sourceWorkspace,
        tenantId,
        orgId: ninjaOrgMatch ? String(ninjaOrgMatch.id) : itglueOrgMatch?.id || null,
      });

      device = resolvedDevice.device;
      resolvedDeviceScore = resolvedDevice.score;
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

      if (ninjaOrgMatch) {
        const ninjaRawSnapshot = {
          org_id: String(ninjaOrgMatch.id),
          org_name: String(ninjaOrgMatch.name || ''),
          organization_details: ninjaOrgDetails || {},
          devices: ninjaOrgDevices,
          alerts: ninjaAlerts,
          software_inventory_query: ninjaSoftwareInventory,
          selected_device: device || null,
          selected_device_details: deviceDetails || null,
          selected_device_checks: ninjaChecks,
          selected_device_context_signals: ninjaContextSignals,
          logged_in_user: loggedInUser || '',
          logged_in_at: loggedInAt || '',
          resolved_device_score: resolvedDeviceScore,
          collection_errors: ninjaCollectionErrors,
        };
        const ninjaSnapshotHash = this.hashSnapshotWithVersion(ninjaRawSnapshot, NINJA_EXTRACTOR_VERSION);
        await persistNinjaOrgSnapshot(String(ninjaOrgMatch.id), ninjaRawSnapshot, ninjaSnapshotHash);
        ninjaEnriched = await this.getOrRefreshNinjaEnriched({
          orgId: String(ninjaOrgMatch.id),
          snapshot: ninjaRawSnapshot,
          sourceHash: ninjaSnapshotHash,
        });
      }

      sourceFindings.push({
        source: 'ninjaone',
        round: 3,
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
          `software_inventory: ${ninjaSoftwareInventory.length}`,
          `health checks: ${ninjaChecks.length}`,
          `extended signals: ${ninjaContextSignals.length}`,
          `ninja_enriched: ${ninjaEnriched ? 'cached/generated' : 'not available'}`,
          ...(ninjaCollectionErrors.length ? [`partial errors: ${ninjaCollectionErrors.length}`] : []),
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
        round: 3,
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
        round: 3,
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

    // ROUND 4: AT+ITG+Ninja -> History (Similar Tickets, Previous Fixes, Known Issues)
    const historyTerms = [
      ticket.title || '',
      normalizedTicket?.descriptionUi || '',
      ticketNarrative,
      requesterName,
      loggedInUser,
      String(device?.hostname || ''),
      String(device?.systemName || ''),
      ...docs.slice(0, 2).map((d) => d.title || ''),
      ...(normalizedTicket?.symptoms || []),
      ...(normalizedTicket?.technologyFacets || []),
    ].filter(Boolean);

    const historyScopeCompany = companyName && companyName.toLowerCase() !== 'unknown' ? companyName : undefined;
    relatedCases = (await this.findRelatedCasesByTerms(historyTerms, input.orgId, historyScopeCompany)).map((rc) => ({
      ...rc,
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
    }));

    sourceFindings.push({
      source: 'autotask',
      round: 4,
      facet: 'history_correlation',
      queried: true,
      matched: relatedCases.length > 0,
      summary: relatedCases.length > 0
        ? `historical correlation found ${relatedCases.length} related case(s)`
        : 'historical correlation found no related case',
      details: [
        `search terms used: ${Math.min(historyTerms.length, 8)}`,
        `keywords: ${historyTerms.slice(0, 5).join(', ')}`
      ],
      why_selected: ['related_changes/history is crucial for identifying client-specific patterns'],
      tenant_id: tenantId,
      org_id: input.orgId || null,
      source_workspace: sourceWorkspace,
    });

    const historyIdentifiers = relatedCases.flatMap((rc) => {
      const matches = rc.resolution.match(/[A-Z0-9]{5,}/g) || [];
      return matches;
    });

    // ROUND 5: History -> ITG (refine docs/configs with historical terms)
    if (itglueOrgMatch && historyTerms.length > 0) {
      try {
        const historyDocs = await Promise.all(
          historyTerms.slice(0, 4).map((term) =>
            itglueClient.searchDocuments(term, itglueOrgMatch!.id).catch(() => [])
          )
        );
        const flattened = historyDocs.flat().slice(0, 6);
        const extraDocs = flattened.map((doc: any, idx: number) => ({
          id: String(doc.id),
          source: 'itglue' as const,
          title: String(doc.name || `History doc ${idx + 1}`),
          snippet: String((doc as any).body || '').substring(0, 500),
          relevance: 0.4 - idx * 0.05,
          raw_ref: doc as unknown as Record<string, unknown>,
          tenant_id: tenantId,
          org_id: itglueOrgMatch?.id || null,
          source_workspace: sourceWorkspace,
        }));
        docs = this.mergeDocsById(docs, extraDocs);
        sourceFindings.push({
          source: 'itglue',
          round: 5,
          facet: 'history_cross',
          queried: true,
          matched: extraDocs.length > 0,
          summary: extraDocs.length > 0
            ? `history refinement added ${extraDocs.length} document(s)`
            : 'history refinement did not add new documents',
          details: [
            `terms: ${historyTerms.slice(0, 4).join(', ')}`,
            `added_docs: ${extraDocs.length}`,
          ],
          why_selected: ['second IT Glue pass uses historical terms to close documentation gaps'],
          tenant_id: tenantId,
          org_id: itglueOrgMatch?.id || null,
          source_workspace: sourceWorkspace,
        });
      } catch (error) {
        sourceFindings.push({
          source: 'itglue',
          round: 5,
          facet: 'history_cross',
          queried: true,
          matched: false,
          summary: 'history refinement failed',
          details: [`error: ${(error as Error).message}`],
          why_rejected: ['itglue history refinement error'],
          tenant_id: tenantId,
          org_id: itglueOrgMatch?.id || null,
          source_workspace: sourceWorkspace,
        });
      }
    }

    // ROUND 6: History -> Ninja (re-resolve device using history hints)
    if (historyTerms.length > 0) {
      try {
        const refinedDevice = await this.resolveDeviceDeterministically({
          devices: ninjaOrgDevices,
          ticketText: `${ticketNarrative} ${historyTerms.slice(0, 4).join(' ')}`,
          requesterName,
          itglueConfigs,
          deviceHints: [...(normalizedTicket?.deviceHints || []), ...historyIdentifiers.slice(0, 4)],
          ninjaoneClient,
          sourceWorkspace,
          tenantId,
          orgId: ninjaOrgMatch ? String(ninjaOrgMatch.id) : itglueOrgMatch?.id || null,
        });

        if (refinedDevice.device && refinedDevice.score >= resolvedDeviceScore) {
          device = refinedDevice.device;
          resolvedDeviceScore = refinedDevice.score;
          ninjaChecks = refinedDevice.checks;
          loggedInUser = refinedDevice.loggedInUser;
          loggedInAt = refinedDevice.loggedInAt || '';
          deviceDetails = refinedDevice.details ?? null;
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

          for (let i = missingData.length - 1; i >= 0; i -= 1) {
            const entry = missingData[i];
            if (!entry) continue;
            if (entry.field === 'device_unresolved' || entry.field === 'ninjaone_device') {
              missingData.splice(i, 1);
            }
          }
        }

        sourceFindings.push({
          source: 'ninjaone',
          round: 6,
          facet: 'history_cross',
          queried: true,
          matched: Boolean(refinedDevice.device),
          summary: refinedDevice.device
            ? `history refinement selected device ${refinedDevice.device.hostname || refinedDevice.device.systemName || refinedDevice.device.id}`
            : 'history refinement did not find a better device',
          details: [
            `score: ${refinedDevice.score.toFixed(2)}`,
            `history_terms: ${historyTerms.slice(0, 4).join(', ')}`,
          ],
          why_selected: [refinedDevice.reason],
          tenant_id: tenantId,
          org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
          source_workspace: sourceWorkspace,
        });
      } catch (error) {
        sourceFindings.push({
          source: 'ninjaone',
          round: 6,
          facet: 'history_cross',
          queried: true,
          matched: false,
          summary: 'history refinement failed',
          details: [`error: ${(error as Error).message}`],
          why_rejected: ['ninjaone history refinement error'],
          tenant_id: tenantId,
          org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
          source_workspace: sourceWorkspace,
        });
      }
    }

    // ROUND 5 (The Crossing): History -> ITG/Ninja (Reconcile Serials/AssetTags/UPNs)
    // AND: External Search (Skills)
    if (historyIdentifiers.length > 0 && (!device || !itglueOrgMatch)) {
      sourceFindings.push({
        source: 'external',
        round: 5,
        facet: 'reconciliation',
        queried: true,
        matched: true,
        summary: `reconciled ${historyIdentifiers.length} potential identifiers from history`,
        details: [`identifiers found: ${historyIdentifiers.slice(0, 3).join(', ')}`],
        why_selected: ['final reconciliation pass aims to fill gaps using resolution historical data'],
        tenant_id: tenantId,
        org_id: input.orgId || null,
        source_workspace: sourceWorkspace,
      });
    }

    // Trigger External Search for Tech Facets (Phase 5)
    const techFacets = normalizedTicket?.technologyFacets || [];
    if (techFacets.length > 0) {
      const searchQuery = `${techFacets.join(' ')} ${normalizedTicket?.symptoms?.[0] || 'known issues'}`;
      try {
        const results = await webSearch(searchQuery);
        if (results.length > 0) {
          sourceFindings.push({
            source: 'external',
            round: 4,
            facet: 'search_skill',
            queried: true,
            matched: true,
            summary: `external search skill found ${results.length} relevant technical articles`,
            details: results.map(r => `${r.title}: ${r.url}`),
            why_selected: ['external search provides vendor-specific context and known issues'],
            tenant_id: tenantId,
            org_id: input.orgId || null,
            source_workspace: sourceWorkspace,
          });

          results.forEach(r => {
            docs.push({
              id: `search-res-${r.url.slice(-8)}`,
              title: r.title,
              snippet: r.snippet,
              source: 'external_web',
              relevance: 1,
            });
          });
        }
      } catch (e) {
        console.error('[PrepareContext] External search failed:', e);
      }
    }

    // Original Intake summary finding
    sourceFindings.unshift({
      source: 'autotask',
      round: 1,
      queried: true,
      matched: true,
      summary: `ticket intake resolved${companyName ? `, org "${companyName}" identified` : ''}${requesterName ? `, requester "${requesterName}" identified` : ''}`,
      details: [
        `ticket id: ${ticket.ticketNumber || String(ticket.id)}`,
        `intake method: ${normalizedTicket?.method || 'unknown'}`,
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

    let scopedDocs = docs.filter((doc) => {
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
    scopedDocs = this.rankITGlueDocsForTicket(ticketNarrative, scopedDocs);

    let scopedSignals = [...signals, ...ninjaChecks, ...ninjaContextSignals].filter((signal) => {
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

    let scopedRelatedCases = relatedCases.filter((relatedCase) => {
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

    let evidenceDigest = this.buildEvidenceDigest({
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
      itgluePasswords,
      itglueAssets,
      itglueEnriched,
      docs: scopedDocs,
      ninjaChecks: scopedSignals.filter((signal) => signal.source === 'ninja'),
      missingData,
    });

    const fusionResult = await this.runCrossSourceFusion({
      sections: iterativeEnrichment.sections,
      ticket,
      ticketNarrative,
      normalizedTicket,
      itglueContacts,
      itglueConfigs,
      itglueEnriched,
      ninjaEnriched,
      ninjaOrgDevices,
      ninjaSoftwareInventory,
      device,
      deviceDetails,
      loggedInUser,
      loggedInAt,
    });
    let fusionAudit: Record<string, unknown> | undefined;
    let fusionSummaryForAppendix: TicketContextAppendix['fusion_summary'] | undefined;
    if (fusionResult) {
      iterativeEnrichment.sections = fusionResult.sections;
      fusionAudit = fusionResult.audit;
      fusionSummaryForAppendix = {
        applied_resolution_count: fusionResult.appliedResolutionCount,
        link_count: fusionResult.linkCount,
        inference_count: fusionResult.inferenceCount,
        used_llm: fusionResult.usedLlm,
      };
      sourceFindings.push({
        source: 'external',
        round: 7,
        facet: 'cross_source_fusion',
        queried: true,
        matched: fusionResult.appliedResolutionCount > 0,
        summary: fusionResult.appliedResolutionCount > 0
          ? `cross-source fusion applied ${fusionResult.appliedResolutionCount} field resolution(s)`
          : 'cross-source fusion completed with no field overrides',
        details: [
          `candidate fields: ${fusionResult.candidateFieldCount}`,
          `links generated: ${fusionResult.linkCount}`,
          `inferences generated: ${fusionResult.inferenceCount}`,
          `llm: ${fusionResult.usedLlm ? 'yes' : 'no'}`,
        ],
        why_selected: ['cross-source assembly/inference required before final SSOT'],
        tenant_id: tenantId,
        org_id: resolvedOrgId || null,
        source_workspace: sourceWorkspace,
      });
      const fusedRecords = this.flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = this.computeEnrichmentCoverage(fusedRecords);
      iterativeEnrichment.rounds = this.buildEnrichmentRounds(fusedRecords, sourceFindings);
      iterativeEnrichment.completed_rounds = iterativeEnrichment.rounds.at(-1)?.round ?? iterativeEnrichment.completed_rounds;
    }

    // ROUND 8: Fused Context -> Broad History Correlation (Autotask / email fallback)
    let historyAppendixCorrelation: TicketContextAppendix['history_correlation'] | undefined;
    let historyCalibrationAppendix: TicketContextAppendix['history_confidence_calibration'] | undefined;
    try {
      const historySearchPlan = this.buildBroadHistorySearchPlan({
        ticket,
        ticketNarrative,
        normalizedTicket,
        sections: iterativeEnrichment.sections,
        docs: scopedDocs,
        ...(fusionAudit ? { fusionAudit } : {}),
      });
      const broadHistoryOrgId = resolvedOrgId || input.orgId;
      const broadHistoryCompany =
        this.normalizeName(String(iterativeEnrichment.sections.ticket.company.value || '')) || companyName || '';
      const hasHistoryScope = Boolean(
        broadHistoryOrgId ||
        (broadHistoryCompany && !/^unknown$/i.test(broadHistoryCompany))
      );
      const broadRelatedCases = hasHistoryScope
        ? await this.findRelatedCasesBroad({
            ticketId: String(ticket.ticketNumber || ticket.id || input.ticketId || ''),
            ...(broadHistoryOrgId ? { orgId: broadHistoryOrgId } : {}),
            ...(!broadHistoryOrgId && broadHistoryCompany && !/^unknown$/i.test(broadHistoryCompany)
              ? { companyName: broadHistoryCompany }
              : {}),
            terms: historySearchPlan.terms,
          })
        : [];
      relatedCases = broadRelatedCases.map((rc) => ({
        ...rc,
        tenant_id: tenantId,
        org_id: resolvedOrgId || input.orgId || null,
        source_workspace: sourceWorkspace,
      }));

      historyAppendixCorrelation = {
        mode: 'autotask_email_fallback',
        round: 8,
        search_terms: historySearchPlan.terms.slice(0, 28),
        strategies: historySearchPlan.strategies,
        matched_case_ids: broadRelatedCases.map((c) => c.ticket_id).slice(0, 10),
        matched_case_count: broadRelatedCases.length,
        ...(!hasHistoryScope ? { blocked_reason: 'missing_org_or_company_scope' as const } : {}),
      };

      scopedRelatedCases = relatedCases.filter((relatedCase) => {
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

      sourceFindings.push({
        source: 'autotask',
        round: 8,
        facet: 'history_correlation_broad',
        queried: true,
        matched: hasHistoryScope && scopedRelatedCases.length > 0,
        summary: scopedRelatedCases.length > 0
          ? `broad historical correlation found ${scopedRelatedCases.length} related case(s)`
          : !hasHistoryScope
            ? 'broad historical correlation blocked (missing org/company scope)'
            : 'broad historical correlation found no related case',
        details: [
          `term_count: ${historySearchPlan.terms.length}`,
          `top_terms: ${historySearchPlan.terms.slice(0, 8).join(', ') || 'none'}`,
          `strategies: ${historySearchPlan.strategies.join(' -> ')}`,
          ...(!hasHistoryScope ? ['blocked: missing org/company scope'] : []),
        ],
        why_selected: ['history search must use fused org/user/device/software/network context, not a single keyword'],
        tenant_id: tenantId,
        org_id: resolvedOrgId || input.orgId || null,
        source_workspace: sourceWorkspace,
      });

      evidenceDigest = this.buildEvidenceDigest({
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

      const currentRecords = this.flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.rounds = this.buildEnrichmentRounds(currentRecords, sourceFindings);
      iterativeEnrichment.completed_rounds = iterativeEnrichment.rounds.at(-1)?.round ?? iterativeEnrichment.completed_rounds;

      const calibration = this.applyHistoryConfidenceCalibration({
        sections: iterativeEnrichment.sections,
        relatedCases: scopedRelatedCases,
      });
      iterativeEnrichment.sections = calibration.sections;
      historyCalibrationAppendix = calibration.appendix;
      const calibratedRecords = this.flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = this.computeEnrichmentCoverage(calibratedRecords);
      iterativeEnrichment.rounds = this.buildEnrichmentRounds(calibratedRecords, sourceFindings);
      iterativeEnrichment.completed_rounds = iterativeEnrichment.rounds.at(-1)?.round ?? iterativeEnrichment.completed_rounds;
    } catch (error) {
      sourceFindings.push({
        source: 'autotask',
        round: 8,
        facet: 'history_correlation_broad',
        queried: true,
        matched: false,
        summary: 'broad historical correlation failed',
        details: [`error: ${(error as Error).message}`],
        why_rejected: ['broad history correlation error'],
        tenant_id: tenantId,
        org_id: resolvedOrgId || input.orgId || null,
        source_workspace: sourceWorkspace,
      });
    }

    // ROUND 9: Final ITG + Ninja pass guided by gaps/conflicts/history calibration (2f)
    let finalRefinementAppendix: TicketContextAppendix['final_refinement'] | undefined;
    try {
      const finalRefinementPlan = this.buildFinalRefinementPlan({
        sections: iterativeEnrichment.sections,
        missingData,
        ...(fusionAudit ? { fusionAudit } : {}),
        ...(historyCalibrationAppendix ? { historyCalibration: historyCalibrationAppendix } : {}),
        ...(historyAppendixCorrelation ? { historyCorrelation: historyAppendixCorrelation } : {}),
      });
      let finalItgDocsAdded = 0;
      let finalNinjaDeviceReselected = false;
      let finalNinjaSignalsAdded = 0;
      const finalFieldsUpdated: string[] = [];

      if (itglueOrgMatch && finalRefinementPlan.terms.length > 0) {
        try {
          const finalDocsRaw = await Promise.all(
            finalRefinementPlan.terms.slice(0, 5).map((term) =>
              itglueClient.searchDocuments(term, itglueOrgMatch.id).catch(() => [])
            )
          );
          const extraDocs = finalDocsRaw
            .flat()
            .slice(0, 10)
            .map((doc: any, idx: number) => ({
              id: String(doc.id),
              source: 'itglue' as const,
              title: String(doc.name || `Final refinement doc ${idx + 1}`),
              snippet: String((doc as any).body || '').substring(0, 600),
              relevance: 0.35 - idx * 0.03,
              raw_ref: doc as unknown as Record<string, unknown>,
              tenant_id: tenantId,
              org_id: itglueOrgMatch.id,
              source_workspace: sourceWorkspace,
            }));
          const beforeDocs = scopedDocs.length;
          docs = this.mergeDocsById(docs, extraDocs);
          const acceptedExtraDocs = extraDocs.filter((doc) => {
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
          scopedDocs = this.mergeDocsById(scopedDocs, acceptedExtraDocs);
          finalItgDocsAdded = Math.max(0, scopedDocs.length - beforeDocs);
          sourceFindings.push({
            source: 'itglue',
            round: 9,
            facet: 'final_refinement',
            queried: true,
            matched: finalItgDocsAdded > 0,
            summary: finalItgDocsAdded > 0
              ? `final refinement added ${finalItgDocsAdded} IT Glue document(s)`
              : 'final refinement found no new IT Glue documents',
            details: [
              `targets: ${finalRefinementPlan.targets.slice(0, 5).join(', ') || 'none'}`,
              `terms: ${finalRefinementPlan.terms.slice(0, 5).join(', ') || 'none'}`,
            ],
            why_selected: ['final pass checks for missed org documentation after fusion/history calibration'],
            tenant_id: tenantId,
            org_id: itglueOrgMatch.id,
            source_workspace: sourceWorkspace,
          });
        } catch (error) {
          sourceFindings.push({
            source: 'itglue',
            round: 9,
            facet: 'final_refinement',
            queried: true,
            matched: false,
            summary: 'final IT Glue refinement failed',
            details: [`error: ${(error as Error).message}`],
            why_rejected: ['itglue final refinement error'],
            tenant_id: tenantId,
            org_id: itglueOrgMatch.id,
            source_workspace: sourceWorkspace,
          });
        }
      }

      if (ninjaOrgDevices.length > 0 && finalRefinementPlan.terms.length > 0) {
        const shouldReResolveDevice = this.shouldRunFinalNinjaRefinement({
          sections: iterativeEnrichment.sections,
          finalRefinementPlanTargets: finalRefinementPlan.targets,
          currentDevice: device,
        });
        if (shouldReResolveDevice) {
          try {
            const refinedDevice = await this.resolveDeviceDeterministically({
              devices: ninjaOrgDevices,
              ticketText: `${ticketNarrative} ${finalRefinementPlan.terms.slice(0, 8).join(' ')}`,
              requesterName,
              itglueConfigs,
              deviceHints: [...(normalizedTicket?.deviceHints || []), ...finalRefinementPlan.terms.slice(0, 4)],
              ninjaoneClient,
              sourceWorkspace,
              tenantId,
              orgId: ninjaOrgMatch ? String(ninjaOrgMatch.id) : itglueOrgMatch?.id || null,
            });
            if (refinedDevice.device && refinedDevice.score >= resolvedDeviceScore) {
              const previousDeviceId = String(device?.id || '');
              device = refinedDevice.device;
              resolvedDeviceScore = refinedDevice.score;
              ninjaChecks = refinedDevice.checks;
              loggedInUser = refinedDevice.loggedInUser;
              loggedInAt = refinedDevice.loggedInAt || '';
              deviceDetails = refinedDevice.details ?? null;
              if (device?.id) {
                const refreshedSignals = await this.buildNinjaContextSignals({
                  ninjaoneClient,
                  deviceId: String(device.id),
                  orgId: input.orgId || itglueOrgMatch?.id || (ninjaOrgMatch ? String(ninjaOrgMatch.id) : null),
                  tenantId,
                  sourceWorkspace,
                });
                const beforeSignals = scopedSignals.length;
                const acceptedSignals = [...ninjaChecks, ...refreshedSignals].filter((signal) => {
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
                scopedSignals = this.mergeSignalsById(scopedSignals, acceptedSignals);
                finalNinjaSignalsAdded = Math.max(0, scopedSignals.length - beforeSignals);
                ninjaContextSignals = refreshedSignals;
              }
              finalNinjaDeviceReselected = previousDeviceId !== String(device?.id || '') || Boolean(device);
            }
            sourceFindings.push({
              source: 'ninjaone',
              round: 9,
              facet: 'final_refinement',
              queried: true,
              matched: Boolean(refinedDevice.device),
              summary: refinedDevice.device
                ? `final Ninja refinement ${finalNinjaDeviceReselected ? 'updated' : 'confirmed'} device ${refinedDevice.device.hostname || refinedDevice.device.systemName || refinedDevice.device.id}`
                : 'final Ninja refinement did not improve device correlation',
              details: [
                `score: ${refinedDevice.score.toFixed(2)}`,
                `targets: ${finalRefinementPlan.targets.slice(0, 5).join(', ') || 'none'}`,
                `terms: ${finalRefinementPlan.terms.slice(0, 5).join(', ') || 'none'}`,
              ],
              why_selected: [refinedDevice.reason],
              tenant_id: tenantId,
              org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
              source_workspace: sourceWorkspace,
            });
          } catch (error) {
            sourceFindings.push({
              source: 'ninjaone',
              round: 9,
              facet: 'final_refinement',
              queried: true,
              matched: false,
              summary: 'final Ninja refinement failed',
              details: [`error: ${(error as Error).message}`],
              why_rejected: ['ninjaone final refinement error'],
              tenant_id: tenantId,
              org_id: ninjaOrgMatch ? String(ninjaOrgMatch.id) : null,
              source_workspace: sourceWorkspace,
            });
          }
        }
      }

      finalFieldsUpdated.push(
        ...this.applyFinalRefinementToEnrichment({
          sections: iterativeEnrichment.sections,
          ticketNarrative,
          docs: scopedDocs,
          itglueConfigs,
          itgluePasswords,
          signals: scopedSignals,
          device,
          deviceDetails,
          loggedInUser,
          loggedInAt,
        })
      );

      evidenceDigest = this.buildEvidenceDigest({
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
      const finalRecords = this.flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = this.computeEnrichmentCoverage(finalRecords);
      iterativeEnrichment.rounds = this.buildEnrichmentRounds(finalRecords, sourceFindings);
      iterativeEnrichment.completed_rounds = iterativeEnrichment.rounds.at(-1)?.round ?? iterativeEnrichment.completed_rounds;

      finalRefinementAppendix = {
        round: 9,
        targets: finalRefinementPlan.targets,
        terms: finalRefinementPlan.terms.slice(0, 20),
        itglue_docs_added: finalItgDocsAdded,
        ninja_device_reselected: finalNinjaDeviceReselected,
        ninja_signals_added: finalNinjaSignalsAdded,
        fields_updated: [...new Set(finalFieldsUpdated)],
      };
    } catch (error) {
      sourceFindings.push({
        source: 'external',
        round: 9,
        facet: 'final_refinement',
        queried: true,
        matched: false,
        summary: 'final refinement orchestration failed',
        details: [`error: ${(error as Error).message}`],
        why_rejected: ['2f orchestration error'],
        tenant_id: tenantId,
        org_id: resolvedOrgId || null,
        source_workspace: sourceWorkspace,
      });
    }

    const networkStack = this.buildNetworkStackFromEnrichment(iterativeEnrichment.sections);
    const ssot = this.applyIntakeAntiRegressionToSSOT(
      this.buildTicketSSOT(iterativeEnrichment.sections),
      {
        ticket,
        normalizedTicket,
        companyName,
      }
    );
    if (fusionAudit) {
      ssot.fusion_audit = fusionAudit;
    }
    const ticketContextAppendix: TicketContextAppendix = {
      ticket_id: input.ticketId,
      session_id: input.sessionId,
      created_at: new Date().toISOString(),
      ...(historyAppendixCorrelation ? { history_correlation: historyAppendixCorrelation } : {}),
      ...(historyCalibrationAppendix ? { history_confidence_calibration: historyCalibrationAppendix } : {}),
      ...(fusionSummaryForAppendix ? { fusion_summary: fusionSummaryForAppendix } : {}),
      ...(finalRefinementAppendix ? { final_refinement: finalRefinementAppendix } : {}),
    };
    await persistTicketContextAppendix(input.ticketId, input.sessionId, ticketContextAppendix);
    await persistTicketSSOT(input.ticketId, input.sessionId, ssot);

    // ─── Status de Provedores Externos ───────────────────────────
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
    // ─── Monta EvidencePack ──────────────────────────────────────
    const ssotUser = {
      name: ssot.requester_name || 'Unknown user',
      email: ssot.requester_email || '',
    };
    const basePackObject = {
      session_id: input.sessionId,
      tenant_id: tenantId,
      source_workspace: sourceWorkspace,
      intake_context: {
        organization_hint: normalizedTicket?.organizationHint,
        device_hints: normalizedTicket?.deviceHints,
        symptoms: normalizedTicket?.symptoms,
        technology_facets: normalizedTicket?.technologyFacets,
      },
      ticket: {
        id: ssot.ticket_id || ticket.ticketNumber || String(ticket.id),
        title: ssot.title || ticket.title || '',
        description: ssot.description_clean || ticket.description || '',
        created_at: ssot.created_at || ticket.createDate || new Date().toISOString(),
        priority: this.mapAutotaskPriority((ticket as any).priority),
        queue: (ticket as any).queueName || 'Unknown',
        category: 'Support',
      },
      org: {
        id: resolvedOrgId || 'unknown',
        name: ssot.company || companyName || itglueOrgMatch?.name || ninjaOrgMatch?.name || 'Organization',
      },
      user: entityResolution.resolved_actor
        ? {
          name: entityResolution.resolved_actor.name,
          email: entityResolution.resolved_actor.email || '',
        }
        : ssotUser,
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
    deviceHints: string[];
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
          String(
            this.itgAttr(attrs, 'name') ||
            `${String(this.itgAttr(attrs, 'first_name') || '')} ${String(this.itgAttr(attrs, 'last_name') || '')}` ||
            ''
          ).trim()
        );
        const email = String(this.itgAttr(attrs, 'primary_email') || '').toLowerCase();
        const phone = String(this.itgAttr(attrs, 'primary_phone') || '');
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
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched?: ItglueEnrichedPayload | null;
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
      itgluePasswords: input.itgluePasswords,
      itglueAssets: input.itglueAssets,
      itglueEnriched: input.itglueEnriched || null,
      ninjaChecks: input.ninjaChecks,
      inferredPhoneProvider: input.inferredPhoneProvider,
    });
    const infraSection = this.buildInfraEnrichmentSection({
      itglueConfigs: input.itglueConfigs,
      itgluePasswords: input.itgluePasswords,
      itglueAssets: input.itglueAssets,
      itglueEnriched: input.itglueEnriched || null,
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
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched: ItglueEnrichedPayload | null;
    ninjaChecks: Signal[];
    inferredPhoneProvider: string | null;
  }): IterativeEnrichmentSections['network'] {
    const wanCandidate = this.extractITGlueWanCandidate({
      ticketNarrative: input.ticketNarrative,
      itglueAssets: input.itglueAssets,
      itglueConfigs: input.itglueConfigs,
      docs: input.docs,
    });
    const narrativeLocationContext = this.inferLocationContext(input.ticketNarrative);
    const locationContext = narrativeLocationContext !== 'unknown'
      ? narrativeLocationContext
      : wanCandidate?.location_hint
        ? 'office'
        : 'unknown';
    const publicIp = this.resolvePublicIp(input.device, input.deviceDetails);
    const itglueLlmIsp = this.pickEnrichedValue(input.itglueEnriched, 'isp_name');
    const ispName = itglueLlmIsp || wanCandidate?.isp_name || this.inferIspName({
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
        confidence: locationContext === 'unknown' ? 0 : narrativeLocationContext !== 'unknown' ? 0.65 : 0.75,
        sourceSystem: locationContext === 'unknown' ? 'unknown' : narrativeLocationContext !== 'unknown' ? 'ticket_narrative' : 'itglue',
        sourceRef: locationContext === 'unknown' ? undefined : narrativeLocationContext !== 'unknown' ? 'ticket.text' : wanCandidate?.source_ref,
        round: narrativeLocationContext !== 'unknown' ? 1 : 2,
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
        confidence: itglueLlmIsp ? 0.75 : wanCandidate?.isp_name ? Math.max(0.65, wanCandidate.confidence) : ispName ? 0.6 : 0,
        sourceSystem: itglueLlmIsp ? 'itglue_llm' : wanCandidate?.isp_name ? 'itglue' : ispName ? 'cross_correlation' : 'unknown',
        sourceRef: itglueLlmIsp ? 'itglue_org_snapshot' : wanCandidate?.isp_name ? wanCandidate.source_ref : ispName ? 'ticket/docs/itglue keyword' : undefined,
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
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched: ItglueEnrichedPayload | null;
    docs: Doc[];
  }): IterativeEnrichmentSections['infra'] {
    const metadataCandidates = this.extractITGlueInfraCandidates({
      itgluePasswords: input.itgluePasswords,
      itglueConfigs: input.itglueConfigs,
      itglueAssets: input.itglueAssets,
      docs: input.docs,
    });
    const firewallValue = this.pickEnrichedValue(input.itglueEnriched, 'firewall_make_model');
    const wifiValue = this.pickEnrichedValue(input.itglueEnriched, 'wifi_make_model');
    const switchValue = this.pickEnrichedValue(input.itglueEnriched, 'switch_make_model');
    const makeEnriched = (value: string) => ({
      value,
      status: 'inferred' as const,
      confidence: 0.75,
      sourceSystem: 'itglue_llm',
      sourceRef: 'itglue_org_snapshot',
      round: 2,
    });
    const firewall = firewallValue
      ? makeEnriched(firewallValue)
      : metadataCandidates.firewall || this.extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
    const wifi = wifiValue
      ? makeEnriched(wifiValue)
      : metadataCandidates.wifi || this.extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
    const sw = switchValue
      ? makeEnriched(switchValue)
      : metadataCandidates.switch || this.extractInfraMakeModel('switch', input.itglueConfigs, input.docs);

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

  private mergeDocsById(base: Doc[], extra: Doc[]): Doc[] {
    const map = new Map<string, Doc>();
    base.forEach((doc) => map.set(String(doc.id), doc));
    extra.forEach((doc) => {
      const key = String(doc.id);
      if (!map.has(key)) {
        map.set(key, doc);
      }
    });
    return Array.from(map.values());
  }

  private mergeRowsById<T extends { id?: string | number }>(base: T[], extra: T[]): T[] {
    const map = new Map<string, T>();
    const scoreRow = (row: T | undefined | null) => {
      if (!row || typeof row !== 'object') return 0;
      const attrs = (row as any)?.attributes;
      const attrKeys = attrs && typeof attrs === 'object' ? Object.keys(attrs).length : 0;
      return attrKeys + Object.keys(row as any).length * 0.01;
    };
    for (const row of base || []) {
      const id = String((row as any)?.id || '').trim();
      if (!id) continue;
      map.set(id, row);
    }
    for (const row of extra || []) {
      const id = String((row as any)?.id || '').trim();
      if (!id) continue;
      const existing = map.get(id);
      if (!existing || scoreRow(row) >= scoreRow(existing)) {
        map.set(id, row);
      }
    }
    return Array.from(map.values());
  }

  private mergeSignalsById(base: Signal[], extra: Signal[]): Signal[] {
    const map = new Map<string, Signal>();
    base.forEach((signal) => map.set(String(signal.id), signal));
    extra.forEach((signal) => {
      const key = String(signal.id);
      if (!map.has(key)) map.set(key, signal);
    });
    return Array.from(map.values());
  }

  private itgAttr(attrs: Record<string, unknown> | null | undefined, key: string): unknown {
    if (!attrs || typeof attrs !== 'object') return undefined;
    const source = attrs as Record<string, unknown>;
    const rawKey = String(key || '').trim();
    if (!rawKey) return undefined;

    const toCamel = (value: string) => value.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, c) => String(c).toUpperCase());
    const toKebab = (value: string) =>
      value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[_ ]+/g, '-')
        .toLowerCase();
    const toSnake = (value: string) =>
      value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[- ]+/g, '_')
        .toLowerCase();

    const candidates = [
      rawKey,
      toKebab(rawKey),
      toSnake(rawKey),
      toCamel(rawKey),
      toCamel(toSnake(rawKey)),
      toCamel(toKebab(rawKey)),
      rawKey.replace(/[-_]/g, ' '),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(source, candidate)) {
        return source[candidate];
      }
    }

    const traits = source.traits;
    if (traits && typeof traits === 'object') {
      // IT Glue flexible assets can store trait values in nested objects/arrays.
      const pairs = this.collectTextPairs(traits, 'traits');
      const keyNorm = toSnake(rawKey);
      const found = pairs.find((pair) => {
        const pairKey = toSnake(String(pair.key).split('.').pop() || pair.key);
        return pairKey === keyNorm || pairKey.endsWith(`_${keyNorm}`) || pairKey.includes(keyNorm);
      });
      if (found?.value) return found.value;
    }

    return undefined;
  }

  private parseITGlueOrgParentId(org: any): string | null {
    const attrs = org?.attributes || {};
    const value = this.itgAttr(attrs, 'parent_id');
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private parseITGlueOrgAncestorIds(org: any): string[] {
    const attrs = org?.attributes || {};
    const raw = this.itgAttr(attrs, 'ancestor_ids');
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v || '').trim()).filter(Boolean);
    }
    const text = String(raw ?? '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    } catch {
      // no-op
    }
    return text
      .split(/[,\s|]+/)
      .map((v) => String(v || '').trim())
      .filter(Boolean);
  }

  private async resolveITGlueOrgFamilyScopes(
    itglueClient: ITGlueClient,
    matchedOrg: { id: string; name: string },
    companyName?: string
  ): Promise<Array<{ id: string; name: string; reason: string }>> {
    const orgs = await itglueClient.getOrganizations(1000);
    const byId = new Map<string, any>(
      orgs
        .map((org: any): [string, any] => [String(org?.id || '').trim(), org])
        .filter(([id]) => Boolean(id))
    );
    const matched = byId.get(String(matchedOrg.id)) || null;
    if (!matched) {
      return [{ id: matchedOrg.id, name: matchedOrg.name, reason: 'matched' }];
    }

    const matchedId = String(matchedOrg.id);
    const matchedAncestors = new Set(this.parseITGlueOrgAncestorIds(matched));
    const matchedParentId = this.parseITGlueOrgParentId(matched);
    const familyCandidates: Array<{ org: any; score: number; reason: string; priority: number }> = [];
    const push = (org: any, reason: string, priority: number) => {
      const id = String(org?.id || '').trim();
      if (!id) return;
      const attrs = org?.attributes || {};
      const name = String(this.itgAttr(attrs, 'name') || '').trim() || id;
      const shortName = String(this.itgAttr(attrs, 'short_name') || '').trim();
      const score = companyName ? this.scoreOrgNameMatch(companyName, name, shortName) : 0;
      familyCandidates.push({ org, score, reason, priority });
    };

    push(matched, 'matched', 100);

    if (matchedParentId) {
      const parent = byId.get(matchedParentId);
      if (parent) push(parent, 'parent', 90);
    }
    for (const ancestorId of matchedAncestors) {
      const ancestor = byId.get(ancestorId);
      if (ancestor) push(ancestor, 'ancestor', 80);
    }

    for (const org of orgs) {
      const id = String(org?.id || '').trim();
      if (!id || id === matchedId) continue;
      const parentId = this.parseITGlueOrgParentId(org);
      const ancestors = this.parseITGlueOrgAncestorIds(org);
      if (parentId === matchedId || ancestors.includes(matchedId)) {
        push(org, 'descendant', 70);
        continue;
      }
      if (matchedParentId && (id === matchedParentId || parentId === matchedParentId || ancestors.includes(matchedParentId))) {
        push(org, 'sibling_family', 50);
      }
    }

    const deduped = new Map<string, { id: string; name: string; reason: string; score: number; priority: number }>();
    for (const candidate of familyCandidates) {
      const id = String(candidate.org?.id || '').trim();
      const attrs = candidate.org?.attributes || {};
      const name = String(this.itgAttr(attrs, 'name') || id);
      const existing = deduped.get(id);
      const next = { id, name, reason: candidate.reason, score: candidate.score, priority: candidate.priority };
      if (!existing || candidate.priority > existing.priority || (candidate.priority === existing.priority && candidate.score > existing.score)) {
        deduped.set(id, next);
      }
    }

    const scored = Array.from(deduped.values())
      .filter((x) => x.reason === 'matched' || x.reason === 'parent' || x.reason === 'ancestor' || x.score >= 0.45)
      .sort((a, b) => b.priority - a.priority || b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, ITGLUE_MAX_SCOPE_ORGS)
      .map(({ id, name, reason }) => ({ id, name, reason }));

    return scored.length > 0 ? scored : [{ id: matchedOrg.id, name: matchedOrg.name, reason: 'matched' }];
  }

  private hashSnapshot(snapshot: Record<string, unknown>): string {
    const json = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(`${ITGLUE_EXTRACTOR_VERSION}:${json}`).digest('hex');
  }

  private hashSnapshotWithVersion(snapshot: Record<string, unknown>, version: string): string {
    const json = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(`${version}:${json}`).digest('hex');
  }

  private pickEnrichedValue(payload: ItglueEnrichedPayload | null, key: string): string | null {
    if (!payload || !payload.fields || !payload.fields[key]) return null;
    const value = String(payload.fields[key]?.value || '').trim();
    if (!value || value.toLowerCase() === 'unknown') return null;
    return value;
  }

  private buildItglueExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    const configs = Array.isArray((snapshot as any).configs) ? (snapshot as any).configs : [];
    const passwords = Array.isArray((snapshot as any).passwords) ? (snapshot as any).passwords : [];
    const assets = Array.isArray((snapshot as any).assets) ? (snapshot as any).assets : [];
    const docs = Array.isArray((snapshot as any).docs) ? (snapshot as any).docs : [];
    const documentsRaw = Array.isArray((snapshot as any).documents_raw) ? (snapshot as any).documents_raw : [];
    const documentAttachmentsById = ((snapshot as any).document_attachments_by_id && typeof (snapshot as any).document_attachments_by_id === 'object')
      ? (snapshot as any).document_attachments_by_id
      : {};
    const documentRelatedItemsById = ((snapshot as any).document_related_items_by_id && typeof (snapshot as any).document_related_items_by_id === 'object')
      ? (snapshot as any).document_related_items_by_id
      : {};
    const locations = Array.isArray((snapshot as any).locations) ? (snapshot as any).locations : [];
    const domains = Array.isArray((snapshot as any).domains) ? (snapshot as any).domains : [];
    const sslCertificates = Array.isArray((snapshot as any).ssl_certificates) ? (snapshot as any).ssl_certificates : [];
    const contacts = Array.isArray((snapshot as any).contacts) ? (snapshot as any).contacts : [];

    return {
      org_id: (snapshot as any).org_id,
      org_name: (snapshot as any).org_name,
      organization_details: (snapshot as any).organization_details || {},
      configs: configs.slice(0, 200).map((c: any) => ({
        id: c?.id,
        name: this.itgAttr(c?.attributes || {}, 'name') || c?.name,
        manufacturer:
          this.itgAttr(c?.attributes || {}, 'manufacturer_name') ||
          this.itgAttr(c?.attributes || {}, 'manufacturer') ||
          c?.manufacturer,
        model:
          this.itgAttr(c?.attributes || {}, 'model_name') ||
          this.itgAttr(c?.attributes || {}, 'model') ||
          c?.model,
        type:
          this.itgAttr(c?.attributes || {}, 'configuration_type_name') ||
          this.itgAttr(c?.attributes || {}, 'type'),
      })),
      passwords: passwords.slice(0, 200).map((p: any) => ({
        id: p?.id,
        name: this.itgAttr(p?.attributes || {}, 'name') || p?.name,
        username:
          this.itgAttr(p?.attributes || {}, 'username') ||
          this.itgAttr(p?.attributes || {}, 'user_name') ||
          p?.username,
        resource:
          this.itgAttr(p?.attributes || {}, 'resource_name') ||
          this.itgAttr(p?.attributes || {}, 'resource') ||
          p?.resource,
        category:
          this.itgAttr(p?.attributes || {}, 'password_category_name') ||
          this.itgAttr(p?.attributes || {}, 'category') ||
          p?.category,
      })),
      contacts: contacts.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name:
          this.itgAttr(x?.attributes || {}, 'name') ||
          [
            this.itgAttr(x?.attributes || {}, 'first_name'),
            this.itgAttr(x?.attributes || {}, 'last_name'),
          ]
            .filter(Boolean)
            .join(' '),
        email: this.itgAttr(x?.attributes || {}, 'primary_email'),
        phone: this.itgAttr(x?.attributes || {}, 'primary_phone'),
        type: this.itgAttr(x?.attributes || {}, 'contact_type_name'),
      })),
      assets: assets.slice(0, 200).map((a: any) => ({
        id: a?.id,
        name: this.itgAttr(a?.attributes || {}, 'name') || a?.name,
        type:
          this.itgAttr(a?.attributes || {}, 'flexible_asset_type_name') ||
          this.itgAttr(a?.attributes || {}, 'type'),
        provider:
          this.itgAttr(a?.attributes || {}, 'provider') ||
          this.itgAttr(a?.attributes || {}, 'isp') ||
          this.itgAttr(a?.attributes || {}, 'carrier'),
        location:
          this.itgAttr(a?.attributes || {}, 'location') ||
          this.itgAttr(a?.attributes || {}, 'locations') ||
          this.itgAttr(a?.attributes || {}, 'site') ||
          this.itgAttr(a?.attributes || {}, 'address'),
      })),
      locations: locations.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: this.itgAttr(x?.attributes || {}, 'name') || x?.name,
        city: this.itgAttr(x?.attributes || {}, 'city'),
        state:
          this.itgAttr(x?.attributes || {}, 'region_name') ||
          this.itgAttr(x?.attributes || {}, 'state'),
        country:
          this.itgAttr(x?.attributes || {}, 'country_name') ||
          this.itgAttr(x?.attributes || {}, 'country'),
      })),
      domains: domains.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: this.itgAttr(x?.attributes || {}, 'name') || x?.name,
      })),
      ssl_certificates: sslCertificates.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: this.itgAttr(x?.attributes || {}, 'name') || x?.name,
        active: this.itgAttr(x?.attributes || {}, 'active'),
        issued_by: this.itgAttr(x?.attributes || {}, 'issued_by'),
      })),
      docs: docs.slice(0, 50).map((d: any) => ({
        id: d?.id,
        title: d?.title || d?.name,
      })),
      documents_raw: documentsRaw.slice(0, 100).map((d: any) => ({
        id: d?.id,
        name: this.itgAttr(d?.attributes || {}, 'name') || d?.name,
        type:
          this.itgAttr(d?.attributes || {}, 'document_type_name') ||
          this.itgAttr(d?.attributes || {}, 'document_type') ||
          d?.documentType,
        updated_at: this.itgAttr(d?.attributes || {}, 'updated_at') || d?.updatedAt,
      })),
      document_attachments_sample: Object.entries(documentAttachmentsById)
        .slice(0, 50)
        .map(([docId, items]: [string, any]) => ({
          document_id: docId,
          count: Array.isArray(items) ? items.length : 0,
          names: Array.isArray(items)
            ? items
              .slice(0, 5)
              .map((x: any) => this.itgAttr(x?.attributes || {}, 'name') || this.itgAttr(x?.attributes || {}, 'file_name') || x?.name)
              .filter(Boolean)
            : [],
        })),
      document_related_items_sample: Object.entries(documentRelatedItemsById)
        .slice(0, 50)
        .map(([docId, items]: [string, any]) => ({
          document_id: docId,
          count: Array.isArray(items) ? items.length : 0,
          item_types: Array.isArray(items)
            ? [...new Set(items
              .slice(0, 20)
              .map((x: any) => this.itgAttr(x?.attributes || {}, 'resource_type') || this.itgAttr(x?.attributes || {}, 'item_type') || 'unknown'))]
            : [],
        })),
      collection_errors: Array.isArray((snapshot as any).collection_errors) ? (snapshot as any).collection_errors.slice(0, 20) : [],
    };
  }

  private buildNinjaExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    const devices = Array.isArray((snapshot as any).devices) ? (snapshot as any).devices : [];
    const alerts = Array.isArray((snapshot as any).alerts) ? (snapshot as any).alerts : [];
    const softwareInventory = Array.isArray((snapshot as any).software_inventory_query) ? (snapshot as any).software_inventory_query : [];
    const checks = Array.isArray((snapshot as any).selected_device_checks) ? (snapshot as any).selected_device_checks : [];
    const contextSignals = Array.isArray((snapshot as any).selected_device_context_signals) ? (snapshot as any).selected_device_context_signals : [];
    const selectedDevice = (snapshot as any).selected_device || {};
    const selectedDeviceDetails = (snapshot as any).selected_device_details || {};

    return {
      org_id: (snapshot as any).org_id,
      org_name: (snapshot as any).org_name,
      organization_details: (snapshot as any).organization_details || {},
      device_count: devices.length,
      alert_count: alerts.length,
      selected_device: {
        id: selectedDevice.id,
        hostname: selectedDevice.hostname || selectedDevice.systemName,
        os_name: selectedDevice.osName,
        os_version: selectedDevice.osVersion,
        ip_address: selectedDevice.ipAddress,
        last_contact: selectedDevice.lastContact || selectedDevice.lastActivityTime,
        online: selectedDevice.online,
      },
      selected_device_details: {
        hostname: selectedDeviceDetails.hostname,
        os_name: selectedDeviceDetails.osName,
        os_version: selectedDeviceDetails.osVersion,
        ip_address: selectedDeviceDetails.ipAddress,
        last_activity_time: selectedDeviceDetails.lastActivityTime,
        properties: selectedDeviceDetails.properties || {},
      },
      selected_device_checks: checks.slice(0, 100),
      selected_device_context_signals: contextSignals.slice(0, 100).map((s: any) => ({
        id: s?.id,
        type: s?.type,
        summary: s?.summary,
        timestamp: s?.timestamp,
      })),
      recent_alerts: alerts.slice(0, 100).map((a: any) => ({
        uid: a?.uid,
        severity: a?.severity,
        message: a?.message,
        device_id: a?.deviceId,
        device_name: a?.deviceName,
      })),
      software_inventory_query: softwareInventory.slice(0, 300).map((row: any) => ({
        device_id: row?.deviceId,
        name: row?.name,
        version: row?.version,
        publisher: row?.publisher,
        timestamp: row?.timestamp,
      })),
      devices_sample: devices.slice(0, 200).map((d: any) => ({
        id: d?.id,
        hostname: d?.hostname || d?.systemName,
        os_name: d?.osName,
        os_version: d?.osVersion,
        ip_address: d?.ipAddress,
        last_contact: d?.lastContact || d?.lastActivityTime,
        online: d?.online,
      })),
      logged_in_user: (snapshot as any).logged_in_user || '',
      logged_in_at: (snapshot as any).logged_in_at || '',
      resolved_device_score: (snapshot as any).resolved_device_score ?? null,
      collection_errors: Array.isArray((snapshot as any).collection_errors) ? (snapshot as any).collection_errors.slice(0, 20) : [],
    };
  }

  private async getOrRefreshItglueEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
  }): Promise<ItglueEnrichedPayload | null> {
    const cached = await getItglueOrgEnriched(input.orgId);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (cached) {
      const updatedAt = new Date(cached.updated_at || cached.created_at || 0).getTime();
      const isFresh = Number.isFinite(updatedAt) && (Date.now() - updatedAt) < ttlMs;
      if (isFresh && cached.source_hash === input.sourceHash) {
        return cached.payload as unknown as ItglueEnrichedPayload;
      }
    }

    const summary = this.buildItglueExtractionInput(input.snapshot);
    const prompt = `You are an IT Glue data extractor. Given a JSON summary of ALL configs, passwords, assets, and docs for an organization, extract ONLY the fields below and return valid JSON.\n\nRules:\n1. If value unknown, set value to \"unknown\" and confidence to 0.\n2. Include evidence_refs as JSON path hints (e.g., \"passwords[12].name\").\n3. Return ONLY JSON, no extra text.\n\nOutput schema:\n{\n  \"org_id\": \"string\",\n  \"source_hash\": \"string\",\n  \"fields\": {\n    \"firewall_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"wifi_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"switch_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"isp_name\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] }\n  }\n}\n\nSnapshot JSON:\n${JSON.stringify(summary).slice(0, 12000)}`;

    try {
      const llm = await callLLM(prompt);
      const parsed = this.extractJsonObject(llm.content);
      const fields = (parsed?.fields && typeof parsed.fields === 'object')
        ? (parsed.fields as Record<string, ItglueEnrichedField>)
        : {};
      const payload: ItglueEnrichedPayload = {
        org_id: String(parsed?.org_id || input.orgId),
        source_hash: String(parsed?.source_hash || input.sourceHash),
        fields,
        created_at: new Date().toISOString(),
      };
      await upsertItglueOrgEnriched(input.orgId, payload as unknown as Record<string, unknown>, input.sourceHash);
      return payload;
    } catch (error) {
      console.error('[PrepareContext] IT Glue enrichment failed:', error);
      return cached ? (cached.payload as unknown as ItglueEnrichedPayload) : null;
    }
  }

  private async getOrRefreshNinjaEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
  }): Promise<NinjaEnrichedPayload | null> {
    const cached = await getNinjaOrgEnriched(input.orgId);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (cached) {
      const updatedAt = new Date(cached.updated_at || cached.created_at || 0).getTime();
      const isFresh = Number.isFinite(updatedAt) && (Date.now() - updatedAt) < ttlMs;
      if (isFresh && cached.source_hash === input.sourceHash) {
        return cached.payload as unknown as NinjaEnrichedPayload;
      }
    }

    const summary = this.buildNinjaExtractionInput(input.snapshot);
    const prompt = `You are a NinjaOne data extractor. Given a JSON summary of endpoint and organization telemetry, extract ONLY the fields below and return valid JSON.

Rules:
1. If value unknown, set value to "unknown" and confidence to 0.
2. Include evidence_refs as JSON path hints (e.g., "selected_device.hostname", "selected_device_checks[2].name").
3. Return ONLY JSON.

Output schema:
{
  "org_id": "string",
  "source_hash": "string",
  "fields": {
    "device_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "device_type": { "value": "desktop|laptop|mobile|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "os_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "os_version": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "last_check_in": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "security_agent_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "security_agent_present": { "value": "present|absent|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "user_signed_in": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "public_ip": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "vpn_state": { "value": "connected|disconnected|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] }
  }
}

Snapshot JSON:
${JSON.stringify(summary).slice(0, 14000)}`;

    try {
      const llm = await callLLM(prompt);
      const parsed = this.extractJsonObject(llm.content);
      const fields = (parsed?.fields && typeof parsed.fields === 'object')
        ? (parsed.fields as Record<string, NinjaEnrichedField>)
        : {};
      const payload: NinjaEnrichedPayload = {
        org_id: String(parsed?.org_id || input.orgId),
        source_hash: String(parsed?.source_hash || input.sourceHash),
        fields,
        created_at: new Date().toISOString(),
      };
      await upsertNinjaOrgEnriched(input.orgId, payload as unknown as Record<string, unknown>, input.sourceHash);
      return payload;
    } catch (error) {
      console.error('[PrepareContext] Ninja enrichment failed:', error);
      return cached ? (cached.payload as unknown as NinjaEnrichedPayload) : null;
    }
  }

  private buildTicketSSOT(sections: IterativeEnrichmentSections): TicketSSOT {
    const ticket = sections.ticket;
    const identity = sections.identity;
    const endpoint = sections.endpoint;
    const network = sections.network;
    const infra = sections.infra;

    return {
      ticket_id: String(ticket.ticket_id.value || 'unknown'),
      company: String(ticket.company.value || 'unknown'),
      requester_name: String(ticket.requester_name.value || 'unknown'),
      requester_email: String(ticket.requester_email.value || 'unknown'),
      affected_user_name: String(ticket.affected_user_name.value || ticket.requester_name.value || 'unknown'),
      affected_user_email: String(ticket.affected_user_email.value || ticket.requester_email.value || 'unknown'),
      created_at: String(ticket.created_at.value || 'unknown'),
      title: String(ticket.title.value || 'unknown'),
      description_clean: String(ticket.description_clean.value || 'unknown'),
      user_principal_name: String(identity.user_principal_name.value || 'unknown'),
      account_status: String(identity.account_status.value || 'unknown'),
      mfa_state: String(identity.mfa_state.value || 'unknown'),
      licenses_summary: String(identity.licenses_summary.value || 'Unknown'),
      groups_top: String(identity.groups_top.value || 'unknown'),
      device_name: String(endpoint.device_name.value || 'unknown'),
      device_type: String(endpoint.device_type.value || 'unknown'),
      os_name: String(endpoint.os_name.value || 'unknown'),
      os_version: String(endpoint.os_version.value || 'unknown'),
      last_check_in: String(endpoint.last_check_in.value || 'unknown'),
      security_agent: endpoint.security_agent.value as TicketSSOT['security_agent'],
      user_signed_in: String(endpoint.user_signed_in.value || 'unknown'),
      location_context: String(network.location_context.value || 'unknown'),
      public_ip: String(network.public_ip.value || 'unknown'),
      isp_name: String(network.isp_name.value || 'unknown'),
      vpn_state: String(network.vpn_state.value || 'unknown'),
      phone_provider: String(network.phone_provider.value || 'unknown'),
      phone_provider_name: String(network.phone_provider_name.value || 'unknown'),
      firewall_make_model: String(infra.firewall_make_model.value || 'unknown'),
      wifi_make_model: String(infra.wifi_make_model.value || 'unknown'),
      switch_make_model: String(infra.switch_make_model.value || 'unknown'),
    };
  }

  private applyIntakeAntiRegressionToSSOT(
    ssot: TicketSSOT,
    input: {
      ticket: TicketLike;
      normalizedTicket: {
        requesterName?: string;
        requesterEmail?: string;
        affectedUserName?: string;
        affectedUserEmail?: string;
        title?: string;
        descriptionCanonical?: string;
        descriptionUi?: string;
      } | null;
      companyName?: string;
    }
  ): TicketSSOT {
    const out: TicketSSOT = { ...ssot };

    const isUnknown = (v: unknown) => {
      const s = String(v ?? '').trim().toLowerCase();
      return !s || s === 'unknown' || s === 'n/a' || s === 'none' || s === 'null';
    };
    const pickBetter = (current: unknown, ...candidates: unknown[]) => {
      if (!isUnknown(current)) return String(current).trim();
      for (const c of candidates) {
        if (!isUnknown(c)) return String(c).trim();
      }
      return String(current || 'unknown').trim() || 'unknown';
    };

    const ticket = input.ticket;
    const normalized = input.normalizedTicket || null;
    const intakeCompanyRaw = String(ticket.company || '').trim();
    const inferredCompanyRaw = String(input.companyName || '').trim();
    const normalizeCompanyComparable = (value: string) =>
      this.normalizeOrgNameForMatch(this.normalizeName(String(value || '')));

    const currentCompanyRaw = String(out.company || '').trim();
    const canOverrideDomainDerivedIntakeWithCurrent =
      !isUnknown(currentCompanyRaw) && this.shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, currentCompanyRaw);
    const canOverrideDomainDerivedIntakeWithInferred =
      !isUnknown(inferredCompanyRaw) && this.shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, inferredCompanyRaw);

    // Company is display-critical. Preserve intake formatting unless the intake value is a domain-derived fallback
    // and a better display-ready company name was inferred or already assembled in the SSOT.
    if (!isUnknown(intakeCompanyRaw) && !canOverrideDomainDerivedIntakeWithCurrent && !canOverrideDomainDerivedIntakeWithInferred) {
      out.company = intakeCompanyRaw;
    } else if (!isUnknown(inferredCompanyRaw)) {
      if (
        isUnknown(out.company) ||
        normalizeCompanyComparable(String(out.company || '')) === normalizeCompanyComparable(inferredCompanyRaw)
      ) {
        out.company = inferredCompanyRaw;
      } else {
        out.company = pickBetter(out.company, inferredCompanyRaw);
      }
    } else {
      out.company = pickBetter(out.company);
    }

    out.requester_name = pickBetter(
      out.requester_name,
      this.normalizeName(ticket.canonicalRequesterName || ''),
      this.normalizeName(normalized?.requesterName || ''),
      this.normalizeName(ticket.requester || '')
    );

    out.requester_email = pickBetter(
      out.requester_email,
      String(ticket.canonicalRequesterEmail || '').trim().toLowerCase(),
      String(normalized?.requesterEmail || '').trim().toLowerCase(),
      this.extractFirstEmail(ticket.requester || ''),
      this.extractFirstEmail(ticket.rawBody || ''),
      this.extractFirstEmail(ticket.description || '')
    );

    out.affected_user_name = pickBetter(
      out.affected_user_name,
      this.normalizeName(ticket.canonicalAffectedName || ''),
      this.normalizeName(normalized?.affectedUserName || '')
    );

    out.affected_user_email = pickBetter(
      out.affected_user_email,
      String(ticket.canonicalAffectedEmail || '').trim().toLowerCase(),
      String(normalized?.affectedUserEmail || '').trim().toLowerCase()
    );

    out.title = pickBetter(
      out.title,
      String(normalized?.title || '').trim(),
      String(ticket.title || '').trim()
    );

    out.description_clean = pickBetter(
      out.description_clean,
      String(normalized?.descriptionUi || '').trim(),
      String(normalized?.descriptionCanonical || '').trim(),
      String(ticket.description || '').trim()
    );

    out.created_at = pickBetter(
      out.created_at,
      String(ticket.createDate || '').trim()
    );

    return out;
  }

  private async runCrossSourceFusion(input: {
    sections: IterativeEnrichmentSections;
    ticket: TicketLike;
    ticketNarrative: string;
    normalizedTicket: any | null;
    itglueContacts: any[];
    itglueConfigs: any[];
    itglueEnriched: ItglueEnrichedPayload | null;
    ninjaEnriched: NinjaEnrichedPayload | null;
    ninjaOrgDevices: any[];
    ninjaSoftwareInventory: any[];
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
  }): Promise<{
    sections: IterativeEnrichmentSections;
    audit: Record<string, unknown>;
    appliedResolutionCount: number;
    candidateFieldCount: number;
    linkCount: number;
    inferenceCount: number;
    usedLlm: boolean;
  } | null> {
    const supportedPaths = this.getFusionSupportedPaths();
    const fieldCandidates = this.buildFusionFieldCandidates(input, supportedPaths);
    const { links, inferences } = this.buildFusionLinksAndInferences(input);

    if (fieldCandidates.length === 0 && links.length === 0) return null;

    let llmOutput: FusionAdjudicationOutput | null = null;
    let usedLlm = false;
    let llmError: string | null = null;

    try {
      const prompt = this.buildFusionAdjudicationPrompt({
        ticket: input.ticket,
        ticketNarrative: input.ticketNarrative,
        fieldCandidates,
        links,
        inferences,
      });
      const llm = await callLLM(prompt);
      const parsed = this.extractJsonObject(llm.content);
      llmOutput = this.sanitizeFusionAdjudicationOutput(parsed, supportedPaths);
      usedLlm = true;
    } catch (error) {
      llmError = (error as Error)?.message || String(error);
    }

    const fallbackResolutions = this.buildDeterministicFusionFallbackResolutions(input, links);
    const validatedLlmResolutions = this.validateFusionLlmResolutions({
      resolutions: llmOutput?.resolutions || [],
      fieldCandidates,
      deterministicLinks: links,
      deterministicInferences: inferences,
    });
    const mergedOutput: FusionAdjudicationOutput = {
      resolutions: [
        ...validatedLlmResolutions.filter((r) => supportedPaths.has(r.path)),
        ...fallbackResolutions.filter((r) => !validatedLlmResolutions.some((x) => x.path === r.path)),
      ],
      // Never trust LLM-generated links/inferences directly; keep only deterministic candidates built by the pipeline.
      links,
      inferences,
      conflicts: llmOutput?.conflicts || [],
    };

    const applied = this.applyFusionResolutionsToSections(input.sections, mergedOutput.resolutions);

    const audit: Record<string, unknown> = {
      version: 'fusion-v1-assembled-inference',
      used_llm: usedLlm,
      ...(llmError ? { llm_error: llmError } : {}),
      candidate_fields: fieldCandidates,
      links: mergedOutput.links || [],
      inferences: mergedOutput.inferences || [],
      resolutions: mergedOutput.resolutions,
      conflicts: mergedOutput.conflicts || [],
      applied_resolution_count: applied.appliedCount,
      applied_paths: applied.appliedPaths,
    };

    return {
      sections: applied.sections,
      audit,
      appliedResolutionCount: applied.appliedCount,
      candidateFieldCount: fieldCandidates.length,
      linkCount: (mergedOutput.links || []).length,
      inferenceCount: (mergedOutput.inferences || []).length,
      usedLlm,
    };
  }

  private getFusionSupportedPaths(): Set<string> {
    return new Set([
      'ticket.requester_name',
      'ticket.requester_email',
      'ticket.affected_user_name',
      'ticket.affected_user_email',
      'identity.user_principal_name',
      'identity.account_status',
      'identity.mfa_state',
      'identity.licenses_summary',
      'endpoint.device_name',
      'endpoint.device_type',
      'endpoint.os_name',
      'endpoint.os_version',
      'endpoint.last_check_in',
      'endpoint.user_signed_in',
      'network.public_ip',
      'network.isp_name',
      'network.vpn_state',
      'network.location_context',
      'infra.firewall_make_model',
      'infra.wifi_make_model',
      'infra.switch_make_model',
    ]);
  }

  private buildFusionFieldCandidates(input: {
    sections: IterativeEnrichmentSections;
    ticket: TicketLike;
    normalizedTicket: any | null;
    itglueEnriched: ItglueEnrichedPayload | null;
    ninjaEnriched: NinjaEnrichedPayload | null;
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
  }, supportedPaths: Set<string>): FusionFieldCandidate[] {
    const out: FusionFieldCandidate[] = [];
    const push = (candidate: FusionFieldCandidate) => {
      if (!supportedPaths.has(candidate.path)) return;
      const v = candidate.value;
      if (v === undefined || v === null) return;
      if (typeof v === 'string' && !String(v).trim()) return;
      out.push(candidate);
    };

    for (const record of this.flattenEnrichmentFields(input.sections)) {
      if (!supportedPaths.has(record.path)) continue;
      push({
        path: record.path,
        source: `baseline:${record.field.source_system}`,
        value: (record.field as any).value,
        status: record.field.status,
        confidence: Number(record.field.confidence || 0),
        evidence_refs: [record.field.source_ref || record.path].filter(Boolean),
      });
    }

    const itgMap: Record<string, string> = {
      isp_name: 'network.isp_name',
      firewall_make_model: 'infra.firewall_make_model',
      wifi_make_model: 'infra.wifi_make_model',
      switch_make_model: 'infra.switch_make_model',
    };
    for (const [itKey, path] of Object.entries(itgMap)) {
      const raw = input.itglueEnriched?.fields?.[itKey];
      if (!raw) continue;
      push({
        path,
        source: 'itglue_enriched',
        value: raw.value,
        status: String(raw.value || '').toLowerCase() === 'unknown' ? 'unknown' : 'inferred',
        confidence: Number(raw.confidence || 0),
        evidence_refs: Array.isArray(raw.evidence_refs) ? raw.evidence_refs.map((r) => `itglue.${r}`) : [],
      });
    }

    const ninjaMap: Record<string, string> = {
      device_name: 'endpoint.device_name',
      device_type: 'endpoint.device_type',
      os_name: 'endpoint.os_name',
      os_version: 'endpoint.os_version',
      last_check_in: 'endpoint.last_check_in',
      user_signed_in: 'endpoint.user_signed_in',
      public_ip: 'network.public_ip',
      vpn_state: 'network.vpn_state',
    };
    for (const [nKey, path] of Object.entries(ninjaMap)) {
      const raw = input.ninjaEnriched?.fields?.[nKey];
      if (!raw) continue;
      push({
        path,
        source: 'ninja_enriched',
        value: raw.value,
        status: String(raw.value || '').toLowerCase() === 'unknown' ? 'unknown' : 'inferred',
        confidence: Number(raw.confidence || 0),
        evidence_refs: Array.isArray(raw.evidence_refs) ? raw.evidence_refs.map((r) => `ninja.${r}`) : [],
      });
    }

    push({
      path: 'endpoint.device_name',
      source: 'ninja_selected_device',
      value: String(input.device?.hostname || input.device?.systemName || ''),
      status: input.device ? 'confirmed' : 'unknown',
      confidence: input.device ? 0.9 : 0,
      evidence_refs: ['ninja.selected_device.hostname'],
    });
    push({
      path: 'endpoint.os_name',
      source: 'ninja_selected_device',
      value: String(input.deviceDetails?.osName || input.device?.osName || ''),
      status: (input.deviceDetails || input.device) ? 'confirmed' : 'unknown',
      confidence: (input.deviceDetails || input.device) ? 0.88 : 0,
      evidence_refs: ['ninja.selected_device_details.osName'],
    });
    push({
      path: 'endpoint.os_version',
      source: 'ninja_selected_device',
      value: String(input.deviceDetails?.osVersion || input.device?.osVersion || ''),
      status: (input.deviceDetails || input.device) ? 'confirmed' : 'unknown',
      confidence: (input.deviceDetails || input.device) ? 0.85 : 0,
      evidence_refs: ['ninja.selected_device_details.osVersion'],
    });
    push({
      path: 'endpoint.last_check_in',
      source: 'ninja_selected_device',
      value: String(input.device?.lastContact || input.device?.lastActivityTime || input.loggedInAt || ''),
      status: input.device ? 'confirmed' : 'unknown',
      confidence: input.device ? 0.85 : 0,
      evidence_refs: ['ninja.selected_device.lastContact'],
    });
    push({
      path: 'endpoint.user_signed_in',
      source: 'ninja_last_login',
      value: String(input.loggedInUser || ''),
      status: input.loggedInUser ? 'inferred' : 'unknown',
      confidence: input.loggedInUser ? 0.8 : 0,
      evidence_refs: ['ninja.last_logged_on_user'],
    });
    push({
      path: 'identity.user_principal_name',
      source: 'ticket_normalized',
      value: String(input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail || ''),
      status: input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail ? 'inferred' : 'unknown',
      confidence: input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail ? 0.7 : 0,
      evidence_refs: ['ticket.normalized.round0'],
    });

    return out
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 200);
  }

  private buildFusionLinksAndInferences(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    itglueContacts: any[];
    ninjaSoftwareInventory: any[];
    device: any | null;
    loggedInUser: string;
  }): { links: FusionLink[]; inferences: FusionInference[] } {
    const links: FusionLink[] = [];
    const inferences: FusionInference[] = [];
    const loggedUser = this.normalizeSimpleToken(input.loggedInUser || '');

    const requesterName = this.normalizeName(String(input.ticket.canonicalRequesterName || input.ticket.requester || ''));
    const affectedName = this.normalizeName(String(input.ticket.canonicalAffectedName || ''));
    const actorName = affectedName && affectedName.toLowerCase() !== 'unknown' ? affectedName : requesterName;
    const actorAliases = this.generateNameAliases(actorName);

    if (loggedUser && input.itglueContacts.length > 0) {
      let best: { contact: any; score: number; refs: string[]; note: string } | null = null;
      for (const contact of input.itglueContacts.slice(0, 200)) {
        const attrs = contact?.attributes || contact || {};
        const contactName = this.normalizeName(String(
          this.itgAttr(attrs, 'name') ||
          [this.itgAttr(attrs, 'first_name'), this.itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
        ));
        const email = String(this.itgAttr(attrs, 'primary_email') || '').toLowerCase().trim();
        const emailLocal = this.normalizeSimpleToken(email.split('@')[0] || '');
        const aliases = this.generateNameAliases(contactName);
        let score = 0;
        const refs: string[] = [];
        if (emailLocal && emailLocal === loggedUser) { score += 0.95; refs.push(`itglue.contact:${contact?.id}.primary_email`); }
        if (aliases.has(loggedUser)) { score = Math.max(score, 0.88); refs.push(`itglue.contact:${contact?.id}.name_alias`); }
        if (actorAliases.has(loggedUser)) { score = Math.max(score, 0.82); refs.push('ticket.actor_alias'); }
        if (emailLocal && actorAliases.has(emailLocal)) { score = Math.max(score, 0.86); refs.push('ticket.actor_email_alias'); }
        if (score > 0 && (!best || score > best.score)) {
          best = { contact, score, refs: [...new Set(refs)], note: `${contactName || 'contact'} ↔ ${loggedUser}` };
        }
      }
      if (best) {
        const contactId = String(best.contact?.id || 'unknown');
        links.push({
          id: `link-identity-${contactId}-${loggedUser}`,
          kind: 'identity_alias',
          from_entity: `itglue_contact:${contactId}`,
          to_entity: `ninja_user:${loggedUser}`,
          confidence: Number(best.score.toFixed(3)),
          evidence_refs: [...best.refs, 'ninja.last_logged_on_user'],
          note: best.note,
        });
        inferences.push({
          id: `inf-identity-${contactId}`,
          claim: `IT Glue contact likely matches Ninja last logged-on user ${loggedUser}`,
          type: 'identity_link',
          confidence: Number(best.score.toFixed(3)),
          evidence_chain: [...best.refs, 'ninja.last_logged_on_user'],
        });
      }
    }

    if (input.device && loggedUser) {
      links.push({
        id: `link-device-user-${String(input.device.id || 'selected')}`,
        kind: 'device_user',
        from_entity: `device:${String(input.device.id || 'selected')}`,
        to_entity: `ninja_user:${loggedUser}`,
        confidence: 0.84,
        evidence_refs: ['ninja.selected_device', 'ninja.last_logged_on_user'],
        note: 'Selected device and last logged-on user observed in same org scope',
      });
    }

    const ticketSoftwareMentions = this.extractSoftwareHintsFromTicket(input.ticketNarrative);
    if (ticketSoftwareMentions.length > 0 && Array.isArray(input.ninjaSoftwareInventory) && input.ninjaSoftwareInventory.length > 0) {
      const byDevice = new Map<string, { hits: string[]; score: number }>();
      for (const row of input.ninjaSoftwareInventory.slice(0, 500)) {
        const softwareName = String(row?.name || '').toLowerCase();
        if (!softwareName) continue;
        for (const mention of ticketSoftwareMentions) {
          if (softwareName.includes(mention) || mention.includes(softwareName)) {
            const did = String(row?.deviceId || 'unknown');
            const current = byDevice.get(did) || { hits: [], score: 0 };
            current.hits.push(String(row?.name || mention));
            current.score += 0.4;
            byDevice.set(did, current);
          }
        }
      }
      for (const [deviceId, hit] of Array.from(byDevice.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, 5)) {
        const confidence = Math.max(0.45, Math.min(0.9, hit.score));
        links.push({
          id: `link-ticket-soft-${deviceId}`,
          kind: 'ticket_software_device',
          from_entity: 'ticket:current',
          to_entity: `device:${deviceId}`,
          confidence: Number(confidence.toFixed(3)),
          evidence_refs: ['ticket.software_mentions', `ninja.software_inventory_query.device:${deviceId}`],
          note: `Ticket software hints matched Ninja software inventory (${[...new Set(hit.hits)].slice(0, 3).join(', ')})`,
        });
        inferences.push({
          id: `inf-soft-${deviceId}`,
          claim: `Ticket may relate to device ${deviceId} based on software inventory matches`,
          type: 'software_relevance',
          confidence: Number(confidence.toFixed(3)),
          evidence_chain: ['ticket.software_mentions', `ninja.software_inventory_query.device:${deviceId}`],
        });
      }
    }

    return { links, inferences };
  }

  private buildFusionAdjudicationPrompt(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    fieldCandidates: FusionFieldCandidate[];
    links: FusionLink[];
    inferences: FusionInference[];
  }): string {
    const grouped: Record<string, FusionFieldCandidate[]> = {};
    for (const c of input.fieldCandidates) {
      const bucket = grouped[c.path] || (grouped[c.path] = []);
      if (bucket.length < 6) bucket.push(c);
    }
    return `You are a cross-source data fusion adjudicator for IT support triage.

Task:
- Resolve fields using complementary evidence across ticket/email, IT Glue, and NinjaOne.
- DO NOT use "winner source" thinking; sources may complement each other.
- You MAY infer using multi-hop evidence chains (e.g., user name <-> alias <-> last login <-> software on device), but only if you provide evidence_refs and (when inferential) inference_refs.

Rules:
1. Return ONLY valid JSON.
2. If uncertain, prefer status="unknown" or "conflict".
3. For non-unknown resolutions, evidence_refs must be non-empty.
3.1. DO NOT invent evidence sources, systems, people, or inference IDs not present in the provided candidates/links/inferences.
4. Use resolution_mode:
   - direct (single-source direct observation)
   - assembled (complementary multi-source assembly)
   - inferred (heuristic / multi-hop inference)
   - fallback
   - unknown
5. Do not remove existing strong values unless your evidence is stronger or complementary.
6. Enum constraints:
   - identity.account_status: enabled|locked|disabled|unknown
   - identity.mfa_state: enrolled|not_enrolled|unknown
   - endpoint.device_type: desktop|laptop|mobile|unknown
   - network.vpn_state: connected|disconnected|unknown
   - network.location_context: office|remote|unknown

Ticket summary:
${JSON.stringify({
      id: input.ticket.ticketNumber || input.ticket.id || '',
      title: input.ticket.title || '',
      requester: input.ticket.requester || '',
      company: input.ticket.company || '',
    })}

Ticket narrative (normalized+raw context excerpt):
${input.ticketNarrative.slice(0, 2200)}

Field candidates by path:
${JSON.stringify(grouped, null, 2).slice(0, 14000)}

Link candidates:
${JSON.stringify(input.links, null, 2).slice(0, 6000)}

Inference candidates:
${JSON.stringify(input.inferences, null, 2).slice(0, 6000)}

Output schema:
{
  "resolutions": [
    {
      "path": "ticket.affected_user_name",
      "value": "new employee (name not provided)",
      "status": "confirmed|inferred|unknown|conflict",
      "confidence": 0.0,
      "resolution_mode": "direct|assembled|inferred|fallback|unknown",
      "evidence_refs": ["..."],
      "inference_refs": ["inf-..."],
      "note": "optional"
    }
  ],
  "links": [],
  "inferences": [],
  "conflicts": [{"field":"path","note":"...", "evidence_refs":["..."]}]
}`;
  }

  private sanitizeFusionAdjudicationOutput(parsed: any, supportedPaths: Set<string>): FusionAdjudicationOutput {
    const resolutions: FusionFieldResolution[] = Array.isArray(parsed?.resolutions)
      ? parsed.resolutions
        .map((r: any): FusionFieldResolution | null => {
          const path = String(r?.path || '').trim();
          if (!supportedPaths.has(path)) return null;
          const status = ['confirmed', 'inferred', 'unknown', 'conflict'].includes(String(r?.status))
            ? String(r.status) as FusionFieldResolution['status']
            : 'unknown';
          const resolutionMode = ['direct', 'assembled', 'inferred', 'fallback', 'unknown'].includes(String(r?.resolution_mode))
            ? String(r.resolution_mode) as FusionFieldResolution['resolution_mode']
            : 'unknown';
          const confidence = Number.isFinite(Number(r?.confidence)) ? Math.max(0, Math.min(1, Number(r.confidence))) : 0;
          const evidenceRefs = Array.isArray(r?.evidence_refs) ? r.evidence_refs.map(String).filter(Boolean).slice(0, 20) : [];
          const inferenceRefs = Array.isArray(r?.inference_refs) ? r.inference_refs.map(String).filter(Boolean).slice(0, 20) : undefined;
          return {
            path,
            value: r?.value,
            status,
            confidence,
            resolution_mode: resolutionMode,
            evidence_refs: evidenceRefs,
            ...(inferenceRefs && inferenceRefs.length ? { inference_refs: inferenceRefs } : {}),
            ...(r?.note ? { note: String(r.note).slice(0, 300) } : {}),
          };
        })
        .filter(Boolean) as FusionFieldResolution[]
      : [];
    return {
      resolutions,
      links: Array.isArray(parsed?.links) ? parsed.links as FusionLink[] : [],
      inferences: Array.isArray(parsed?.inferences) ? parsed.inferences as FusionInference[] : [],
      conflicts: Array.isArray(parsed?.conflicts) ? parsed.conflicts.map((c: any) => ({
        field: String(c?.field || ''),
        note: String(c?.note || ''),
        evidence_refs: Array.isArray(c?.evidence_refs) ? c.evidence_refs.map(String) : undefined,
      })) : [],
    };
  }

  private validateFusionLlmResolutions(input: {
    resolutions: FusionFieldResolution[];
    fieldCandidates: FusionFieldCandidate[];
    deterministicLinks: FusionLink[];
    deterministicInferences: FusionInference[];
  }): FusionFieldResolution[] {
    const allowedEvidenceRefs = new Set<string>();
    for (const candidate of input.fieldCandidates) {
      for (const ref of candidate.evidence_refs || []) {
        const value = String(ref || '').trim();
        if (value) allowedEvidenceRefs.add(value);
      }
    }
    for (const link of input.deterministicLinks) {
      for (const ref of link.evidence_refs || []) {
        const value = String(ref || '').trim();
        if (value) allowedEvidenceRefs.add(value);
      }
    }
    for (const inf of input.deterministicInferences) {
      for (const ref of inf.evidence_chain || []) {
        const value = String(ref || '').trim();
        if (value) allowedEvidenceRefs.add(value);
      }
    }

    const allowedInferenceIds = new Set(
      input.deterministicInferences.map((i) => String(i?.id || '').trim()).filter(Boolean)
    );
    const candidateValuesByPath = new Map<string, Set<string>>();
    const normalizeCandidateValue = (value: unknown) => this.normalizeFusionCandidateValueForCompare(value);
    for (const candidate of input.fieldCandidates) {
      const key = String(candidate.path || '');
      if (!key) continue;
      const set = candidateValuesByPath.get(key) || new Set<string>();
      const normalized = normalizeCandidateValue(candidate.value);
      if (normalized) set.add(normalized);
      candidateValuesByPath.set(key, set);
    }

    const guardedIdentityPaths = new Set([
      'ticket.affected_user_name',
      'ticket.affected_user_email',
      'identity.user_principal_name',
    ]);

    const out: FusionFieldResolution[] = [];
    for (const resolution of input.resolutions || []) {
      const refs = Array.isArray(resolution.evidence_refs) ? resolution.evidence_refs.map((r) => String(r || '').trim()).filter(Boolean) : [];
      const infRefs = Array.isArray(resolution.inference_refs) ? resolution.inference_refs.map((r) => String(r || '').trim()).filter(Boolean) : [];
      const invalidEvidence = refs.some((ref) => !allowedEvidenceRefs.has(ref));
      if (invalidEvidence) {
        continue;
      }
      const invalidInference = infRefs.some((id) => !allowedInferenceIds.has(id));
      if (invalidInference) {
        continue;
      }

      if (guardedIdentityPaths.has(String(resolution.path || ''))) {
        const normalizedValue = normalizeCandidateValue(resolution.value);
        const candidateSet = candidateValuesByPath.get(String(resolution.path || '')) || new Set<string>();
        const hasDeterministicInference = infRefs.length > 0 && infRefs.every((id) => allowedInferenceIds.has(id));
        const isUnknownLike = this.isFusionUnknownValue(this.normalizeFusionResolutionValue(resolution.path, resolution.value));
        if (!isUnknownLike && !candidateSet.has(normalizedValue) && !hasDeterministicInference) {
          continue;
        }
      }

      out.push({
        ...resolution,
        evidence_refs: refs,
        ...(infRefs.length ? { inference_refs: infRefs } : {}),
      });
    }
    return out;
  }

  private normalizeFusionCandidateValueForCompare(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).toLowerCase();
      } catch {
        return '';
      }
    }
    return this.normalizeName(String(value || '')).toLowerCase();
  }

  private buildDeterministicFusionFallbackResolutions(input: {
    sections: IterativeEnrichmentSections;
    itglueContacts: any[];
    loggedInUser: string;
  }, links: FusionLink[]): FusionFieldResolution[] {
    const out: FusionFieldResolution[] = [];
    const identityLink = links
      .filter((l) => l.kind === 'identity_alias')
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!identityLink || identityLink.confidence < 0.8) return out;
    const contactId = identityLink.from_entity.replace('itglue_contact:', '');
    const contact = input.itglueContacts.find((c: any) => String(c?.id || '') === contactId);
    const attrs = contact?.attributes || {};
    const name = this.normalizeName(String(
      this.itgAttr(attrs, 'name') ||
      [this.itgAttr(attrs, 'first_name'), this.itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
    ));
    const email = String(this.itgAttr(attrs, 'primary_email') || '').trim().toLowerCase();
    if (name) {
      out.push({
        path: 'ticket.affected_user_name',
        value: name,
        status: 'inferred',
        confidence: Math.min(0.9, identityLink.confidence),
        resolution_mode: 'assembled',
        evidence_refs: identityLink.evidence_refs,
        inference_refs: [`inf-identity-${contactId}`],
        note: 'Deterministic fallback from IT Glue contact ↔ Ninja last-login alias link',
      });
    }
    if (email) {
      out.push({
        path: 'ticket.affected_user_email',
        value: email,
        status: 'inferred',
        confidence: Math.min(0.9, identityLink.confidence),
        resolution_mode: 'assembled',
        evidence_refs: identityLink.evidence_refs,
        inference_refs: [`inf-identity-${contactId}`],
        note: 'Deterministic fallback from IT Glue contact ↔ Ninja last-login alias link',
      });
      out.push({
        path: 'identity.user_principal_name',
        value: email,
        status: 'inferred',
        confidence: Math.min(0.88, identityLink.confidence),
        resolution_mode: 'assembled',
        evidence_refs: identityLink.evidence_refs,
        inference_refs: [`inf-identity-${contactId}`],
      });
    }
    return out;
  }

  private applyFusionResolutionsToSections(
    sections: IterativeEnrichmentSections,
    resolutions: FusionFieldResolution[]
  ): { sections: IterativeEnrichmentSections; appliedCount: number; appliedPaths: string[] } {
    const next: IterativeEnrichmentSections = {
      ticket: { ...sections.ticket },
      identity: { ...sections.identity },
      endpoint: { ...sections.endpoint },
      network: { ...sections.network },
      infra: { ...sections.infra },
    };
    let appliedCount = 0;
    const appliedPaths: string[] = [];

    for (const resolution of resolutions) {
      const current = this.getEnrichmentFieldByPath(next, resolution.path);
      if (!current) continue;
      const normalized = this.normalizeFusionResolutionValue(resolution.path, resolution.value);
      const isUnknown = this.isFusionUnknownValue(normalized);
      if (!isUnknown && (!Array.isArray(resolution.evidence_refs) || resolution.evidence_refs.length === 0)) {
        continue;
      }
      const nextStatus = isUnknown ? 'unknown' : resolution.status;
      const nextConfidence = isUnknown ? 0 : Number(resolution.confidence || 0);

      const currentIsStrong = current.status === 'confirmed' && Number(current.confidence || 0) >= 0.85;
      const incomingIsWeaker =
        nextStatus !== 'conflict' &&
        nextStatus !== 'confirmed' &&
        nextConfidence < Number(current.confidence || 0);
      if (currentIsStrong && incomingIsWeaker) continue;
      if (isUnknown && current.status !== 'unknown') continue;

      const sourceRef = [
        ...(resolution.evidence_refs || []),
        ...((resolution.inference_refs || []).slice(0, 3)),
      ].join(' | ');
      const updated = this.buildField({
        value: normalized as any,
        status: nextStatus as any,
        confidence: nextConfidence,
        sourceSystem: resolution.resolution_mode === 'assembled' || resolution.resolution_mode === 'inferred'
          ? 'fusion_graph_llm'
          : 'fusion_direct_llm',
        sourceRef: sourceRef || undefined,
        round: 7,
      });
      this.setEnrichmentFieldByPath(next, resolution.path, updated);
      appliedCount += 1;
      appliedPaths.push(resolution.path);
    }

    return { sections: next, appliedCount, appliedPaths };
  }

  private getEnrichmentFieldByPath(
    sections: IterativeEnrichmentSections,
    path: string
  ): EnrichmentField<unknown> | null {
    const [section, key] = path.split('.');
    if (!section || !key) return null;
    const sec = (sections as any)[section];
    if (!sec || typeof sec !== 'object') return null;
    return (sec as any)[key] || null;
  }

  private setEnrichmentFieldByPath(
    sections: IterativeEnrichmentSections,
    path: string,
    field: EnrichmentField<any>
  ): void {
    const [section, key] = path.split('.');
    if (!section || !key) return;
    const sec = (sections as any)[section];
    if (!sec || typeof sec !== 'object') return;
    (sec as any)[key] = field;
  }

  private normalizeFusionResolutionValue(path: string, value: unknown): unknown {
    if (value === null || value === undefined) return 'unknown';
    const raw = typeof value === 'string' ? value.trim() : value;
    const str = typeof raw === 'string' ? raw : '';
    if (!str && typeof raw !== 'string') return raw;

    if (path === 'identity.account_status') {
      const v = str.toLowerCase();
      if (['enabled', 'locked', 'disabled', 'unknown'].includes(v)) return v;
      if (v.includes('disable')) return 'disabled';
      if (v.includes('lock')) return 'locked';
      if (v.includes('enable') || v.includes('active')) return 'enabled';
      return 'unknown';
    }
    if (path === 'identity.mfa_state') {
      const v = str.toLowerCase();
      if (['enrolled', 'not_enrolled', 'unknown'].includes(v)) return v;
      if (v.includes('not') || v.includes('disable')) return 'not_enrolled';
      if (v.includes('enroll') || v.includes('enabled')) return 'enrolled';
      return 'unknown';
    }
    if (path === 'endpoint.device_type') {
      const v = str.toLowerCase();
      if (['desktop', 'laptop', 'mobile', 'unknown'].includes(v)) return v;
      if (/(notebook|laptop)/.test(v)) return 'laptop';
      if (/(iphone|ipad|android|mobile)/.test(v)) return 'mobile';
      if (/(desktop|workstation|pc)/.test(v)) return 'desktop';
      return 'unknown';
    }
    if (path === 'network.vpn_state') {
      const v = str.toLowerCase();
      if (['connected', 'disconnected', 'unknown'].includes(v)) return v;
      if (/(connected|up|established)/.test(v)) return 'connected';
      if (/(disconnected|down|not connected)/.test(v)) return 'disconnected';
      return 'unknown';
    }
    if (path === 'network.location_context') {
      const v = str.toLowerCase();
      if (['office', 'remote', 'unknown'].includes(v)) return v;
      if (/(office|onsite|on-site|site)/.test(v)) return 'office';
      if (/(remote|home|vpn)/.test(v)) return 'remote';
      return 'unknown';
    }
    return typeof raw === 'string' ? str || 'unknown' : raw;
  }

  private isFusionUnknownValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return !v || v === 'unknown' || v === 'n/a' || v === 'null';
    }
    return false;
  }

  private normalizeSimpleToken(value: string): string {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private generateNameAliases(name: string): Set<string> {
    const aliases = new Set<string>();
    const normalized = this.normalizeName(name);
    const parts = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length === 0) return aliases;
    const first = parts[0];
    const last = parts[parts.length - 1];
    aliases.add(this.normalizeSimpleToken(normalized));
    if (first) aliases.add(first);
    if (last) aliases.add(last);
    if (first && last) {
      aliases.add(`${first[0]}${last}`);
      aliases.add(`${first}.${last}`);
      aliases.add(`${first}_${last}`);
      aliases.add(`${first}${last[0]}`);
    }
    return new Set([...aliases].map((a) => this.normalizeSimpleToken(a)).filter(Boolean));
  }

  private extractSoftwareHintsFromTicket(text: string): string[] {
    const lower = String(text || '').toLowerCase();
    const hints = new Set<string>();
    const known = [
      'autocad', 'acad', 'outlook', 'teams', 'excel', 'word', 'quickbooks', 'adobe', 'acrobat',
      'forticlient', 'vpn', 'chrome', 'edge', 'zoom', 'gotoconnect', 'goto'
    ];
    for (const k of known) {
      if (lower.includes(k)) hints.add(k);
    }
    const quoted = lower.match(/\b[a-z][a-z0-9.+_-]{3,}\b/g) || [];
    for (const token of quoted.slice(0, 50)) {
      if (/(ticket|hello|please|thanks|support|issue|internet|office|user)/.test(token)) continue;
      if (known.some((k) => token.includes(k) || k.includes(token))) hints.add(token);
    }
    return [...hints].slice(0, 12);
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
    if (round === 1) return 'intake';
    if (round === 2) return 'itglue';
    if (round === 3) return 'ninja';
    if (round === 4) return 'history_correlation';
    if (round === 5) return 'itglue_refinement';
    if (round === 6) return 'ninja_refinement';
    if (round === 7) return 'cross_source_fusion';
    if (round === 8) return 'history_correlation_broad';
    if (round === 9) return 'final_refinement_verify_backfill';
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

  private extractITGlueWanCandidate(input: {
    ticketNarrative: string;
    itglueAssets: any[];
    itglueConfigs: any[];
    docs: Doc[];
  }): ITGlueWanCandidate | null {
    const candidates: ITGlueWanCandidate[] = [];

    const scanRecord = (record: any, sourceSystem: ITGlueWanCandidate['source_system'], sourceRef: string) => {
      const attrs = record?.attributes || record || {};
      const pairs = this.collectTextPairs(attrs);
      const allText = pairs.map((p) => `${p.key}:${p.value}`).join(' | ');
      if (!/\b(internet|wan|isp|provider|carrier|broadband|fiber|cable|upload speed|download speed|link type)\b/i.test(allText)) {
        return;
      }

      let ispName = '';
      let locationHint = '';
      let publicIp = '';
      let score = 0.42;

      for (const pair of pairs) {
        const key = pair.key.toLowerCase();
        const value = pair.value.trim();
        if (!value) continue;
        if (/(^|[._\s-])(provider|isp|carrier)(name)?$/.test(key) && !/^(yes|no|true|false)$/i.test(value)) {
          ispName = this.normalizeVendorPhrase(value) || ispName;
          score += 0.28;
        }
        if (/(^|[._\s-])(location|site|address)(s)?$/.test(key) && value.length >= 4) {
          locationHint = locationHint || value;
          score += 0.08;
        }
        if ((/(^|[._\s-])(ip|public ip)( address)?(es)?$/.test(key) || this.isPublicIPv4(value)) && this.isPublicIPv4(value)) {
          publicIp = publicIp || value;
          score += 0.08;
        }
      }

      const label = this.normalizeName(String(attrs.name || attrs.title || attrs.hostname || ''));
      if (!ispName && label) {
        const labelMatch = label.match(/^(.+?)\s+(cable|fiber|internet|broadband|communications?|telecom)$/i);
        if (labelMatch?.[1]) {
          ispName = this.normalizeVendorPhrase(labelMatch[1]) || '';
          score += 0.14;
        }
      }

      if (!ispName && label) {
        const fallbackIsp = this.inferIspName({
          ticketNarrative: `${input.ticketNarrative}\n${label}\n${allText}`.slice(0, 2000),
          docs: [],
          itglueConfigs: [],
        });
        if (fallbackIsp) {
          ispName = fallbackIsp;
          score += 0.08;
        }
      }

      if (!ispName && !locationHint && !publicIp) return;
      candidates.push({
        ...(ispName ? { isp_name: ispName } : {}),
        ...(locationHint ? { location_hint: locationHint } : {}),
        ...(publicIp ? { public_ip: publicIp } : {}),
        confidence: Number(Math.min(0.92, score).toFixed(3)),
        source_ref: sourceRef,
        source_system: sourceSystem,
      });
    };

    for (const asset of input.itglueAssets.slice(0, 400)) {
      scanRecord(asset, 'itglue_asset', `itglue_asset:${String(asset?.id || 'unknown')}`);
    }
    for (const cfg of input.itglueConfigs.slice(0, 300)) {
      scanRecord(cfg, 'itglue_config', `itglue_config:${String(cfg?.id || 'unknown')}`);
    }
    for (const doc of input.docs.slice(0, 20)) {
      const text = `${doc.title} ${doc.snippet}`;
      const m = text.match(/\b([A-Z][A-Za-z0-9&.' -]{1,40})\s+(cable|fiber|internet)\b/i);
      const isp = m?.[1] ? this.normalizeVendorPhrase(m[1]) : '';
      if (!isp) continue;
      candidates.push({
        isp_name: isp,
        confidence: 0.52,
        source_ref: `itglue_doc:${String(doc.id)}`,
        source_system: 'itglue_doc',
      });
    }

    return candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
  }

  private extractITGlueInfraCandidates(input: {
    itgluePasswords: any[];
    itglueConfigs: any[];
    itglueAssets: any[];
    docs: Doc[];
  }): {
    firewall: {
      value: string;
      status: EnrichmentField<string>['status'];
      confidence: number;
      sourceSystem: string;
      sourceRef?: string;
      round: number;
    } | null;
    wifi: {
      value: string;
      status: EnrichmentField<string>['status'];
      confidence: number;
      sourceSystem: string;
      sourceRef?: string;
      round: number;
    } | null;
    switch: {
      value: string;
      status: EnrichmentField<string>['status'];
      confidence: number;
      sourceSystem: string;
      sourceRef?: string;
      round: number;
    } | null;
  } {
    const candidates: ITGlueInfraCandidate[] = [];
    const vendorPatterns: Array<{ kind: ITGlueInfraCandidate['kind'] | 'multi'; canonical: string; pattern: RegExp }> = [
      { kind: 'firewall', canonical: 'Fortinet FortiGate', pattern: /\bfortigate\b|\bfortinet\b|\bfg-\d+[a-z-]*\b/i },
      { kind: 'firewall', canonical: 'SonicWall', pattern: /\bsonicwall\b/i },
      { kind: 'firewall', canonical: 'Palo Alto', pattern: /\bpalo\s?alto\b|\bpa-\d+\b/i },
      { kind: 'firewall', canonical: 'WatchGuard', pattern: /\bwatchguard\b/i },
      { kind: 'firewall', canonical: 'Sophos', pattern: /\bsophos\b/i },
      { kind: 'wifi', canonical: 'UniFi', pattern: /\bunifi\b|\bubiquiti\b/i },
      { kind: 'wifi', canonical: 'Meraki', pattern: /\bmeraki\b/i },
      { kind: 'wifi', canonical: 'Aruba', pattern: /\baruba\b|\binstant on\b/i },
      { kind: 'wifi', canonical: 'Ruckus', pattern: /\bruckus\b/i },
      { kind: 'switch', canonical: 'Cisco', pattern: /\bcisco\b|\bcatalyst\b/i },
      { kind: 'switch', canonical: 'Aruba', pattern: /\baruba\b|\bprocurve\b/i },
      { kind: 'switch', canonical: 'Netgear', pattern: /\bnetgear\b/i },
      { kind: 'switch', canonical: 'UniFi', pattern: /\bunifi\b.*\bswitch\b|\bswitch\b.*\bunifi\b/i },
      { kind: 'multi', canonical: 'UniFi', pattern: /\bunifi\b/i },
    ];
    const inferKind = (text: string): ITGlueInfraCandidate['kind'] | null => {
      if (/\bfirewall\b|\bfortigate\b|\bsonicwall\b|\bwatchguard\b|\bpalo\s?alto\b/.test(text)) return 'firewall';
      if (/\bwifi\b|\bwireless\b|\bssid\b|\baccess point\b|\bcontroller\b/.test(text)) return 'wifi';
      if (/\bswitch\b|\bcatalyst\b|\bprocurve\b|\bstacking\b/.test(text)) return 'switch';
      return null;
    };
    const maybePush = (sourceSystem: ITGlueInfraCandidate['source_system'], sourceRef: string, label: string, contextHint: string, baseScore: number) => {
      const combined = `${label} ${contextHint}`.toLowerCase();
      if (!combined.trim()) return;
      const inferredKind = inferKind(combined);
      for (const vp of vendorPatterns) {
        if (!vp.pattern.test(combined)) continue;
        const kind = vp.kind === 'multi' ? (inferredKind || 'wifi') : vp.kind;
        if (!kind) continue;
        let value = vp.canonical;
        const modelMatch =
          label.match(/\b(FortiGate\s+[A-Z0-9-]+)\b/i) ||
          label.match(/\b(FG-\d+[A-Z-]*)\b/i) ||
          label.match(/\b(CAT-FG-\d+[A-Z-]*)\b/i) ||
          label.match(/\b(SonicWall(?:\s*\([^)]+\))?)\b/i) ||
          label.match(/\b(UniFi\s+(Controller|Switch|Cloud Portal|Video))\b/i);
        if (modelMatch?.[1]) value = this.normalizeName(modelMatch[1]);
        let score = baseScore;
        if (/\b(local access|controller|ssid)\b/.test(combined)) score += 0.08;
        if (/\bfirewall\b/.test(contextHint.toLowerCase()) && kind === 'firewall') score += 0.1;
        if (/\bwifi\b/.test(contextHint.toLowerCase()) && kind === 'wifi') score += 0.1;
        candidates.push({
          kind,
          value,
          confidence: Number(Math.min(0.9, score).toFixed(3)),
          source_ref: sourceRef,
          source_system: sourceSystem,
        });
      }
    };

    for (const p of input.itgluePasswords.slice(0, 500)) {
      const a = p?.attributes || {};
      const name = this.normalizeName(String(a.name || a['resource-name'] || a.title || ''));
      const category = this.normalizeName(String(
        a.category || a.password_category || a.passwordCategory || a.password_category_name || a['password-category-name'] || ''
      ));
      const username = this.normalizeName(String(a.username || ''));
      maybePush('itglue_password_metadata', `itglue_password:${String(p?.id || name || 'unknown')}`, name, `${category} ${username}`, 0.6);
    }
    for (const cfg of input.itglueConfigs.slice(0, 300)) {
      const a = cfg?.attributes || {};
      const name = this.normalizeName(String(this.itgAttr(a, 'name') || this.itgAttr(a, 'hostname') || ''));
      const vendor = this.normalizeName(String(
        this.itgAttr(a, 'manufacturer') ||
        this.itgAttr(a, 'manufacturer_name') ||
        this.itgAttr(a, 'vendor') ||
        this.itgAttr(a, 'brand') ||
        ''
      ));
      const model = this.normalizeName(String(
        this.itgAttr(a, 'model') ||
        this.itgAttr(a, 'model_name') ||
        this.itgAttr(a, 'product_model') ||
        ''
      ));
      const typeName = this.normalizeName(String(this.itgAttr(a, 'configuration_type_name') || this.itgAttr(a, 'type') || ''));
      maybePush('itglue_config', `itglue_config:${String(cfg?.id || name || 'unknown')}`, [vendor, model, name].filter(Boolean).join(' '), typeName, 0.72);
    }
    for (const asset of input.itglueAssets.slice(0, 300)) {
      const a = asset?.attributes || {};
      const text = JSON.stringify(a || {}).slice(0, 1000);
      const name = this.normalizeName(String(a.name || a.title || ''));
      const typeName = this.normalizeName(String(a['flexible-asset-type-name'] || a.type || ''));
      maybePush('itglue_config', `itglue_asset:${String(asset?.id || name || 'unknown')}`, `${name} ${text}`, typeName, 0.66);
    }
    for (const doc of input.docs.slice(0, 20)) {
      maybePush('itglue_doc', `itglue_doc:${String(doc.id)}`, `${doc.title} ${doc.snippet}`.slice(0, 700), '', 0.46);
    }

    const pick = (kind: ITGlueInfraCandidate['kind']) => {
      const best = candidates.filter((c) => c.kind === kind).sort((a, b) => b.confidence - a.confidence)[0];
      if (!best) return null;
      return {
        value: best.value,
        status: 'inferred' as const,
        confidence: best.confidence,
        sourceSystem: best.source_system,
        sourceRef: best.source_ref,
        round: 2,
      };
    };
    return { firewall: pick('firewall'), wifi: pick('wifi'), switch: pick('switch') };
  }

  private rankITGlueDocsForTicket(ticketNarrative: string, docs: Doc[]): Doc[] {
    if (!Array.isArray(docs) || docs.length <= 1) return docs;
    const ticketLower = String(ticketNarrative || '').toLowerCase();
    const hints = new Set([
      ...this.extractSoftwareHintsFromTicket(ticketNarrative),
      ...ticketLower.split(/[^a-z0-9]+/).filter((t) => t.length >= 4).slice(0, 60),
    ]);
    return docs
      .map((doc, idx) => {
        const text = `${String(doc.title || '')} ${String(doc.snippet || '')}`.toLowerCase();
        let score = Number(doc.relevance || 0);
        if (/\b(sop|new hire|new employee|onboarding|install|setup|instructions?)\b/.test(text)) score += 0.28;
        if (/\b(network|internet|wan|wifi|firewall|switch)\b/.test(text)) score += 0.12;
        for (const hint of hints) {
          if (text.includes(hint)) score += hint.length >= 8 ? 0.04 : 0.02;
        }
        score += Math.max(0, 0.02 - idx * 0.002);
        return { ...doc, relevance: Number(Math.max(Number(doc.relevance || 0), score).toFixed(3)) };
      })
      .sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0));
  }

  private selectITGlueFlexibleAssetTypesForTicket(input: {
    assetTypes: Array<{ id: string; attributes?: Record<string, unknown> }>;
    ticketNarrative: string;
    docs?: Doc[];
    maxTypes: number;
  }): Array<{ id: string; attributes?: Record<string, unknown> }> {
    const maxTypes = Math.max(1, input.maxTypes || ITGLUE_MAX_FLEXIBLE_ASSET_TYPES_PER_SCOPE);
    const sourceText = [
      input.ticketNarrative || '',
      ...(input.docs || []).slice(0, 8).map((d) => `${d.title} ${d.snippet}`),
    ]
      .join(' ')
      .toLowerCase();

    const genericHighValuePatterns: Array<{ pattern: RegExp; score: number }> = [
      { pattern: /\b(internet|wan|isp|network)\b/i, score: 10 },
      { pattern: /\b(router|firewall|fortigate|sonicwall|vpn)\b/i, score: 9 },
      { pattern: /\b(wifi|wireless|ssid|access point|unifi|meraki)\b/i, score: 8 },
      { pattern: /\b(switch|lan)\b/i, score: 7 },
      { pattern: /\b(domain|dns|ssl|certificate)\b/i, score: 5 },
      { pattern: /\b(server|endpoint|workstation|computer|desktop|laptop|device)\b/i, score: 4 },
      { pattern: /\b(user|employee|onboarding|new hire|install)\b/i, score: 3 },
    ];

    const tokenHints = new Set(
      sourceText
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .slice(0, 80)
    );

    const ranked = (input.assetTypes || [])
      .map((t: any) => {
        const name = String(this.itgAttr(t?.attributes || {}, 'name') || '').trim();
        const lower = name.toLowerCase();
        let score = 0;
        for (const rule of genericHighValuePatterns) {
          if (rule.pattern.test(lower)) score += rule.score;
        }
        for (const token of tokenHints) {
          if (lower.includes(token)) score += token.length >= 8 ? 1.2 : 0.7;
        }
        if (/\b(billing|finance|hr|archive)\b/i.test(lower)) score -= 2;
        return { type: t, score, name: lower || String(t?.id || '') };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const selected = ranked.slice(0, maxTypes).map((x) => x.type);
    return selected.length > 0 ? selected : (input.assetTypes || []).slice(0, maxTypes);
  }

  private collectTextPairs(
    obj: unknown,
    prefix = '',
    depth = 0,
    out: Array<{ key: string; value: string }> = []
  ): Array<{ key: string; value: string }> {
    if (obj === null || obj === undefined || depth > 4) return out;
    if (Array.isArray(obj)) {
      for (const item of obj.slice(0, 20)) this.collectTextPairs(item, prefix, depth + 1, out);
      return out;
    }
    if (typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>).slice(0, 200)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const value = String(v).replace(/\s+/g, ' ').trim();
        if (value) out.push({ key, value });
      } else {
        this.collectTextPairs(v, key, depth + 1, out);
      }
    }
    return out;
  }

  private normalizeVendorPhrase(value: string): string {
    const text = this.normalizeName(String(value || ''))
      .replace(/\b(primary|secondary|backup)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length > 80) return '';
    return text;
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
      const vendor = String(
        this.itgAttr(attrs, 'manufacturer') ||
        this.itgAttr(attrs, 'manufacturer_name') ||
        this.itgAttr(attrs, 'vendor') ||
        this.itgAttr(attrs, 'brand') ||
        ''
      ).trim();
      const model = String(
        this.itgAttr(attrs, 'model') ||
        this.itgAttr(attrs, 'model_name') ||
        this.itgAttr(attrs, 'product_model') ||
        ''
      ).trim();
      const name = String(this.itgAttr(attrs, 'name') || this.itgAttr(attrs, 'hostname') || '').trim();
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
  private async findRelatedCases(ticketTitle: string, orgId?: string, companyName?: string): Promise<RelatedCase[]> {
    return this.findRelatedCasesByTerms([ticketTitle], orgId, companyName);
  }

  private buildBroadHistorySearchPlan(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    normalizedTicket: any | null;
    sections: IterativeEnrichmentSections;
    docs: Doc[];
    fusionAudit?: Record<string, unknown>;
  }): { terms: string[]; strategies: string[] } {
    const termScores = new Map<string, number>();
    const strategies = new Set<string>(['email-fallback-local-history']);

    const addPhrase = (value: unknown, weight: number, strategy: string) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const lower = text.toLowerCase();
      if (lower === 'unknown' || lower === 'none' || lower === 'n/a') return;
      if (text.length > 120) return;
      termScores.set(text, Math.max(weight, termScores.get(text) || 0));
      strategies.add(strategy);
    };
    const addTokenized = (value: unknown, weight: number, strategy: string) => {
      const tokens = String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9._-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      for (const token of tokens.slice(0, 12)) {
        if (/^(the|and|for|with|from|this|that|ticket|issue|hello|please|thanks|support|team|user|email|outside)$/i.test(token)) {
          continue;
        }
        addPhrase(token, weight, strategy);
      }
    };

    const fields = this.flattenEnrichmentFields(input.sections);
    const preferredPaths = new Set([
      'ticket.company',
      'ticket.requester_name',
      'ticket.requester_email',
      'ticket.affected_user_name',
      'ticket.affected_user_email',
      'identity.user_principal_name',
      'endpoint.device_name',
      'endpoint.user_signed_in',
      'network.isp_name',
      'network.public_ip',
      'infra.firewall_make_model',
      'infra.wifi_make_model',
      'infra.switch_make_model',
    ]);
    for (const record of fields) {
      if (!preferredPaths.has(record.path)) continue;
      if (record.field.status === 'unknown') continue;
      addPhrase(record.field.value, 1, 'fused_ssot');
      addTokenized(record.field.value, 0.8, 'fused_ssot');
      if (String(record.path).includes('user_name')) {
        for (const alias of this.generateNameAliases(String(record.field.value || ''))) {
          addPhrase(alias, 0.95, 'identity_alias');
        }
      }
      if (String(record.path).includes('email')) {
        const email = String(record.field.value || '').toLowerCase();
        addPhrase(email, 1, 'identity_email');
        addPhrase(email.split('@')[0] || '', 0.95, 'identity_email_local');
      }
    }

    addPhrase(input.ticket.title, 0.95, 'ticket_title');
    addPhrase(input.normalizedTicket?.descriptionClean, 0.8, 'ticket_clean');
    addPhrase(input.normalizedTicket?.descriptionUi, 0.75, 'ticket_ui');
    for (const symptom of (input.normalizedTicket?.symptoms || []).slice(0, 12)) addPhrase(symptom, 0.9, 'ticket_symptom');
    for (const tech of (input.normalizedTicket?.technologyFacets || []).slice(0, 12)) addPhrase(tech, 0.85, 'ticket_tech');
    for (const hint of (input.normalizedTicket?.deviceHints || []).slice(0, 8)) addPhrase(hint, 0.85, 'ticket_device_hint');

    for (const domain of this.extractEmailDomains(`${input.ticketNarrative} ${input.normalizedTicket?.descriptionClean || ''}`)) {
      addPhrase(domain, 0.95, 'domain');
      addPhrase(domain.split('.')[0] || '', 0.8, 'domain_root');
    }
    for (const software of this.extractSoftwareHintsFromTicket(input.ticketNarrative)) {
      addPhrase(software, 0.95, 'software_hint');
    }
    for (const doc of input.docs.slice(0, 10)) {
      addPhrase(doc.title, 0.6, 'itglue_doc_title');
      addTokenized(doc.title, 0.45, 'itglue_doc_title');
    }

    const fusionLinks = Array.isArray((input.fusionAudit as any)?.links) ? (input.fusionAudit as any).links : [];
    const fusionInferences = Array.isArray((input.fusionAudit as any)?.inferences) ? (input.fusionAudit as any).inferences : [];
    const fusionResolutions = Array.isArray((input.fusionAudit as any)?.resolutions) ? (input.fusionAudit as any).resolutions : [];
    for (const link of fusionLinks.slice(0, 20)) {
      addPhrase(link?.note, 0.6, 'fusion_link_note');
      addTokenized(link?.from_entity, 0.55, 'fusion_link_entity');
      addTokenized(link?.to_entity, 0.55, 'fusion_link_entity');
    }
    for (const inf of fusionInferences.slice(0, 20)) {
      addPhrase(inf?.claim, 0.65, 'fusion_inference_claim');
    }
    for (const res of fusionResolutions.slice(0, 20)) {
      addPhrase(res?.value, 0.75, 'fusion_resolution');
    }

    const ranked = [...termScores.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(([term]) => term)
      .filter(Boolean);

    return {
      terms: ranked.slice(0, 28),
      strategies: [...strategies],
    };
  }

  private buildFinalRefinementPlan(input: {
    sections: IterativeEnrichmentSections;
    missingData: Array<{ field: string; why: string }>;
    fusionAudit?: Record<string, unknown>;
    historyCalibration?: TicketContextAppendix['history_confidence_calibration'];
    historyCorrelation?: TicketContextAppendix['history_correlation'];
  }): { targets: string[]; terms: string[] } {
    const targets = new Set<string>();
    const terms = new Set<string>();

    for (const m of input.missingData.slice(0, 20)) {
      if (m?.field) targets.add(String(m.field));
      for (const token of String(m?.why || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
        if (token.length >= 4 && !/(failed|error|unknown|resolve|deterministically)/.test(token)) terms.add(token);
      }
    }
    for (const record of this.flattenEnrichmentFields(input.sections)) {
      if (record.field.status === 'unknown' || record.field.status === 'conflict') {
        targets.add(record.path);
      }
    }
    const conflicts = Array.isArray((input.fusionAudit as any)?.conflicts) ? (input.fusionAudit as any).conflicts : [];
    for (const c of conflicts.slice(0, 10)) {
      if (c?.field) targets.add(String(c.field));
      for (const token of String(c?.note || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
        if (token.length >= 4) terms.add(token);
      }
    }
    for (const adj of input.historyCalibration?.field_adjustments || []) {
      if (adj.action === 'decrease' || adj.action === 'context_only') targets.add(adj.path);
    }
    for (const contradiction of input.historyCalibration?.contradictions || []) {
      targets.add(contradiction.path);
      for (const v of contradiction.observed_values) {
        for (const token of String(v || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
          if (token.length >= 3) terms.add(token);
        }
      }
    }
    for (const t of input.historyCorrelation?.search_terms?.slice(0, 12) || []) {
      if (String(t || '').trim()) terms.add(String(t));
    }
    return {
      targets: [...targets].slice(0, 20),
      terms: [...terms].map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length).slice(0, 24),
    };
  }

  private shouldRunFinalNinjaRefinement(input: {
    sections: IterativeEnrichmentSections;
    finalRefinementPlanTargets: string[];
    currentDevice: any | null;
  }): boolean {
    if (!input.currentDevice) return true;
    if (input.finalRefinementPlanTargets.some((target) => /(device|endpoint|vpn|public_ip|user_signed_in)/.test(target))) {
      return true;
    }
    return (
      input.sections.endpoint.device_name.status !== 'confirmed' ||
      input.sections.endpoint.user_signed_in.status === 'unknown' ||
      input.sections.network.public_ip.status === 'unknown' ||
      input.sections.network.vpn_state.status === 'unknown'
    );
  }

  private async findRelatedCasesBroad(input: {
    ticketId?: string;
    orgId?: string;
    companyName?: string;
    terms: string[];
  }): Promise<RelatedCase[]> {
    const normalizedTerms = this.normalizeHistoryTerms(input.terms);
    if (normalizedTerms.length === 0) return [];
    try {
      const rows = await query<{
        ticket_id: string;
        symptom_text: string;
        resolution_text: string;
        resolved_at: string;
      }>(
        `
        SELECT
          t.ticket_id,
          COALESCE(string_agg(DISTINCT l.payload->>'summary', ' || '), '') AS symptom_text,
          COALESCE(string_agg(DISTINCT l.payload->>'content', ' || '), '') AS resolution_text,
          max(t.updated_at) AS resolved_at
        FROM triage_sessions t
        LEFT JOIN llm_outputs l ON t.id = l.session_id
        LEFT JOIN tickets_processed tp ON tp.id = t.ticket_id
        LEFT JOIN ticket_ssot tsot ON tsot.ticket_id = t.ticket_id
        WHERE t.status = 'approved'
        ${input.orgId ? 'AND t.org_id = $1' : ''}
        ${input.companyName ? `AND lower(coalesce(tsot.payload->>'company', '')) = lower($${input.orgId ? 2 : 1})` : ''}
        ${input.ticketId ? `AND t.ticket_id <> $${input.orgId ? (input.companyName ? 3 : 2) : (input.companyName ? 2 : 1)}` : ''}
        GROUP BY t.ticket_id
        ORDER BY max(t.updated_at) DESC
        LIMIT 250
        `,
        [
          ...(input.orgId ? [input.orgId] : []),
          ...(input.companyName ? [input.companyName] : []),
          ...(input.ticketId ? [input.ticketId] : []),
        ]
      );

      const scored = rows
        .map((row) => {
          const haystack = `${row.ticket_id} ${row.symptom_text} ${row.resolution_text}`.toLowerCase();
          const match = this.scoreHistoryCandidate(haystack, normalizedTerms);
          return {
            row,
            score: match.score,
            matchedTerms: match.matchedTerms,
          };
        })
        .filter((entry) => entry.score > 0 && entry.matchedTerms.length > 0)
        .sort((a, b) => b.score - a.score || String(b.row.resolved_at || '').localeCompare(String(a.row.resolved_at || '')))
        .slice(0, 6);

      return scored.map(({ row }) => ({
        ticket_id: row.ticket_id,
        symptom: String(row.symptom_text || '').slice(0, 1200),
        resolution: String(row.resolution_text || '').slice(0, 1600),
        resolved_at: row.resolved_at,
      }));
    } catch (error) {
      console.log('[PrepareContext] Could not run broad related case search:', error);
      return [];
    }
  }

  private async findRelatedCasesByTerms(terms: string[], orgId?: string, companyName?: string): Promise<RelatedCase[]> {
    try {
      const broad = await this.findRelatedCasesBroad({
        ...(orgId ? { orgId } : {}),
        ...(!orgId && companyName ? { companyName } : {}),
        terms,
      });
      if (broad.length > 0) return broad.slice(0, 3);

      const keyword = this.pickHistoryKeyword(terms);
      const fallback = await this.findRelatedCasesBroad({
        ...(orgId ? { orgId } : {}),
        ...(!orgId && companyName ? { companyName } : {}),
        terms: [keyword],
      });
      return fallback.slice(0, 3);
    } catch (error) {
      console.log('[PrepareContext] Could not find related cases:', error);
      return [];
    }
  }

  private normalizeHistoryTerms(terms: string[]): Array<{ term: string; normalized: string; weight: number }> {
    const out = new Map<string, { term: string; normalized: string; weight: number }>();
    for (const rawTerm of terms) {
      const term = String(rawTerm || '').replace(/\s+/g, ' ').trim();
      if (!term) continue;
      if (term.length < 3) continue;
      if (term.length > 120) continue;
      const lower = term.toLowerCase();
      if (['unknown', 'none', 'n/a', 'null', 'false', 'true'].includes(lower)) continue;
      const normalized = lower.replace(/[^a-z0-9.@_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!normalized) continue;
      let weight = 1;
      if (/@/.test(term)) weight += 0.35;
      if (/\./.test(term) && /[a-z]/i.test(term)) weight += 0.25;
      if (term.includes(' ')) weight += 0.2;
      if (normalized.length >= 8) weight += 0.1;
      const existing = out.get(normalized);
      if (!existing || weight > existing.weight) {
        out.set(normalized, { term, normalized, weight: Number(Math.min(2, weight).toFixed(2)) });
      }
    }
    return [...out.values()]
      .sort((a, b) => b.weight - a.weight || b.normalized.length - a.normalized.length)
      .slice(0, 32);
  }

  private scoreHistoryCandidate(
    haystack: string,
    terms: Array<{ term: string; normalized: string; weight: number }>
  ): { score: number; matchedTerms: string[] } {
    let score = 0;
    const matchedTerms: string[] = [];
    const tokenSet = new Set(
      haystack
        .split(/[^a-z0-9.@_-]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    );

    for (const term of terms) {
      const exactPhrase = haystack.includes(term.normalized);
      const tokenParts = term.normalized.split(' ').filter(Boolean);
      const allParts = tokenParts.length > 1 && tokenParts.every((part) => tokenSet.has(part));
      const anyToken = tokenParts.some((part) => tokenSet.has(part));
      if (exactPhrase) {
        score += 1.2 * term.weight;
        matchedTerms.push(term.term);
        continue;
      }
      if (allParts) {
        score += 0.75 * term.weight;
        matchedTerms.push(term.term);
        continue;
      }
      if (anyToken && term.normalized.length >= 6) {
        score += 0.35 * term.weight;
        matchedTerms.push(term.term);
      }
    }

    const uniqueMatches = [...new Set(matchedTerms)];
    if (uniqueMatches.length >= 3) score += 0.8;
    if (uniqueMatches.length >= 5) score += 0.6;
    return {
      score: Number(score.toFixed(3)),
      matchedTerms: uniqueMatches.slice(0, 12),
    };
  }

  private applyFinalRefinementToEnrichment(input: {
    sections: IterativeEnrichmentSections;
    ticketNarrative: string;
    docs: Doc[];
    itglueConfigs: any[];
    itgluePasswords: any[];
    signals: Signal[];
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
  }): string[] {
    const updatedPaths: string[] = [];
    const patchIfBetter = (path: string, nextField: EnrichmentField<any>) => {
      const current = this.getEnrichmentFieldByPath(input.sections, path);
      if (!current) return;
      const nextUnknown = nextField.status === 'unknown' || Number(nextField.confidence || 0) <= 0;
      if (nextUnknown) return;
      const currentWeak =
        current.status === 'unknown' ||
        current.status === 'conflict' ||
        Number(current.confidence || 0) < 0.5;
      const improves = currentWeak || Number(nextField.confidence || 0) > Number(current.confidence || 0) + 0.05;
      if (!improves) return;
      this.setEnrichmentFieldByPath(input.sections, path, nextField);
      updatedPaths.push(path);
    };

    const firewall = this.extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
    patchIfBetter('infra.firewall_make_model', this.buildField({
      value: firewall.value,
      status: firewall.status,
      confidence: firewall.confidence,
      sourceSystem: firewall.sourceSystem,
      sourceRef: firewall.sourceRef,
      round: 9,
    }));
    const wifi = this.extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
    patchIfBetter('infra.wifi_make_model', this.buildField({
      value: wifi.value,
      status: wifi.status,
      confidence: wifi.confidence,
      sourceSystem: wifi.sourceSystem,
      sourceRef: wifi.sourceRef,
      round: 9,
    }));
    const sw = this.extractInfraMakeModel('switch', input.itglueConfigs, input.docs);
    patchIfBetter('infra.switch_make_model', this.buildField({
      value: sw.value,
      status: sw.status,
      confidence: sw.confidence,
      sourceSystem: sw.sourceSystem,
      sourceRef: sw.sourceRef,
      round: 9,
    }));

    const isp = this.inferIspName({ ticketNarrative: input.ticketNarrative, docs: input.docs, itglueConfigs: input.itglueConfigs });
    if (isp) {
      patchIfBetter('network.isp_name', this.buildField({
        value: isp,
        status: 'inferred',
        confidence: 0.78,
        sourceSystem: 'final_refinement',
        sourceRef: 'itglue configs+docs + ticket narrative (round9)',
        round: 9,
      }));
    }
    const phoneProviderName = this.inferPhoneProvider({
      ticketText: input.ticketNarrative,
      docs: input.docs,
      itglueConfigs: input.itglueConfigs,
      itgluePasswords: input.itgluePasswords,
      signals: input.signals,
    });
    if (phoneProviderName) {
      patchIfBetter('network.phone_provider', this.buildField({
        value: 'connected',
        status: 'inferred',
        confidence: 0.73,
        sourceSystem: 'final_refinement',
        sourceRef: 'ticket+itglue+ninja signals round9',
        round: 9,
      }));
      patchIfBetter('network.phone_provider_name', this.buildField({
        value: phoneProviderName,
        status: 'inferred',
        confidence: 0.76,
        sourceSystem: 'final_refinement',
        sourceRef: 'provider keyword match round9',
        round: 9,
      }));
    }

    if (input.device || input.deviceDetails) {
      const endpointSection = this.buildEndpointEnrichmentSection({
        ticketNarrative: input.ticketNarrative,
        device: input.device,
        deviceDetails: input.deviceDetails,
        loggedInUser: input.loggedInUser,
        loggedInAt: input.loggedInAt,
        ninjaChecks: input.signals.filter((s) => s.source === 'ninja'),
      });
      patchIfBetter('endpoint.device_name', { ...endpointSection.device_name, round: 9 });
      patchIfBetter('endpoint.device_type', { ...endpointSection.device_type, round: 9 });
      patchIfBetter('endpoint.os_name', { ...endpointSection.os_name, round: 9 });
      patchIfBetter('endpoint.os_version', { ...endpointSection.os_version, round: 9 });
      patchIfBetter('endpoint.last_check_in', { ...endpointSection.last_check_in, round: 9 });
      patchIfBetter('endpoint.user_signed_in', { ...endpointSection.user_signed_in, round: 9 });
    }

    patchIfBetter('network.vpn_state', this.buildField({
      value: this.inferVpnState(input.signals, input.ticketNarrative),
      status: this.inferVpnState(input.signals, input.ticketNarrative) === 'unknown' ? 'unknown' : 'inferred',
      confidence: this.inferVpnState(input.signals, input.ticketNarrative) === 'unknown' ? 0 : 0.68,
      sourceSystem: 'final_refinement',
      sourceRef: 'ninja signals round9',
      round: 9,
    }));
    const publicIp = this.resolvePublicIp(input.device, input.deviceDetails);
    if (publicIp) {
      patchIfBetter('network.public_ip', this.buildField({
        value: publicIp,
        status: 'confirmed',
        confidence: 0.84,
        sourceSystem: 'ninjaone',
        sourceRef: 'ninja final refinement selected device',
        round: 9,
      }));
    }

    return [...new Set(updatedPaths)];
  }

  private applyHistoryConfidenceCalibration(input: {
    sections: IterativeEnrichmentSections;
    relatedCases: RelatedCase[];
  }): HistoryCalibrationResult {
    const next: IterativeEnrichmentSections = {
      ticket: { ...input.sections.ticket },
      identity: { ...input.sections.identity },
      endpoint: { ...input.sections.endpoint },
      network: { ...input.sections.network },
      infra: { ...input.sections.infra },
    };
    const fields = this.flattenEnrichmentFields(next);
    const trackedPaths = new Set([
      'ticket.affected_user_name',
      'ticket.affected_user_email',
      'identity.user_principal_name',
      'endpoint.device_name',
      'endpoint.user_signed_in',
      'network.isp_name',
      'infra.firewall_make_model',
      'infra.wifi_make_model',
      'infra.switch_make_model',
    ]);
    const caseHaystacks = input.relatedCases.map((rc) => ({
      ticket_id: rc.ticket_id,
      text: `${rc.ticket_id} ${rc.symptom || ''} ${rc.resolution || ''}`.toLowerCase(),
    }));

    const fieldAdjustments: NonNullable<TicketContextAppendix['history_confidence_calibration']>['field_adjustments'] = [];
    const contradictions: NonNullable<TicketContextAppendix['history_confidence_calibration']>['contradictions'] = [];

    for (const record of fields) {
      if (!trackedPaths.has(record.path)) continue;
      const currentValue = String(record.field.value || '').trim();
      if (!currentValue || currentValue.toLowerCase() === 'unknown') continue;

      const supportTerms = this.buildHistorySupportTermsForField(record.path, currentValue);
      if (supportTerms.length === 0) continue;

      const supportCaseIds: string[] = [];
      for (const hc of caseHaystacks) {
        const hits = supportTerms.filter((term) => hc.text.includes(term));
        if (hits.length === 0) continue;
        const phraseHit = hc.text.includes(currentValue.toLowerCase());
        if (phraseHit || hits.length >= Math.min(2, supportTerms.length)) {
          supportCaseIds.push(hc.ticket_id);
        }
      }

      let contradictionCaseIds: string[] = [];
      if (record.path === 'network.isp_name') {
        const currentIsp = this.inferIspName({ ticketNarrative: currentValue, docs: [], itglueConfigs: [] });
        if (currentIsp) {
          const altProviders = new Set<string>();
          for (const hc of caseHaystacks) {
            const observed = this.inferIspName({ ticketNarrative: hc.text, docs: [], itglueConfigs: [] });
            if (!observed) continue;
            const providerContextLikely =
              hc.text.includes('dns') ||
              hc.text.includes('internet') ||
              hc.text.includes('comcast') ||
              hc.text.includes('xfinity') ||
              hc.text.includes('verizon');
            if (observed !== currentIsp && providerContextLikely) {
              altProviders.add(observed);
              contradictionCaseIds.push(hc.ticket_id);
            }
          }
          if (altProviders.size > 0) {
            contradictions.push({
              path: record.path,
              current_value: currentValue,
              observed_values: [...altProviders].slice(0, 5),
              case_ids: [...new Set(contradictionCaseIds)].slice(0, 8),
              note: 'Historical cases mention a different ISP/provider in similar context; verify current site/provider before diagnosis.',
            });
          }
        }
      }

      const prevConfidence = Number(record.field.confidence || 0);
      let delta = 0;
      let action: 'boost' | 'decrease' | 'context_only' = 'context_only';
      let reason = 'Historical cases are contextual only';
      if (supportCaseIds.length > 0) {
        delta += Math.min(0.15, 0.04 * supportCaseIds.length);
        action = 'boost';
        reason = `Historical matches support ${record.path} via repeated terms (${supportCaseIds.length} case(s))`;
      }
      if (contradictionCaseIds.length > 0) {
        const penalty = Math.min(0.12, 0.05 * contradictionCaseIds.length);
        delta -= penalty;
        action = delta >= 0 ? action : 'decrease';
        reason = supportCaseIds.length > 0
          ? 'Historical support exists but contradictory provider evidence reduced confidence'
          : 'Historical contradictions reduced confidence pending confirmation';
      }

      if (Math.abs(delta) < 0.0001) {
        fieldAdjustments.push({
          path: record.path,
          action: 'context_only',
          delta_confidence: 0,
          previous_confidence: Number(prevConfidence.toFixed(3)),
          new_confidence: Number(prevConfidence.toFixed(3)),
          support_case_ids: [...new Set(supportCaseIds)].slice(0, 8),
          ...(contradictionCaseIds.length ? { contradiction_case_ids: [...new Set(contradictionCaseIds)].slice(0, 8) } : {}),
          reason,
        });
        continue;
      }

      const newConfidence = Number(Math.max(0, Math.min(1, prevConfidence + delta)).toFixed(3));
      const adjustedField = this.buildField({
        value: record.field.value as any,
        status: record.field.status,
        confidence: newConfidence,
        sourceSystem: String(record.field.source_system || 'history_calibrated'),
        sourceRef: [
          record.field.source_ref || record.path,
          `history_calibration:${action}`,
          ...[...new Set(supportCaseIds)].slice(0, 3).map((id) => `case:${id}`),
        ].join(' | '),
        round: Math.max(8, Number(record.field.round || 1)),
        observedAt: record.field.observed_at,
      });
      this.setEnrichmentFieldByPath(next, record.path, adjustedField);
      fieldAdjustments.push({
        path: record.path,
        action,
        delta_confidence: Number(delta.toFixed(3)),
        previous_confidence: Number(prevConfidence.toFixed(3)),
        new_confidence: newConfidence,
        support_case_ids: [...new Set(supportCaseIds)].slice(0, 8),
        ...(contradictionCaseIds.length ? { contradiction_case_ids: [...new Set(contradictionCaseIds)].slice(0, 8) } : {}),
        reason,
      });
    }

    return {
      sections: next,
      appendix: {
        round: 8,
        field_adjustments: fieldAdjustments,
        contradictions,
      },
    };
  }

  private buildHistorySupportTermsForField(path: string, currentValue: string): string[] {
    const terms = new Set<string>();
    const raw = String(currentValue || '').trim().toLowerCase();
    if (!raw || raw === 'unknown') return [];
    terms.add(raw);
    for (const token of raw.split(/[^a-z0-9.@_-]+/).filter(Boolean)) {
      if (token.length >= 3) terms.add(token);
    }
    if (path.includes('user_name')) {
      for (const alias of this.generateNameAliases(currentValue)) {
        if (alias.length >= 3) terms.add(alias);
      }
    }
    if (path.includes('email')) {
      const local = raw.split('@')[0] || '';
      const domain = raw.split('@')[1] || '';
      if (local.length >= 3) terms.add(local);
      if (domain.length >= 3) terms.add(domain);
    }
    if (path === 'network.isp_name') {
      const canonical = this.inferIspName({ ticketNarrative: currentValue, docs: [], itglueConfigs: [] });
      if (canonical) terms.add(canonical.toLowerCase());
      if (/comcast/i.test(currentValue)) terms.add('xfinity');
      if (/xfinity/i.test(currentValue)) terms.add('comcast');
    }
    return [...terms].slice(0, 12);
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

  private isLikelyDomainDerivedCompanyLabel(value: string): boolean {
    const raw = this.normalizeName(String(value || ''));
    if (!raw) return false;
    if (/\s/.test(raw)) return false;
    if (!/^[A-Za-z0-9._&-]+$/.test(raw)) return false;

    const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (compact.length < 8) return false;

    if (compact.includes('andcompany') || compact.includes('andco')) return true;
    if (/(company|corp|corporation|management|services|solutions|technologies|technology|holdings|consulting)$/.test(compact)) {
      return true;
    }

    return false;
  }

  private shouldPreferCompanyCandidateOverIntake(intakeCompany: string, candidateCompany: string): boolean {
    const intake = this.normalizeName(String(intakeCompany || ''));
    const candidate = this.normalizeName(String(candidateCompany || ''));
    if (!intake || !candidate) return false;
    if (!this.isLikelyDomainDerivedCompanyLabel(intake)) return false;
    if (this.isLikelyDomainDerivedCompanyLabel(candidate)) return false;

    const candidateLooksDisplayReady =
      /[\s&.,()'-]/.test(candidate) || /\b(inc|llc|ltd|corp|corporation|co)\b/i.test(candidate);
    if (!candidateLooksDisplayReady) return false;

    return true;
  }

  private selectPreferredCompanyName(input: { intakeCompany: string; inferredCompany: string }): string {
    const intake = this.normalizeName(String(input.intakeCompany || ''));
    const inferred = this.normalizeName(String(input.inferredCompany || ''));
    if (this.shouldPreferCompanyCandidateOverIntake(intake, inferred)) {
      return inferred;
    }
    return this.normalizeName(intake || inferred || '');
  }

  private capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  private inferCompanyNameFromTicketText(text: string): string {
    const raw = String(text || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    const bodyPatterns = [
      /\bhas been created for\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?)\s*\.\s*we will attend/i,
      /\bcreated for\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?)\s*\.\s*/i,
      /\bfor\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?,\s*(?:LLC|Inc\.?|Corp\.?|Corporation|Ltd\.?|Co\.?))\b/i,
    ];
    for (const pattern of bodyPatterns) {
      const match = raw.match(pattern);
      const candidate = this.normalizeName(String(match?.[1] || ''))
        .replace(/\s+/g, ' ')
        .replace(/\b(we will attend|the details of the ticket are listed below)\b[\s\S]*$/i, '')
        .trim()
        .replace(/[.,;:\s]+$/g, '');
      if (candidate && candidate.length >= 3 && !/^unknown$/i.test(candidate)) {
        return candidate;
      }
    }

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
    const narrative = this.buildTicketNarrative(ticket);
    const fallback = this.normalizeTicketDeterministically(ticket.title || '', narrative);

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
      const parsed = this.extractJsonObject(llm.content);
      const title = String(parsed?.title || '').trim();
      const descriptionCanonical = this.postProcessCanonicalTicketText(String(parsed?.description_canonical || ''));
      let descriptionUi = this.postProcessUiTicketText(String(parsed?.description_ui || ''));
      const requesterName = this.normalizeName(String(parsed?.requester_name || '').trim());
      const requesterEmail = String(parsed?.requester_email || '').trim().toLowerCase();
      const affectedUserName = this.normalizeName(String(parsed?.affected_user_name || '').trim());
      const affectedUserEmail = String(parsed?.affected_user_email || '').trim().toLowerCase();
      const organizationHint = String(parsed?.organization_hint || '').trim();
      const deviceHints = Array.isArray(parsed?.device_hints) ? parsed.device_hints.map(String) : [];
      const symptoms = Array.isArray(parsed?.symptoms) ? parsed.symptoms.map(String) : [];
      const technologyFacets = Array.isArray(parsed?.technology_facets) ? parsed.technology_facets.map(String) : [];
      const confidenceRaw = Number(parsed?.confidence);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.75;
      descriptionUi = this.guardTicketUiRoleAssignment({
        descriptionUi,
        requesterName,
        ticketRequester: ticket.requester || '',
        canonicalText: descriptionCanonical || fallback.descriptionClean,
        narrative,
      });

      if (descriptionCanonical.length >= 10 || descriptionUi.length >= 10) {
        const canonicalRequesterEmail = requesterEmail || this.extractFirstEmail(ticket.requester || '') || this.extractFirstEmail(narrative);
        const canonicalRequesterName = requesterName || this.normalizeName(ticket.requester || '') || '';
        const canonicalAffectedName = affectedUserName || canonicalRequesterName || '';
        const canonicalAffectedEmail = affectedUserEmail || canonicalRequesterEmail || '';
        const canonicalDisplayText = descriptionCanonical || this.postProcessCanonicalTicketText(fallback.descriptionClean);
        let descriptionDisplayMarkdown = '';
        const strictFormat = await this.formatDisplayMarkdownVerbatimWithLLM(canonicalDisplayText).catch(() => '');
        if (this.isDisplayMarkdownVerbatimEnough(canonicalDisplayText, strictFormat)) {
          descriptionDisplayMarkdown = strictFormat;
        }
        return {
          title: title || fallback.title,
          descriptionCanonical: canonicalDisplayText,
          descriptionUi:
            descriptionUi ||
            this.guardTicketUiRoleAssignment({
              descriptionUi: this.postProcessUiTicketText(fallback.descriptionClean),
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
      }
    } catch {
      // deterministic fallback below
    }

    return {
      ...fallback,
      descriptionCanonical: this.postProcessCanonicalTicketText(fallback.descriptionClean),
      descriptionUi: this.guardTicketUiRoleAssignment({
        descriptionUi: this.postProcessUiTicketText(fallback.descriptionClean),
        requesterName: fallback.requesterName,
        ticketRequester: ticket.requester || '',
        canonicalText: fallback.descriptionClean,
        narrative,
      }),
      descriptionDisplayMarkdown: this.postProcessCanonicalTicketText(fallback.descriptionClean),
      descriptionDisplayFormat: 'plain',
      organizationHint: '',
      deviceHints: [],
      symptoms: [],
      technologyFacets: [],
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

  private postProcessCanonicalTicketText(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let text = raw;

    // Strip obvious HTML leftovers and encoded noise
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' ')
      .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");

    // Drop boilerplate and disclaimers (Autotask/email wrappers)
    text = text
      .replace(/\*{3}\s*please enter replies above this line\s*\*{3}[\s\S]*$/i, ' ')
      .replace(/thank you for contacting us[\s\S]*?the details of the ticket are listed below\.?/i, ' ')
      .replace(/you can access your service ticket via our client portal by clicking the following link:[\s\S]*$/i, ' ')
      .replace(/if you do not have access to the client portal[\s\S]*$/i, ' ')
      .replace(/sincerely,\s*refresh support team[\s\S]*$/i, ' ')
      .replace(/caution[\s\S]*?this email originated outside the organization[\s\S]*$/i, ' ')
      .replace(/do not click any links? or attachments? unless you know the sender[\s\S]*$/i, ' ');

    // Remove safe links / raw URLs while preserving nearby text
    text = text
      .replace(/https?:\/\/nam\d+\.safelinks\.protection\.outlook\.com\/\S+/gi, ' ')
      .replace(/https?:\/\/\S+/gi, ' ');

    // Keep the likely user request portion if an embedded "Description:" exists
    const descMatch = text.match(/\bdescription\s*:\s*([\s\S]+)$/i);
    if (descMatch?.[1]) {
      text = descMatch[1];
    }

    // Trim auto-ack ticket metadata that often precedes the real request
    text = text
      .replace(/\bticket\s*#?\s*:\s*T\d{8}\.\d+\b/gi, ' ')
      .replace(/\bcreated on\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]*?\bby\s+[A-Za-z .'-]+/gi, ' ')
      .replace(/\btitle\s*:\s*[^.:\n]+/gi, ' ');

    // Normalize whitespace and cut trailing repeated signatures/disclaimers again after transforms
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\t+/g, ' ')
      .replace(/[ \u00A0]+/g, ' ')
      .replace(/[ ]*\n[ ]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\b(you can access your service ticket|sincerely|caution)\b[\s\S]*$/i, '')
      .trim();

    return this.formatCanonicalTicketSignature(text);
  }

  private postProcessDisplayMarkdownTicketText(value: string): string {
    let text = String(value || '').trim();
    if (!text) return '';

    text = text
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^cleaned ticket text \(noise removed,\s*meaning preserved\):\s*/i, '')
      .trim();

    // Strip raw HTML if the model leaked markup; keep markdown intact.
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' ')
      .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");

    // Remove common wrappers if they slipped through, but preserve signature content.
    text = text
      .replace(/\*{3}\s*please enter replies above this line\s*\*{3}[\s\S]*?(?=\n|$)/ig, '')
      .replace(/you can access your service ticket via our client portal by clicking the following link:[^\n]*/ig, '')
      .replace(/if you do not have access to the client portal[^\n]*/ig, '')
      .replace(/\bcaution\b[^\n]*\n?[^\n]*this email originated outside the organization[^\n]*/ig, '')
      .replace(/this message is directed to and is for the use of the above-noted addressee only[\s\S]*?(?=\n{2,}|$)/ig, '');

    text = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }

  private async formatDisplayMarkdownVerbatimWithLLM(sourceText: string): Promise<string> {
    const text = String(sourceText || '').trim();
    if (!text) return '';
    const prompt = `Format the following ticket text as Markdown for readability.

CRITICAL RULES (strict):
- Preserve the original wording for the ticket content and signature details.
- Do NOT paraphrase, summarize, reinterpret, rename, or reorder facts.
- You MAY add minimal formatting labels/headings for structure (for example: "Request", "Signature", "Notes") when helpful.
- You MAY add Markdown syntax, whitespace, line breaks, bullets, and tables.
- Keep added labels minimal and generic; do not invent new facts.
- Preserve the signature/contact block if present.
- Output Markdown only (no code fences, no explanation).

Text:
"""${text.slice(0, 12000)}"""`;
    const llm = await callLLM(prompt);
    return this.postProcessDisplayMarkdownTicketText(String(llm.content || ''));
  }

  private isDisplayMarkdownVerbatimEnough(sourceText: string, markdownText: string): boolean {
    const source = this.normalizeDisplayTextForVerbatimGuard(sourceText);
    const rendered = this.normalizeDisplayTextForVerbatimGuard(this.stripMarkdownForDisplayGuard(markdownText));
    if (!source || !rendered) return false;

    const sourceTokens = source.split(' ').filter(Boolean);
    const renderedTokens = rendered.split(' ').filter(Boolean);
    if (!sourceTokens.length || !renderedTokens.length) return false;

    // Exact match after markdown stripping/whitespace normalization is ideal.
    if (source === rendered) return true;

    // Coverage by subsequence: source wording should still appear in order.
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

    // Allow formatting headers/table labels, but reject meaningful rewrites.
    // If the source is short, require tighter length/coverage because a few new words can dominate.
    if (sourceTokens.length < 12) {
      return coverage >= 0.9 && novelRatio <= 0.12 && lengthRatio >= 0.75 && lengthRatio <= 1.4;
    }
    return coverage >= 0.9 && novelRatio <= 0.08 && lengthRatio >= 0.7 && lengthRatio <= 1.5;
  }

  private stripMarkdownForDisplayGuard(value: string): string {
    return String(value || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*\|/gm, ' ')
      .replace(/\|/g, ' ')
      .replace(/^\s*:?[-]{3,}:?\s*$/gm, ' ')
      .replace(/[*_~]/g, '')
      .trim();
  }

  private normalizeDisplayTextForVerbatimGuard(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  private formatCanonicalTicketSignature(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';

    const signatureStart = this.detectLikelySignatureStart(text);
    if (signatureStart <= 0 || signatureStart >= text.length) {
      return text.replace(/\s+/g, ' ').trim();
    }

    const body = text.slice(0, signatureStart).replace(/\s+/g, ' ').trim();
    const signature = text.slice(signatureStart).trim();
    const formattedSignature = this.formatSignatureBlock(signature);
    if (!formattedSignature) return body;
    if (!body) return formattedSignature;
    return `${body}\n\n${formattedSignature}`;
  }

  private detectLikelySignatureStart(text: string): number {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return -1;

    const lower = normalized.toLowerCase();
    const signoffPatterns = [
      /\bthanks[,!]?\s+/ig,
      /\bthank you[,!]?\s+/ig,
      /\bbest regards[,!]?\s+/ig,
      /\bregards[,!]?\s+/ig,
      /\bcheers[,!]?\s+/ig,
    ];
    for (const pattern of signoffPatterns) {
      const match = pattern.exec(lower);
      if (match && this.signatureSignalCount(normalized.slice(match.index)) >= 2) {
        return match.index;
      }
    }

    // Fallback: detect a trailing contact-card style block around the first contact signal near the tail.
    const tailStart = Math.floor(normalized.length * 0.45);
    const contactMatch = normalized
      .slice(tailStart)
      .match(/\b(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:Phone|Direct|Email|Website)\s*:|www\.)/i);
    if (!contactMatch || contactMatch.index == null) return -1;

    const contactIdx = tailStart + contactMatch.index;
    let start = Math.max(0, contactIdx - 120);
    const beforeContact = normalized.slice(start, contactIdx);

    const properName = beforeContact.match(/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\s*$/);
    const upperName = beforeContact.match(/(?:^|\s)([A-Z]{2,}(?:\s+[A-Z]{2,}){1,4})\s*$/);
    if (properName?.index != null) {
      start += properName.index + (properName[0].startsWith(' ') ? 1 : 0);
    } else if (upperName?.index != null) {
      start += upperName.index + (upperName[0].startsWith(' ') ? 1 : 0);
    } else {
      start = contactIdx;
    }

    return this.signatureSignalCount(normalized.slice(start)) >= 2 ? start : -1;
  }

  private signatureSignalCount(text: string): number {
    const raw = String(text || '');
    let count = 0;
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw)) count += 1;
    if (/\b(?:direct|phone|mobile|cell|office|email|website)\s*:/i.test(raw)) count += 1;
    if (/\bwww\.[a-z0-9.-]+\.[a-z]{2,}\b/i.test(raw)) count += 1;
    if (/\b(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]?\d{4}\b/.test(raw)) count += 1;
    if (/\b\d{2,6}\s+[A-Za-z0-9.'#-]+(?:\s+[A-Za-z0-9.'#-]+){1,8}\b/.test(raw)) count += 1;
    return count;
  }

  private formatSignatureBlock(signature: string): string {
    let sig = String(signature || '')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    if (!sig) return '';

    // Sign-off on its own line when present.
    sig = sig.replace(/^(thanks|thank you|regards|best regards|cheers)[,!]?\s+/i, (_m, word) => `${word.replace(/\b\w/g, (c: string) => c.toUpperCase())},\n`);

    // Put common contact labels on their own lines.
    sig = sig.replace(/\s+(?=(?:Direct|Phone|Mobile|Cell|Office|Email|Website)\s*:)/g, '\n');

    // Put email / website / phones on their own lines if inline.
    sig = sig
      .replace(/\s+(?=[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
      .replace(/\s+(?=www\.[a-z0-9.-]+\.[a-z]{2,}\b)/ig, '\n')
      .replace(/\s+(?=(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]?\d{4}\b)/g, '\n');

    // Break before common titles and address starts when they were flattened.
    sig = sig
      .replace(/\s+(?=(?:Sr\.?\s+)?(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n')
      .replace(/\s+(?=\d{2,6}\s+[A-Za-z])/g, '\n');

    // Handle compact signature markers like "e john@..." / "c 781..." used in some email signatures.
    sig = sig
      .replace(/\s+(?=\be\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
      .replace(/\s+(?=\bc\s+\d{3}[.\-\s]\d{3}[.\-\s]\d{4}\b)/ig, '\n');

    // Rejoin common label/value pairs and title suffix splits if previous rules over-split.
    sig = sig
      .replace(/\b(Direct|Phone|Mobile|Cell|Office|Email|Website):\s*\n\s*/g, '$1: ')
      .replace(/\n(Sr\.|Jr\.)\s*\n(?=(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n$1 ');

    // Keep lines tidy.
    sig = sig
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

    return sig;
  }

  private postProcessUiTicketText(value: string): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text
      .replace(/^new ticket detected:\s*/i, '')
      .replace(/^ticket\s*#?\s*T\d{8}\.\d+\s*[:\-]\s*/i, '')
      .replace(/\s*(from|at)\s+[A-Z][\s\S]*$/i, '')
      .trim();
  }

  private guardTicketUiRoleAssignment(input: {
    descriptionUi: string;
    requesterName: string;
    ticketRequester: string;
    canonicalText: string;
    narrative: string;
  }): string {
    let ui = String(input.descriptionUi || '').trim();
    if (!ui) return ui;

    const requesterName = this.normalizeName(input.requesterName || input.ticketRequester || '').trim();
    if (!requesterName) return ui;

    const requesterLower = requesterName.toLowerCase();
    const uiLower = ui.toLowerCase();
    const canonical = String(input.canonicalText || input.narrative || '').toLowerCase();

    const mentionsNewEmployee = /\b(new|another)\s+(maintenance\s+)?employee\b/.test(canonical);
    const requesterAsksForThirdParty =
      /\bwe have a new\b/.test(canonical) ||
      /\bhe will need\b/.test(canonical) ||
      /\bshe will need\b/.test(canonical) ||
      /\bthey will need\b/.test(canonical) ||
      /\bfor (a|an|our)\s+(new\s+)?(employee|hire|user)\b/.test(canonical) ||
      /\bon behalf of\b/.test(canonical);

    const uiAssignsRequesterToNewEmployee =
      uiLower.includes(requesterLower) &&
      /\bnew\s+(maintenance\s+)?employee\b/.test(uiLower) &&
      !/\brequests?\b/.test(uiLower);

    if (!(mentionsNewEmployee && requesterAsksForThirdParty && uiAssignsRequesterToNewEmployee)) {
      return ui;
    }

    // Rewrite to preserve requester role and keep affected user unnamed unless explicitly present.
    ui = ui.replace(new RegExp(`\\b${this.escapeRegex(requesterName)}\\b`, 'ig'), '').replace(/\s+/g, ' ').trim();
    ui = ui.replace(/\bfor\s+new\s+(maintenance\s+)?employee\b/gi, 'for a new $1employee (name not provided)');
    ui = ui.replace(/\bnew\s+(maintenance\s+)?employee\b/i, 'new $1employee (name not provided)');
    ui = ui.replace(/\s+/g, ' ').trim();
    ui = ui.replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '');

    const requesterLead = `${requesterName} requests`;
    if (!ui.toLowerCase().startsWith(requesterLead.toLowerCase())) {
      ui = `${requesterLead} ${ui.charAt(0).toLowerCase()}${ui.slice(1)}`;
    }
    return ui;
  }

  private escapeRegex(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  private normalizeOrgNameForMatch(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[.,()[\]{}'"/\\_-]+/g, ' ')
      .replace(
        /\b(incorporated|corporation|corp|company|co|limited|ltd|llc|llp|pllc|inc)\b/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scoreOrgNameMatch(name: string, candidate: string, candidateShortName?: string): number {
    const rawN = this.normalizeName(name).toLowerCase();
    const variants = [candidate, candidateShortName || '']
      .map((v) => this.normalizeName(String(v || '')))
      .filter(Boolean);
    if (!rawN || variants.length === 0) return 0;

    const genericTokens = new Set([
      'resource',
      'resources',
      'technology',
      'technologies',
      'solution',
      'solutions',
      'service',
      'services',
      'system',
      'systems',
      'group',
      'global',
      'international',
      'management',
      'consulting',
      'support',
      'partners',
      'network',
      'networks',
      'communications',
      'communication',
      'company',
      'companies',
      'holdings',
    ]);

    let best = 0;
    for (const variant of variants) {
      const rawC = variant.toLowerCase();
      if (!rawC) continue;
      if (rawC === rawN) return 1;

      const n = this.normalizeOrgNameForMatch(rawN);
      const c = this.normalizeOrgNameForMatch(rawC);
      if (!n || !c) continue;
      if (c === n) return 0.99;
      if (c.includes(n) || n.includes(c)) {
        best = Math.max(best, 0.95);
      }

      const nTokens = [...new Set(n.split(' ').filter((t) => t.length >= 2))];
      const cTokens = [...new Set(c.split(' ').filter((t) => t.length >= 2))];
      if (nTokens.length === 0 || cTokens.length === 0) continue;

      const overlap = nTokens.filter((t) => cTokens.includes(t));
      if (overlap.length === 0) continue;

      const nDistinct = nTokens.filter((t) => !genericTokens.has(t));
      const cDistinct = cTokens.filter((t) => !genericTokens.has(t));
      const distinctOverlap = nDistinct.filter((t) => cDistinct.includes(t));

      // Prevent false positives like "CAT Resources" -> "Composite Resources" (shared generic token only).
      if (nDistinct.length > 0 && cDistinct.length > 0 && distinctOverlap.length === 0) {
        continue;
      }

      const coverageMin = overlap.length / Math.max(Math.min(nTokens.length, cTokens.length), 1);
      const coverageMax = overlap.length / Math.max(Math.max(nTokens.length, cTokens.length), 1);
      const distinctCoverage =
        distinctOverlap.length / Math.max(Math.min(Math.max(nDistinct.length, 1), Math.max(cDistinct.length, 1)), 1);

      let score = 0.35 * coverageMin + 0.25 * coverageMax + 0.4 * distinctCoverage;

      const acronym = nDistinct.map((t) => t[0]).join('');
      if (acronym && (c.includes(acronym) || rawC.includes(acronym))) {
        score = Math.max(score, 0.72);
      }

      best = Math.max(best, score);
    }

    return best;
  }

  private fuzzyMatch(name: string, candidate: string): boolean {
    return this.scoreOrgNameMatch(name, candidate) >= 0.8;
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
    const ranked = orgs
      .map((o: any) => ({
        org: o,
        score: this.scoreOrgNameMatch(companyName, String(o?.name || '')),
      }))
      .filter((r) => r.score >= 0.8)
      .sort((a, b) => b.score - a.score);
    const found = ranked[0]?.org || null;
    return found ? { id: Number(found.id), name: String(found.name) } : null;
  }

  private async resolveITGlueOrg(
    itglueClient: ITGlueClient,
    companyName: string,
    hintText?: string
  ): Promise<{ id: string; name: string } | null> {
    const orgs = await itglueClient.getOrganizations(1000);
    const rankedByName = orgs
      .map((o: any) => ({
        org: o,
        score: this.scoreOrgNameMatch(
          companyName,
          String(this.itgAttr(o?.attributes || {}, 'name') || ''),
          String(this.itgAttr(o?.attributes || {}, 'short_name') || '')
        ),
      }))
      .filter((r) => r.score >= 0.8)
      .sort((a, b) => b.score - a.score);
    const byName = rankedByName[0]?.org;
    if (byName) {
      return { id: String(byName.id), name: String(this.itgAttr(byName?.attributes || {}, 'name') || companyName) };
    }

    const ignoreDomainSuffixes = [
      'outlook.com',
      'office.com',
      'microsoft.com',
      'autotask.net',
      'itclientportal.com',
      'safelinks.protection.outlook.com',
      'protection.outlook.com',
      'refreshtech.com',
    ];
    const domains = this.extractEmailDomains(hintText || '').filter(
      (d) => !ignoreDomainSuffixes.some((suffix) => d === suffix || d.endsWith(`.${suffix}`))
    );
    if (domains.length === 0) return null;

    const rankedByDomain = orgs
      .map((o: any) => {
        const primaryDomain = String(this.itgAttr(o?.attributes || {}, 'primary_domain') || '').toLowerCase();
        const domainScore =
          primaryDomain && domains.some((d) => d === primaryDomain)
            ? 1
            : primaryDomain && domains.some((d) => d.endsWith(`.${primaryDomain}`) || primaryDomain.endsWith(`.${d}`))
              ? 0.8
              : 0;
        const nameScore = this.scoreOrgNameMatch(
          companyName,
          String(this.itgAttr(o?.attributes || {}, 'name') || ''),
          String(this.itgAttr(o?.attributes || {}, 'short_name') || '')
        );
        return { org: o, score: domainScore > 0 ? domainScore * 0.75 + nameScore * 0.25 : 0 };
      })
      .filter((r) => r.score >= 0.75)
      .sort((a, b) => b.score - a.score);

    const byDomain = rankedByDomain[0]?.org;
    return byDomain ? { id: String(byDomain.id), name: String(this.itgAttr(byDomain?.attributes || {}, 'name') || companyName) } : null;
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
 * Persist SSOT cache for a ticket
 */
export async function persistTicketSSOT(
  ticketId: string,
  sessionId: string,
  payload: TicketSSOT
): Promise<void> {
  try {
    const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_ssot');
    if (!canPersist) {
      console.log(`[DB] Skipped SSOT persist for superseded session ${sessionId} ticket ${ticketId}`);
      return;
    }
    await execute(
      `INSERT INTO ticket_ssot (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
      [ticketId, sessionId, JSON.stringify(payload)]
    );
    console.log(`[DB] Persisted SSOT for ticket ${ticketId}`);
  } catch (error) {
    console.error('[DB] Failed to persist SSOT:', error);
    throw error;
  }
}

export async function persistTicketTextArtifact(
  ticketId: string,
  sessionId: string,
  payload: TicketTextArtifact
): Promise<void> {
  try {
    const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_text_artifact');
    if (!canPersist) {
      console.log(`[DB] Skipped ticket text artifact persist for superseded session ${sessionId} ticket ${ticketId}`);
      return;
    }
    await execute(
      `INSERT INTO ticket_text_artifacts (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
      [ticketId, sessionId, JSON.stringify(payload)]
    );
    console.log(`[DB] Persisted ticket text artifact for ticket ${ticketId}`);
  } catch (error) {
    console.error('[DB] Failed to persist ticket text artifact:', error);
  }
}

export async function getTicketTextArtifact(
  ticketId: string
): Promise<{ payload: TicketTextArtifact; created_at: string; updated_at: string } | null> {
  try {
    const row = await queryOne<{ payload: TicketTextArtifact; created_at: string; updated_at: string }>(
      `SELECT payload, created_at, updated_at
       FROM ticket_text_artifacts
       WHERE ticket_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [ticketId]
    );
    return row || null;
  } catch (error) {
    console.error('[DB] Failed to fetch ticket text artifact:', error);
    return null;
  }
}

export async function persistTicketContextAppendix(
  ticketId: string,
  sessionId: string,
  payload: TicketContextAppendix
): Promise<void> {
  try {
    const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_context_appendix');
    if (!canPersist) {
      console.log(`[DB] Skipped ticket context appendix persist for superseded session ${sessionId} ticket ${ticketId}`);
      return;
    }
    await execute(
      `INSERT INTO ticket_context_appendix (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
      [ticketId, sessionId, JSON.stringify(payload)]
    );
    console.log(`[DB] Persisted ticket context appendix for ticket ${ticketId}`);
  } catch (error) {
    console.error('[DB] Failed to persist ticket context appendix:', error);
  }
}

async function canPersistTicketScopedArtifact(
  ticketId: string,
  sessionId: string,
  artifactKind: 'ticket_ssot' | 'ticket_text_artifact' | 'ticket_context_appendix'
): Promise<boolean> {
  try {
    const session = await queryOne<{
      id: string;
      ticket_id: string;
      status: string;
      last_error: string | null;
    }>(
      `SELECT id, ticket_id, status, last_error
       FROM triage_sessions
       WHERE id = $1
       LIMIT 1`,
      [sessionId]
    );
    if (!session) return false;
    if (String(session.ticket_id || '') !== String(ticketId || '')) return false;

    const status = String(session.status || '').toLowerCase();
    const lastError = String(session.last_error || '').toLowerCase();
    if (status === 'failed' && lastError.includes('manual refresh restart')) {
      return false;
    }

    const latest = await queryOne<{ id: string }>(
      `SELECT id
       FROM triage_sessions
       WHERE ticket_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [ticketId]
    );
    const isLatest = String(latest?.id || '') === String(sessionId || '');
    if (!isLatest) {
      console.log(`[DB] Guard rejected ${artifactKind} persist: session ${sessionId} is not latest for ticket ${ticketId}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[DB] Artifact guard failed for ${artifactKind}; allowing persist as fallback:`, error);
    return true;
  }
}

export async function getTicketContextAppendix(
  ticketId: string
): Promise<{ payload: TicketContextAppendix; created_at: string; updated_at: string } | null> {
  try {
    const row = await queryOne<{ payload: TicketContextAppendix; created_at: string; updated_at: string }>(
      `SELECT payload, created_at, updated_at
       FROM ticket_context_appendix
       WHERE ticket_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [ticketId]
    );
    return row || null;
  } catch (error) {
    console.error('[DB] Failed to fetch ticket context appendix:', error);
    return null;
  }
}

export async function persistItglueOrgSnapshot(
  orgId: string,
  payload: Record<string, unknown>,
  sourceHash: string
): Promise<void> {
  try {
    await execute(
      `INSERT INTO itglue_org_snapshot (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [orgId, JSON.stringify(payload), sourceHash]
    );
  } catch (error) {
    console.error('[DB] Failed to persist IT Glue snapshot:', error);
  }
}

export async function getItglueOrgEnriched(
  orgId: string
): Promise<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string } | null> {
  try {
    const row = await queryOne<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string }>(
      `SELECT payload, source_hash, created_at, updated_at
       FROM itglue_org_enriched
       WHERE org_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [orgId]
    );
    return row || null;
  } catch (error) {
    console.error('[DB] Failed to fetch IT Glue enriched cache:', error);
    return null;
  }
}

export async function upsertItglueOrgEnriched(
  orgId: string,
  payload: Record<string, unknown>,
  sourceHash: string
): Promise<void> {
  try {
    await execute(
      `INSERT INTO itglue_org_enriched (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [orgId, JSON.stringify(payload), sourceHash]
    );
  } catch (error) {
    console.error('[DB] Failed to persist IT Glue enriched cache:', error);
  }
}

export async function persistNinjaOrgSnapshot(
  orgId: string,
  payload: Record<string, unknown>,
  sourceHash: string
): Promise<void> {
  try {
    await execute(
      `INSERT INTO ninja_org_snapshot (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [orgId, JSON.stringify(payload), sourceHash]
    );
  } catch (error) {
    console.error('[DB] Failed to persist Ninja snapshot:', error);
  }
}

export async function getNinjaOrgEnriched(
  orgId: string
): Promise<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string } | null> {
  try {
    const row = await queryOne<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string }>(
      `SELECT payload, source_hash, created_at, updated_at
       FROM ninja_org_enriched
       WHERE org_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [orgId]
    );
    return row || null;
  } catch (error) {
    console.error('[DB] Failed to fetch Ninja enriched cache:', error);
    return null;
  }
}

export async function upsertNinjaOrgEnriched(
  orgId: string,
  payload: Record<string, unknown>,
  sourceHash: string
): Promise<void> {
  try {
    await execute(
      `INSERT INTO ninja_org_enriched (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [orgId, JSON.stringify(payload), sourceHash]
    );
  } catch (error) {
    console.error('[DB] Failed to persist Ninja enriched cache:', error);
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
