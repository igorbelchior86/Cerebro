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
import { callLLM } from './llm-adapter.js';

import { AutotaskFetcher } from './data-fetchers/autotask-fetcher.js';
import { NinjaOneFetcher } from './data-fetchers/ninjaone-fetcher.js';
import { ITGlueFetcher } from './data-fetchers/itglue-fetcher.js';
import { EvidenceBuilder } from './evidence-builder.js';
import { EnrichmentEngine } from './enrichment-engine.js';
import { FusionEngine } from './fusion-engine.js';

import {
  itgAttr,
  normalizeName,
  buildField,
  buildIterativeEnrichmentProfile,
  getEnrichmentFieldByPath,
  setEnrichmentFieldByPath,
  flattenEnrichmentFields,
  computeEnrichmentCoverage,
  buildEnrichmentRounds,
  roundLabel,
  isUnknown,
  pickBetter,
  pickHistoryKeyword,
  mapAutotaskPriority,
  selectPreferredCompanyName,
  extractEmailDomains,
  extractEmails,
  extractFirstEmail,
  inferCompanyNameFromTicketText,
  buildTicketNarrative,
  normalizeTicketDeterministically,
  postProcessCanonicalTicketText,
  postProcessDisplayMarkdownTicketText,
  stripMarkdownForDisplayGuard,
  normalizeDisplayTextForVerbatimGuard,
  formatCanonicalTicketSignature,
  postProcessUiTicketText,
  guardTicketUiRoleAssignment,
  extractJsonObject,
  buildRequesterTokens,
  normalizeOrgNameForMatch,
  scoreOrgNameMatch,
  fuzzyMatch,
  generateNameAliases,
  extractSoftwareHintsFromTicket,
  extractLoggedInUser as extractLoggedInUserHelper,
  extractITGlueInfraCandidates as extractITGlueInfraCandidatesHelper,
  extractITGlueWanCandidate as extractITGlueWanCandidateHelper,
  extractInfraMakeModel as extractInfraMakeModelHelper,
  inferIspName as inferIspNameHelper,
  normalizeSimpleToken,
  resolveNinjaOrg as resolveNinjaOrgHelper,
  isLikelyDomainDerivedCompanyLabel,
  shouldPreferCompanyCandidateOverIntake,
  capitalize,
  detectLikelySignatureStart,
  signatureSignalCount,
  formatSignatureBlock
} from './prepare-context-helpers.js';

import {
  PrepareContextInput,
  TicketLike,
  TicketSSOT,
  TicketTextArtifact,
  TicketContextAppendix,
  ScopeMeta,
  ITGlueWanCandidate,
  ITGlueInfraCandidate,
  FacetContext,
  DeviceResolutionResult,
  AutotaskCreds,
  NinjaOneCreds,
  ITGlueCreds,
  ItglueEnrichedField,
  ItglueEnrichedPayload,
  NinjaEnrichedField,
  NinjaEnrichedPayload,
  FusionLink,
  FusionInference,
  FusionFieldCandidate,
  FusionFieldResolution,
  FusionAdjudicationOutput,
  HistoryCalibrationResult
} from './prepare-context.types.js';

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
  private enrichmentEngine = new EnrichmentEngine();
  private fusionEngine: FusionEngine;

  constructor() {
    this.fusionEngine = new FusionEngine({
      normalizeName: (n) => normalizeName(n),
      itgAttr: (a, k) => itgAttr(a, k),
      buildField: (i) => buildField(i),
      isPublicIPv4: (ip) => this.enrichmentEngine.isPublicIPv4(ip)
    });
  }

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
    // Important: when using UI/DB credentials, avoid forcing a stale/placeholder env zone URL.
    // Let Autotask zone discovery run unless the DB credential explicitly provides zoneUrl.
    const zoneUrl = creds
      ? (creds.zoneUrl || undefined)
      : (process.env.AUTOTASK_ZONE_URL || undefined);

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

    // Temporarily restoring for legacy logic below
    const { autotaskClient, ninjaoneClient, itglueClient, credentialScope, tenantId } =
      await this.resolveClientsForSession(input.sessionId);

    const sourceWorkspace = tenantId ? `tenant:${tenantId}` : 'workspace:latest';

    const autotaskFetcher = new AutotaskFetcher();

    const fetchContext = {
      sessionId: input.sessionId,
      ticketId: input.ticketId,
      ...(input.orgId ? { orgId: input.orgId } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(input.organizationIds ? { organizationIds: input.organizationIds } : {})
    };

    // 1. Fetch from Autotask Strategy
    const autotaskResult = await autotaskFetcher.fetch(fetchContext);

    // Fallbacks if fetcher couldn't get the ticket
    let ticket: TicketLike | null = autotaskResult.raw?.autotaskTickets?.[0] || null;
    let signals: Signal[] = [];
    let intakeSource: 'autotask' | 'email' | 'unknown' = 'unknown';

    // (Legacy compatibility logic below until fully extracted)

    // T-format tickets are looked up in Autotask by ticketNumber.
    const isEmailTicket = input.ticketId.startsWith('T');

    if (isEmailTicket) {
      console.log(`[PrepareContext] Resolving T-format ticket from Autotask: ${input.ticketId}`);
      try {
        const autotaskTicket = await autotaskClient.getTicketByTicketNumber(input.ticketId);
        ticket = autotaskTicket;
        intakeSource = 'autotask';
        console.log(`[PrepareContext] Resolved ${input.ticketId} from Autotask API (primary)`);

        const ticketIdNum = Number(autotaskTicket.id);
        if (!Number.isNaN(ticketIdNum)) {
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
        }
      } catch (autotaskErr) {
        console.warn(`[PrepareContext] Autotask lookup failed for ${input.ticketId}: ${(autotaskErr as Error).message}`);
        missingData.push({
          field: 'autotask_ticket',
          why: `Autotask lookup failed for T-format ticket: ${(autotaskErr as Error).message}`,
        });
      }
    } else {
      // Original Autotask Flow
      try {
        const ticketIdNum = parseInt(input.ticketId, 10);
        if (isNaN(ticketIdNum)) {
          throw new Error(`Invalid numeric ticket ID: ${input.ticketId}`);
        }
        ticket = await autotaskClient.getTicket(ticketIdNum);
        intakeSource = 'autotask';
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
      throw new Error(`Cannot prepare context without valid ticket from Autotask`);
    }
    const sourceFindings: SourceFinding[] = [];
    const rejectedEvidence: RejectedEvidence[] = [];
    const rawTicketRecord = ticket as Record<string, unknown>;
    const autotaskCompanyId = Number(rawTicketRecord.companyID);
    const autotaskContactId = Number(rawTicketRecord.contactID);
    const autotaskAssignedResourceId = Number(rawTicketRecord.assignedResourceID);
    let autotaskContactNameResolved = '';
    let autotaskContactEmailResolved = '';
    let autotaskAssignedResourceNameResolved = '';
    let autotaskAssignedResourceEmailResolved = '';
    const firstMeaningful = (...values: unknown[]) =>
      values
        .map((v) => String(v || '').trim())
        .find((v) => Boolean(v && v.toLowerCase() !== 'unknown')) || '';
    const joinName = (...parts: unknown[]) =>
      parts
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
    if ((String((ticket as any)?.company || '').trim() === '' || String((ticket as any)?.company || '').trim().toLowerCase() === 'unknown')
      && Number.isFinite(autotaskCompanyId)) {
      try {
        const company = await autotaskClient.getCompany(autotaskCompanyId);
        const companyNameCandidate = [
          company.companyName,
          company.company,
          company.accountName,
          company.name,
          company.company_name,
        ]
          .map((v) => String(v || '').trim())
          .find((v) => Boolean(v && v.toLowerCase() !== 'unknown'));
        if (companyNameCandidate) {
          ticket.company = companyNameCandidate;
          console.log(`[PrepareContext] Resolved Autotask company ${autotaskCompanyId}: ${companyNameCandidate}`);
        }
      } catch (error) {
        console.warn(
          `[PrepareContext] Could not resolve Autotask company ${autotaskCompanyId}: ${(error as Error).message}`
        );
      }
    }
    if (Number.isFinite(autotaskContactId)) {
      try {
        const contact = await autotaskClient.getContact(autotaskContactId);
        const contactNameCandidate = firstMeaningful(
          contact.fullName,
          contact.displayName,
          contact.contactName,
          contact.name,
          joinName(contact.firstName, contact.lastName),
          joinName(contact.firstName, contact.middleInitial, contact.lastName)
        );
        const contactEmailCandidate = firstMeaningful(
          contact.emailAddress,
          contact.email,
          contact.emailAddress2,
          contact.emailAddress3
        ).toLowerCase();

        if (contactNameCandidate) {
          autotaskContactNameResolved = contactNameCandidate;
          if (!String(ticket.requester || '').trim() || String(ticket.requester || '').trim().toLowerCase() === 'unknown') {
            ticket.requester = contactNameCandidate;
          }
          if (!String(ticket.canonicalRequesterName || '').trim()) {
            ticket.canonicalRequesterName = contactNameCandidate;
          }
        }
        if (contactEmailCandidate) {
          autotaskContactEmailResolved = contactEmailCandidate;
          if (!String(ticket.canonicalRequesterEmail || '').trim()) {
            ticket.canonicalRequesterEmail = contactEmailCandidate;
          }
        }
        if (contactNameCandidate || contactEmailCandidate) {
          console.log(
            `[PrepareContext] Resolved Autotask contact ${autotaskContactId}: ${contactNameCandidate || 'unknown'}${contactEmailCandidate ? ` <${contactEmailCandidate}>` : ''}`
          );
        }
      } catch (error) {
        console.warn(
          `[PrepareContext] Could not resolve Autotask contact ${autotaskContactId}: ${(error as Error).message}`
        );
      }
    }
    if (Number.isFinite(autotaskAssignedResourceId)) {
      try {
        const resource = await autotaskClient.getResource(autotaskAssignedResourceId);
        const resourceNameCandidate = firstMeaningful(
          resource.fullName,
          resource.displayName,
          resource.name,
          joinName(resource.firstName, resource.lastName)
        );
        const resourceEmailCandidate = firstMeaningful(
          resource.email,
          resource.emailAddress,
          resource.userName
        ).toLowerCase();
        if (resourceNameCandidate) autotaskAssignedResourceNameResolved = resourceNameCandidate;
        if (resourceEmailCandidate) autotaskAssignedResourceEmailResolved = resourceEmailCandidate;
        if (resourceNameCandidate || resourceEmailCandidate) {
          console.log(
            `[PrepareContext] Resolved Autotask resource ${autotaskAssignedResourceId}: ${resourceNameCandidate || 'unknown'}${resourceEmailCandidate ? ` <${resourceEmailCandidate}>` : ''}`
          );
        }
      } catch (error) {
        console.warn(
          `[PrepareContext] Could not resolve Autotask resource ${autotaskAssignedResourceId}: ${(error as Error).message}`
        );
      }
    }
    const originalTicketTitle = String(ticket.title || '').trim();
    const originalTicketDescription = String((ticket as any)?.description || '').trim();
    const originalTicketNarrative = buildTicketNarrative(ticket);
    const autotaskAuthoritativeSeed = (() => {
      const raw = ticket as Record<string, unknown>;
      const numericId = Number(raw.id);
      const companyId = Number(raw.companyID);
      const contactId = Number(raw.contactID);
      const queueId = Number(raw.queueID);
      const assignedResourceId = Number(raw.assignedResourceID);
      const ticketNumber = String(raw.ticketNumber || '').trim();
      const companyName = String((ticket as any)?.company || '').trim();
      const queueName = String((ticket as any)?.queueName || '').trim();
      const contactName = String(autotaskContactNameResolved || '').trim();
      const contactEmail = String(autotaskContactEmailResolved || '').trim().toLowerCase();
      const assignedResourceName = String(autotaskAssignedResourceNameResolved || '').trim();
      const assignedResourceEmail = String(autotaskAssignedResourceEmailResolved || '').trim().toLowerCase();
      const hasAutotaskAuthority =
        Number.isFinite(numericId) ||
        !!ticketNumber ||
        Number.isFinite(companyId) ||
        !!companyName ||
        Number.isFinite(contactId) ||
        !!contactName ||
        !!contactEmail ||
        Number.isFinite(queueId) ||
        !!queueName ||
        Number.isFinite(assignedResourceId);
      if (!hasAutotaskAuthority) return null;
      return {
        source: 'autotask' as const,
        ...(Number.isFinite(numericId) ? { ticket_id_numeric: numericId } : {}),
        ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
        ...(originalTicketTitle ? { title: originalTicketTitle } : {}),
        ...(originalTicketDescription ? { description: originalTicketDescription } : {}),
        ...(Number.isFinite(companyId) ? { company_id: companyId } : {}),
        ...(companyName ? { company_name: companyName } : {}),
        ...(Number.isFinite(contactId) ? { contact_id: contactId } : {}),
        ...(contactName ? { contact_name: contactName } : {}),
        ...(contactEmail ? { contact_email: contactEmail } : {}),
        ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
        ...(queueName ? { queue_name: queueName } : {}),
        ...(Number.isFinite(assignedResourceId) ? { assigned_resource_id: assignedResourceId } : {}),
        ...(assignedResourceName ? { assigned_resource_name: assignedResourceName } : {}),
        ...(assignedResourceEmail ? { assigned_resource_email: assignedResourceEmail } : {}),
      };
    })();
    const normalizedTicket = await this.normalizeTicketForPipeline(ticket).catch(() => null);
    if (normalizedTicket) {
      await persistTicketTextArtifact(input.ticketId, input.sessionId, {
        ticket_id: input.ticketId,
        session_id: input.sessionId,
        source: intakeSource,
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

    const ticketNarrative = buildTicketNarrative(ticket);
    const inferredCompany = inferCompanyNameFromTicketText(ticketNarrative) || inferCompanyNameFromTicketText(originalTicketNarrative);
    const companyName = selectPreferredCompanyName({
      intakeCompany: String(ticket.company || ''),
      inferredCompany,
    });
    const requesterName = normalizeName(ticket.canonicalRequesterName || ticket.requester || '');
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

      const itglueFetcher = new ITGlueFetcher();
      const itglueResult = await itglueFetcher.fetch({
        sessionId: input.sessionId,
        ticketId: input.ticketId || '',
        tenantId: tenantId || '',
        orgNameHint: orgSeed,
        ticketText: ticketNarrative,
        ...(input.organizationIds && { organizationIds: input.organizationIds }),
      });

      const raw = itglueResult.raw || {};
      itglueOrgMatch = raw.itglueOrgMatch as any || null;
      itglueScopeOrgs = raw.itglueScopes as any[] || [];
      itglueConfigs = raw.itglueConfigs as any[] || [];
      itglueContacts = raw.itglueContacts as any[] || [];
      itgluePasswords = raw.itgluePasswords as any[] || [];
      itglueAssets = raw.itglueAssets as any[] || [];
      itglueLocations = raw.itglueLocations as any[] || [];
      itglueDomains = raw.itglueDomains as any[] || [];
      itglueSslCertificates = raw.itglueSslCertificates as any[] || [];
      itglueDocumentsRaw = raw.itglueDocumentsRaw as any[] || [];

      const runbooks = raw.itglueRunbooks as any[] || [];
      const runbooksEndpointUnavailable = !runbooks.length;

      itglueDocumentAttachmentsById = {};
      itglueDocumentRelatedItemsById = {};


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
            itgAttr(attrs, 'name') ||
            itgAttr(attrs, 'cached_resource_name') ||
            `IT Glue Document ${idx + 1}`
          );
          const snippet = String(itgAttr(attrs, 'content') || '').replace(/\s+/g, ' ').trim().slice(0, 500);
          const orgId = String(itgAttr(attrs, 'organization_id') || itglueOrgMatch?.id || '');
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

    const iterativeEnrichment = buildIterativeEnrichmentProfile({
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
      enrichmentEngine: this.enrichmentEngine,
    });
    let sections = iterativeEnrichment.sections;

    const fusionResult = await this.fusionEngine.runCrossSourceFusion({
      sections,
      ticket: ticket,
      ticketNarrative,
      normalizedTicket: normalizedTicket,
      itglueContacts: itglueContacts,
      itglueConfigs,
      itgluePasswords,
      itglueAssets,
      itglueEnriched: itglueEnriched,
      ninjaSoftwareInventory: ninjaSoftwareInventory,
      ninjaEnriched: ninjaEnriched,
      device: device,
      deviceDetails: deviceDetails,
      loggedInUser: loggedInUser || '',
      loggedInAt: loggedInAt || '',
    }, this.getFusionSupportedPaths());

    let fusionAudit: Record<string, unknown> | undefined;
    let fusionSummaryForAppendix: TicketContextAppendix['fusion_summary'] | undefined;
    if (fusionResult) {
      sections = fusionResult.sections;
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
      const fusedRecords = flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = computeEnrichmentCoverage(fusedRecords);
      iterativeEnrichment.rounds = buildEnrichmentRounds(fusedRecords, sourceFindings);
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
        normalizeName(String(iterativeEnrichment.sections.ticket.company.value || '')) || companyName || '';
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

      const currentRecords = flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.rounds = buildEnrichmentRounds(currentRecords, sourceFindings);
      iterativeEnrichment.completed_rounds = iterativeEnrichment.rounds.at(-1)?.round ?? iterativeEnrichment.completed_rounds;

      const calibration = this.applyHistoryConfidenceCalibration({
        sections: iterativeEnrichment.sections,
        relatedCases: scopedRelatedCases,
      });
      iterativeEnrichment.sections = calibration.sections;
      historyCalibrationAppendix = calibration.appendix;
      const calibratedRecords = flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = computeEnrichmentCoverage(calibratedRecords);
      iterativeEnrichment.rounds = buildEnrichmentRounds(calibratedRecords, sourceFindings);
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
      const finalRecords = flattenEnrichmentFields(iterativeEnrichment.sections);
      iterativeEnrichment.coverage = computeEnrichmentCoverage(finalRecords);
      iterativeEnrichment.rounds = buildEnrichmentRounds(finalRecords, sourceFindings);
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
        autotaskAuthoritativeSeed,
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
    const normalizedLastSeen = device?.id
      ? await this.enrichmentEngine.normalizeTimeValue(device.lastActivityTime || device.lastContact || deviceDetails?.lastContact)
      : '';

    const evidencePack = new EvidenceBuilder(input.sessionId)
      .setCoreDetails({
        tenantId,
        sourceWorkspace,
        intakeContext: {
          organization_hint: normalizedTicket?.organizationHint,
          device_hints: normalizedTicket?.deviceHints,
          symptoms: normalizedTicket?.symptoms,
          technology_facets: normalizedTicket?.technologyFacets,
        },
      })
      .setTicket(ticket, ssot)
      .setOrg(resolvedOrgId, ssot, companyName, itglueOrgMatch, ninjaOrgMatch)
      .setUser(entityResolution, ssot)
      .setContextArrays({
        signals: scopedSignals,
        relatedCases: scopedRelatedCases,
        externalStatus,
        docs: scopedDocs,
        sourceFindings,
      })
      .setEnrichmentData({
        networkStack,
        entityResolution,
        evidenceDigest,
        rejectedEvidence,
        capabilityVerification,
        iterativeEnrichment,
        missingData,
      })
      .setDeviceFromNinja(
        device,
        deviceDetails,
        capabilityVerification,
        normalizedLastSeen || '',
        this.resolveDeviceOsLabel.bind(this)
      )
      .build();

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
    const entityCandidates = extractEmailDomains(ticketText).concat(
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
    const requesterTokens = buildRequesterTokens(input.requesterName);
    const actorEmails = extractEmails(input.ticketText);
    const actorTokens = [...new Set([...requesterTokens, ...buildRequesterTokens(input.ticketText)])];
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
        ? `${capitalize(firstNameLabel)} ${capitalize(lastNameLabel)}`
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

    const normalizedRequester = normalizeName(input.requesterName).toLowerCase();
    const normalizedCompany = normalizeName(input.companyName).toLowerCase();
    const scoredCandidates = input.contacts
      .map((contact: any) => {
        const attrs = contact?.attributes || {};
        const name = normalizeName(
          String(
            itgAttr(attrs, 'name') ||
            `${String(itgAttr(attrs, 'first_name') || '')} ${String(itgAttr(attrs, 'last_name') || '')}` ||
            ''
          ).trim()
        );
        const email = String(itgAttr(attrs, 'primary_email') || '').toLowerCase();
        const phone = String(itgAttr(attrs, 'primary_phone') || '');
        const normalizedContactCompany = normalizeName(
          String(attrs.organization_name || attrs.company_name || attrs.organization || '')
        ).toLowerCase();
        const exactName = normalizedRequester && name.toLowerCase() === normalizedRequester ? 0.4 : 0;
        const emailScore = emailMatches.includes(email) && email ? 0.3 : 0;
        const phoneScore = phoneMatches.some((p) => phone.includes(p) || p.includes(phone)) && phone ? 0.2 : 0;
        const companyScore =
          normalizedCompany && normalizedContactCompany && fuzzyMatch(normalizedCompany, normalizedContactCompany)
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

    const fieldRecords = flattenEnrichmentFields(sections);
    const coverage = computeEnrichmentCoverage(fieldRecords);
    const rounds = buildEnrichmentRounds(fieldRecords, input.sourceFindings);
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
    const requesterFromTicket = normalizeName(
      input.ticket.canonicalRequesterName || input.ticket.requester || input.requesterName || ''
    );
    const requesterEmailFromTicket = String(
      input.ticket.canonicalRequesterEmail || extractFirstEmail(input.ticket.requester || '')
    ).trim();
    const extractedEmail = input.entityResolution.extracted_entities.email[0] || '';
    const requesterEmail = requesterEmailFromTicket || extractedEmail || '';

    const resolvedActor = input.entityResolution.resolved_actor;
    const affectedName = normalizeName(
      input.ticket.canonicalAffectedName || resolvedActor?.name || requesterFromTicket || 'unknown'
    );
    const affectedEmail = String(
      input.ticket.canonicalAffectedEmail || resolvedActor?.email || requesterEmail || 'unknown'
    ).trim();

    const companyFromTicket = normalizeName(input.ticket.company || '');
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
      ticket_id: buildField({
        value: ticketId || 'unknown',
        status: ticketId ? 'confirmed' : 'unknown',
        confidence: ticketId ? 1 : 0,
        sourceSystem: 'ticket',
        sourceRef: 'ticket.id',
        round: 1,
      }),
      company: buildField({
        value: companyValue,
        status: companyStatus,
        confidence: companyStatus === 'confirmed' ? 1 : companyStatus === 'inferred' ? 0.7 : 0,
        sourceSystem: companyFromTicket ? 'ticket' : companyValue !== 'unknown' ? 'ticket_narrative' : 'unknown',
        sourceRef: companyFromTicket ? 'ticket.company' : companyValue !== 'unknown' ? 'ticket.domain_inference' : undefined,
        round: 1,
      }),
      requester_name: buildField({
        value: requesterFromTicket || 'unknown',
        status: requesterFromTicket ? 'confirmed' : 'unknown',
        confidence: requesterFromTicket ? 0.95 : 0,
        sourceSystem: input.ticket.canonicalRequesterName ? 'entity_resolution' : requesterFromTicket ? 'ticket' : 'unknown',
        sourceRef: input.ticket.canonicalRequesterName ? 'round0.canonical_requester' : requesterFromTicket ? 'ticket.requester' : undefined,
        round: 1,
      }),
      requester_email: buildField({
        value: requesterEmail || 'unknown',
        status: requesterEmailFromTicket ? 'confirmed' : requesterEmail ? 'inferred' : 'unknown',
        confidence: requesterEmailFromTicket ? 0.95 : requesterEmail ? 0.65 : 0,
        sourceSystem: input.ticket.canonicalRequesterEmail ? 'entity_resolution' : requesterEmailFromTicket ? 'ticket' : requesterEmail ? 'entity_resolution' : 'unknown',
        sourceRef: input.ticket.canonicalRequesterEmail ? 'round0.canonical_requester' : requesterEmailFromTicket ? 'ticket.requester' : requesterEmail ? 'entity_resolution.extracted_entities.email[0]' : undefined,
        round: input.ticket.canonicalRequesterEmail ? 0 : requesterEmailFromTicket ? 1 : requesterEmail ? 2 : 1,
      }),
      affected_user_name: buildField({
        value: affectedName,
        status: actorStatus,
        confidence: actorStatus === 'confirmed' ? 0.95 : actorStatus === 'inferred' ? 0.65 : 0,
        sourceSystem: input.ticket.canonicalAffectedName ? 'entity_resolution' : resolvedActor ? 'entity_resolution' : requesterFromTicket ? 'ticket' : 'unknown',
        sourceRef: input.ticket.canonicalAffectedName ? 'round0.canonical_affected' : resolvedActor ? 'entity_resolution.resolved_actor.name' : requesterFromTicket ? 'ticket.requester' : undefined,
        round: input.ticket.canonicalAffectedName ? 0 : actorRound,
      }),
      affected_user_email: buildField({
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
      created_at: buildField({
        value: String(input.ticket.createDate || '').trim() || 'unknown',
        status: input.ticket.createDate ? 'confirmed' : 'unknown',
        confidence: input.ticket.createDate ? 0.95 : 0,
        sourceSystem: input.ticket.createDate ? 'ticket' : 'unknown',
        sourceRef: input.ticket.createDate ? 'ticket.createDate' : undefined,
        round: 1,
      }),
      title: buildField({
        value: String(input.ticket.title || '').trim() || 'unknown',
        status: input.ticket.title ? 'confirmed' : 'unknown',
        confidence: input.ticket.title ? 0.95 : 0,
        sourceSystem: input.ticket.title ? 'ticket' : 'unknown',
        sourceRef: input.ticket.title ? 'ticket.title' : undefined,
        round: 1,
      }),
      description_clean: buildField({
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
      user_principal_name: buildField({
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
      account_status: buildField({
        value: 'unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      mfa_state: buildField({
        value: 'unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      licenses_summary: buildField({
        value: 'Unknown',
        status: 'unknown',
        confidence: 0,
        sourceSystem: 'directory',
        sourceRef: 'unavailable',
        round: 2,
      }),
      groups_top: buildField({
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
    const deviceType = this.enrichmentEngine.inferDeviceType({
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
    const lastCheckIn = this.enrichmentEngine.normalizeTimeValue(
      input.device?.lastActivityTime ||
      input.device?.lastContact ||
      input.deviceDetails?.lastContact ||
      input.deviceDetails?.lastUpdate ||
      ''
    );
    const securityAgent = this.enrichmentEngine.inferSecurityAgent(input.ninjaChecks, input.deviceDetails);

    return {
      device_name: buildField({
        value: deviceName || 'unknown',
        status: deviceName ? 'confirmed' : 'unknown',
        confidence: deviceName ? 0.85 : 0,
        sourceSystem: deviceName ? 'ninjaone' : 'unknown',
        sourceRef: deviceName ? 'ninja.device.hostname' : undefined,
        round: 1,
      }),
      device_type: buildField({
        value: deviceType,
        status: deviceType !== 'unknown' ? 'inferred' : 'unknown',
        confidence: deviceType !== 'unknown' ? 0.65 : 0,
        sourceSystem: deviceType !== 'unknown' ? 'ninjaone' : 'unknown',
        sourceRef: deviceType !== 'unknown' ? 'ninja.device.os/type_heuristic' : undefined,
        round: 1,
      }),
      os_name: buildField({
        value: osName || 'unknown',
        status: osName ? 'confirmed' : 'unknown',
        confidence: osName ? 0.8 : 0,
        sourceSystem: osName ? 'ninjaone' : 'unknown',
        sourceRef: osName ? 'ninja.device.osName/os.name' : undefined,
        round: 1,
      }),
      os_version: buildField({
        value: osVersion || 'unknown',
        status: osVersion ? 'confirmed' : 'unknown',
        confidence: osVersion ? 0.75 : 0,
        sourceSystem: osVersion ? 'ninjaone' : 'unknown',
        sourceRef: osVersion ? 'ninja.device.osVersion/os.buildNumber+releaseId' : undefined,
        round: 1,
      }),
      last_check_in: buildField({
        value: lastCheckIn || 'unknown',
        status: lastCheckIn ? 'confirmed' : 'unknown',
        confidence: lastCheckIn ? 0.85 : 0,
        sourceSystem: lastCheckIn ? 'ninjaone' : 'unknown',
        sourceRef: lastCheckIn ? 'ninja.device.lastActivityTime' : undefined,
        round: 1,
      }),
      security_agent: buildField({
        value: securityAgent,
        status: securityAgent.state === 'unknown' ? 'unknown' : 'inferred',
        confidence: securityAgent.state === 'present' ? 0.7 : securityAgent.state === 'absent' ? 0.45 : 0,
        sourceSystem: securityAgent.state === 'unknown' ? 'unknown' : 'ninjaone',
        sourceRef: securityAgent.state === 'unknown' ? undefined : 'ninja.device.checks',
        round: 1,
      }),
      user_signed_in: buildField({
        value: input.loggedInUser || 'unknown',
        status: input.loggedInUser ? 'inferred' : 'unknown',
        confidence: input.loggedInUser ? 0.7 : 0,
        sourceSystem: input.loggedInUser ? 'ninjaone' : 'unknown',
        sourceRef: input.loggedInUser ? 'ninja.device.last-logged-on-user' : undefined,
        round: input.loggedInUser ? 3 : 1,
      }),
      user_signed_in_at: buildField({
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
    const narrativeLocationContext = this.enrichmentEngine.inferLocationContext(input.ticketNarrative);
    const locationContext = narrativeLocationContext !== 'unknown'
      ? narrativeLocationContext
      : wanCandidate?.location_hint
        ? 'office'
        : 'unknown';
    const publicIp = this.enrichmentEngine.resolvePublicIp(input.device, input.deviceDetails);
    const itglueLlmIsp = this.pickEnrichedValue(input.itglueEnriched, 'isp_name');
    const ispName = itglueLlmIsp || wanCandidate?.isp_name || this.inferIspName({
      ticketNarrative: input.ticketNarrative,
      docs: input.docs,
      itglueConfigs: input.itglueConfigs,
    });
    const vpnState = this.enrichmentEngine.inferVpnState(input.ninjaChecks, input.ticketNarrative);
    const phoneProviderConnected = Boolean(input.inferredPhoneProvider);

    return {
      location_context: buildField({
        value: locationContext,
        status: locationContext === 'unknown' ? 'unknown' : 'inferred',
        confidence: locationContext === 'unknown' ? 0 : narrativeLocationContext !== 'unknown' ? 0.65 : 0.75,
        sourceSystem: locationContext === 'unknown' ? 'unknown' : narrativeLocationContext !== 'unknown' ? 'ticket_narrative' : 'itglue',
        sourceRef: locationContext === 'unknown' ? undefined : narrativeLocationContext !== 'unknown' ? 'ticket.text' : wanCandidate?.source_ref,
        round: narrativeLocationContext !== 'unknown' ? 1 : 2,
      }),
      public_ip: buildField({
        value: publicIp || 'unknown',
        status: publicIp ? 'confirmed' : 'unknown',
        confidence: publicIp ? 0.9 : 0,
        sourceSystem: publicIp ? 'ninjaone' : 'unknown',
        sourceRef: publicIp ? 'ninja.device.publicIP/ipAddresses' : undefined,
        round: 1,
      }),
      isp_name: buildField({
        value: ispName || 'unknown',
        status: ispName ? 'inferred' : 'unknown',
        confidence: itglueLlmIsp ? 0.75 : wanCandidate?.isp_name ? Math.max(0.65, wanCandidate.confidence) : ispName ? 0.6 : 0,
        sourceSystem: itglueLlmIsp ? 'itglue_llm' : wanCandidate?.isp_name ? 'itglue' : ispName ? 'cross_correlation' : 'unknown',
        sourceRef: itglueLlmIsp ? 'itglue_org_snapshot' : wanCandidate?.isp_name ? wanCandidate.source_ref : ispName ? 'ticket/docs/itglue keyword' : undefined,
        round: ispName ? 2 : 1,
      }),
      vpn_state: buildField({
        value: vpnState,
        status: vpnState === 'unknown' ? 'unknown' : 'inferred',
        confidence: vpnState === 'connected' ? 0.7 : vpnState === 'disconnected' ? 0.6 : 0,
        sourceSystem: vpnState === 'unknown' ? 'unknown' : 'ninjaone',
        sourceRef: vpnState === 'unknown' ? undefined : 'ninja.checks:vpn',
        round: 1,
      }),
      phone_provider: buildField({
        value: phoneProviderConnected ? 'connected' : 'unknown',
        status: phoneProviderConnected ? 'inferred' : 'unknown',
        confidence: phoneProviderConnected ? 0.7 : 0,
        sourceSystem: phoneProviderConnected ? 'provider_inference' : 'unknown',
        sourceRef: phoneProviderConnected ? 'ticket/docs/configs/signals' : undefined,
        round: 1,
      }),
      phone_provider_name: buildField({
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
      firewall_make_model: buildField({
        value: firewall.value,
        status: firewall.status,
        confidence: firewall.confidence,
        sourceSystem: firewall.sourceSystem,
        sourceRef: firewall.sourceRef,
        round: firewall.round,
      }),
      wifi_make_model: buildField({
        value: wifi.value,
        status: wifi.status,
        confidence: wifi.confidence,
        sourceSystem: wifi.sourceSystem,
        sourceRef: wifi.sourceRef,
        round: wifi.round,
      }),
      switch_make_model: buildField({
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

  private parseITGlueOrgParentId(org: any): string | null {
    const attrs = org?.attributes || {};
    const value = itgAttr(attrs, 'parent_id');
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private parseITGlueOrgAncestorIds(org: any): string[] {
    const attrs = org?.attributes || {};
    const raw = itgAttr(attrs, 'ancestor_ids');
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
      const name = String(itgAttr(attrs, 'name') || '').trim() || id;
      const shortName = String(itgAttr(attrs, 'short_name') || '').trim();
      const score = companyName ? scoreOrgNameMatch(companyName, name, shortName) : 0;
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
      const name = String(itgAttr(attrs, 'name') || id);
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
        name: itgAttr(c?.attributes || {}, 'name') || c?.name,
        manufacturer:
          itgAttr(c?.attributes || {}, 'manufacturer_name') ||
          itgAttr(c?.attributes || {}, 'manufacturer') ||
          c?.manufacturer,
        model:
          itgAttr(c?.attributes || {}, 'model_name') ||
          itgAttr(c?.attributes || {}, 'model') ||
          c?.model,
        type:
          itgAttr(c?.attributes || {}, 'configuration_type_name') ||
          itgAttr(c?.attributes || {}, 'type'),
      })),
      passwords: passwords.slice(0, 200).map((p: any) => ({
        id: p?.id,
        name: itgAttr(p?.attributes || {}, 'name') || p?.name,
        username:
          itgAttr(p?.attributes || {}, 'username') ||
          itgAttr(p?.attributes || {}, 'user_name') ||
          p?.username,
        resource:
          itgAttr(p?.attributes || {}, 'resource_name') ||
          itgAttr(p?.attributes || {}, 'resource') ||
          p?.resource,
        category:
          itgAttr(p?.attributes || {}, 'password_category_name') ||
          itgAttr(p?.attributes || {}, 'category') ||
          p?.category,
      })),
      contacts: contacts.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name:
          itgAttr(x?.attributes || {}, 'name') ||
          [
            itgAttr(x?.attributes || {}, 'first_name'),
            itgAttr(x?.attributes || {}, 'last_name'),
          ]
            .filter(Boolean)
            .join(' '),
        email: itgAttr(x?.attributes || {}, 'primary_email'),
        phone: itgAttr(x?.attributes || {}, 'primary_phone'),
        type: itgAttr(x?.attributes || {}, 'contact_type_name'),
      })),
      assets: assets.slice(0, 200).map((a: any) => ({
        id: a?.id,
        name: itgAttr(a?.attributes || {}, 'name') || a?.name,
        type:
          itgAttr(a?.attributes || {}, 'flexible_asset_type_name') ||
          itgAttr(a?.attributes || {}, 'type'),
        provider:
          itgAttr(a?.attributes || {}, 'provider') ||
          itgAttr(a?.attributes || {}, 'isp') ||
          itgAttr(a?.attributes || {}, 'carrier'),
        location:
          itgAttr(a?.attributes || {}, 'location') ||
          itgAttr(a?.attributes || {}, 'locations') ||
          itgAttr(a?.attributes || {}, 'site') ||
          itgAttr(a?.attributes || {}, 'address'),
      })),
      locations: locations.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: itgAttr(x?.attributes || {}, 'name') || x?.name,
        city: itgAttr(x?.attributes || {}, 'city'),
        state:
          itgAttr(x?.attributes || {}, 'region_name') ||
          itgAttr(x?.attributes || {}, 'state'),
        country:
          itgAttr(x?.attributes || {}, 'country_name') ||
          itgAttr(x?.attributes || {}, 'country'),
      })),
      domains: domains.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: itgAttr(x?.attributes || {}, 'name') || x?.name,
      })),
      ssl_certificates: sslCertificates.slice(0, 200).map((x: any) => ({
        id: x?.id,
        name: itgAttr(x?.attributes || {}, 'name') || x?.name,
        active: itgAttr(x?.attributes || {}, 'active'),
        issued_by: itgAttr(x?.attributes || {}, 'issued_by'),
      })),
      docs: docs.slice(0, 50).map((d: any) => ({
        id: d?.id,
        title: d?.title || d?.name,
      })),
      documents_raw: documentsRaw.slice(0, 100).map((d: any) => ({
        id: d?.id,
        name: itgAttr(d?.attributes || {}, 'name') || d?.name,
        type:
          itgAttr(d?.attributes || {}, 'document_type_name') ||
          itgAttr(d?.attributes || {}, 'document_type') ||
          d?.documentType,
        updated_at: itgAttr(d?.attributes || {}, 'updated_at') || d?.updatedAt,
      })),
      document_attachments_sample: Object.entries(documentAttachmentsById)
        .slice(0, 50)
        .map(([docId, items]: [string, any]) => ({
          document_id: docId,
          count: Array.isArray(items) ? items.length : 0,
          names: Array.isArray(items)
            ? items
              .slice(0, 5)
              .map((x: any) => itgAttr(x?.attributes || {}, 'name') || itgAttr(x?.attributes || {}, 'file_name') || x?.name)
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
              .map((x: any) => itgAttr(x?.attributes || {}, 'resource_type') || itgAttr(x?.attributes || {}, 'item_type') || 'unknown'))]
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
      const parsed = extractJsonObject(llm.content);
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
      const parsed = extractJsonObject(llm.content);
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
      autotaskAuthoritativeSeed?: TicketSSOT['autotask_authoritative'] | null;
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
    const authoritative = input.autotaskAuthoritativeSeed || null;
    const intakeCompanyRaw = String(ticket.company || '').trim();
    const inferredCompanyRaw = String(input.companyName || '').trim();
    const normalizeCompanyComparable = (value: string) =>
      normalizeName(normalizeName(String(value || '')));

    const currentCompanyRaw = String(out.company || '').trim();
    const canOverrideDomainDerivedIntakeWithCurrent =
      !isUnknown(currentCompanyRaw) && shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, currentCompanyRaw);
    const canOverrideDomainDerivedIntakeWithInferred =
      !isUnknown(inferredCompanyRaw) && shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, inferredCompanyRaw);

    if (authoritative) {
      out.autotask_authoritative = authoritative;
      if (authoritative.ticket_number) {
        out.ticket_id = String(authoritative.ticket_number);
      }
      if (authoritative.title) {
        out.title = String(authoritative.title);
      }
      // Preserve normalized description in `description_clean`, but ensure the raw manual value is retained in SSOT.
      // UI/API layers can prefer `autotask_authoritative.description` where they need the operator-entered text.
      if (!isUnknown(authoritative.company_name)) {
        out.company = String(authoritative.company_name).trim();
      }
      if (!isUnknown(authoritative.contact_name)) {
        out.requester_name = normalizeName(String(authoritative.contact_name || ''));
      }
      if (!isUnknown(authoritative.contact_email)) {
        out.requester_email = String(authoritative.contact_email || '').trim().toLowerCase();
      }
    }

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
      normalizeName(ticket.canonicalRequesterName || ''),
      normalizeName(normalized?.requesterName || ''),
      normalizeName(ticket.requester || '')
    );

    out.requester_email = pickBetter(
      out.requester_email,
      String(ticket.canonicalRequesterEmail || '').trim().toLowerCase(),
      String(normalized?.requesterEmail || '').trim().toLowerCase(),
      extractFirstEmail(ticket.requester || ''),
      extractFirstEmail(ticket.rawBody || ''),
      extractFirstEmail(ticket.description || '')
    );

    out.affected_user_name = pickBetter(
      out.affected_user_name,
      normalizeName(ticket.canonicalAffectedName || ''),
      normalizeName(normalized?.affectedUserName || '')
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
      const parsed = extractJsonObject(llm.content);
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

    for (const record of flattenEnrichmentFields(input.sections)) {
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
    const loggedUser = normalizeSimpleToken(input.loggedInUser || '');

    const requesterName = normalizeName(String(input.ticket.canonicalRequesterName || input.ticket.requester || ''));
    const affectedName = normalizeName(String(input.ticket.canonicalAffectedName || ''));
    const actorName = affectedName && affectedName.toLowerCase() !== 'unknown' ? affectedName : requesterName;
    const actorAliases = generateNameAliases(actorName);

    if (loggedUser && input.itglueContacts.length > 0) {
      let best: { contact: any; score: number; refs: string[]; note: string } | null = null;
      for (const contact of input.itglueContacts.slice(0, 200)) {
        const attrs = contact?.attributes || contact || {};
        const contactName = normalizeName(String(
          itgAttr(attrs, 'name') ||
          [itgAttr(attrs, 'first_name'), itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
        ));
        const email = String(itgAttr(attrs, 'primary_email') || '').toLowerCase().trim();
        const emailLocal = normalizeSimpleToken(email.split('@')[0] || '');
        const aliases = generateNameAliases(contactName);
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

    const ticketSoftwareMentions = extractSoftwareHintsFromTicket(input.ticketNarrative);
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
    return normalizeName(String(value || '')).toLowerCase();
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
    const name = normalizeName(String(
      itgAttr(attrs, 'name') ||
      [itgAttr(attrs, 'first_name'), itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
    ));
    const email = String(itgAttr(attrs, 'primary_email') || '').trim().toLowerCase();
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
      const current = getEnrichmentFieldByPath(next, resolution.path);
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
      const updated = buildField({
        value: normalized as any,
        status: nextStatus as any,
        confidence: nextConfidence,
        sourceSystem: resolution.resolution_mode === 'assembled' || resolution.resolution_mode === 'inferred'
          ? 'fusion_graph_llm'
          : 'fusion_direct_llm',
        sourceRef: sourceRef || undefined,
        round: 7,
      });
      setEnrichmentFieldByPath(next, resolution.path, updated);
      appliedCount += 1;
      appliedPaths.push(resolution.path);
    }

    return { sections: next, appliedCount, appliedPaths };
  }



  // ML & Extraction heuristics extracted to EnrichmentEngine

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

    const fields = flattenEnrichmentFields(input.sections);
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
        for (const alias of generateNameAliases(String(record.field.value || ''))) {
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

    for (const domain of extractEmails(`${input.ticketNarrative} ${input.normalizedTicket?.descriptionClean || ''}`)) {
      addPhrase(domain, 0.95, 'domain');
      addPhrase(domain.split('.')[0] || '', 0.8, 'domain_root');
    }
    for (const software of extractSoftwareHintsFromTicket(input.ticketNarrative)) {
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
    for (const record of flattenEnrichmentFields(input.sections)) {
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

      const keyword = pickHistoryKeyword(terms);
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
      const current = getEnrichmentFieldByPath(input.sections, path);
      if (!current) return;
      const nextUnknown = nextField.status === 'unknown' || Number(nextField.confidence || 0) <= 0;
      if (nextUnknown) return;
      const currentWeak =
        current.status === 'unknown' ||
        current.status === 'conflict' ||
        Number(current.confidence || 0) < 0.5;
      const improves = currentWeak || Number(nextField.confidence || 0) > Number(current.confidence || 0) + 0.05;
      if (!improves) return;
      setEnrichmentFieldByPath(input.sections, path, nextField);
      updatedPaths.push(path);
    };

    const firewall = this.extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
    patchIfBetter('infra.firewall_make_model', buildField({
      value: firewall.value,
      status: firewall.status,
      confidence: firewall.confidence,
      sourceSystem: firewall.sourceSystem,
      sourceRef: firewall.sourceRef,
      round: 9,
    }));
    const wifi = this.extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
    patchIfBetter('infra.wifi_make_model', buildField({
      value: wifi.value,
      status: wifi.status,
      confidence: wifi.confidence,
      sourceSystem: wifi.sourceSystem,
      sourceRef: wifi.sourceRef,
      round: 9,
    }));
    const sw = this.extractInfraMakeModel('switch', input.itglueConfigs, input.docs);
    patchIfBetter('infra.switch_make_model', buildField({
      value: sw.value,
      status: sw.status,
      confidence: sw.confidence,
      sourceSystem: sw.sourceSystem,
      sourceRef: sw.sourceRef,
      round: 9,
    }));

    const isp = this.inferIspName({ ticketNarrative: input.ticketNarrative, docs: input.docs, itglueConfigs: input.itglueConfigs });
    if (isp) {
      patchIfBetter('network.isp_name', buildField({
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
      patchIfBetter('network.phone_provider', buildField({
        value: 'connected',
        status: 'inferred',
        confidence: 0.73,
        sourceSystem: 'final_refinement',
        sourceRef: 'ticket+itglue+ninja signals round9',
        round: 9,
      }));
      patchIfBetter('network.phone_provider_name', buildField({
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

    patchIfBetter('network.vpn_state', buildField({
      value: this.enrichmentEngine.inferVpnState(input.signals, input.ticketNarrative),
      status: this.enrichmentEngine.inferVpnState(input.signals, input.ticketNarrative) === 'unknown' ? 'unknown' : 'inferred',
      confidence: this.enrichmentEngine.inferVpnState(input.signals, input.ticketNarrative) === 'unknown' ? 0 : 0.68,
      sourceSystem: 'final_refinement',
      sourceRef: 'ninja signals round9',
      round: 9,
    }));
    const publicIp = this.enrichmentEngine.resolvePublicIp(input.device, input.deviceDetails);
    if (publicIp) {
      patchIfBetter('network.public_ip', buildField({
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
    const fields = flattenEnrichmentFields(next);
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
      const adjustedField = buildField({
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
      setEnrichmentFieldByPath(next, record.path, adjustedField);
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
      for (const alias of generateNameAliases(currentValue)) {
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

  private async resolveNinjaOrg(
    ninjaoneClient: NinjaOneClient,
    companyName: string
  ): Promise<{ id: number; name: string } | null> {
    return resolveNinjaOrgHelper(ninjaoneClient, companyName);
  }

  private extractLoggedInUser(deviceDetails: any): string | null {
    return extractLoggedInUserHelper(deviceDetails);
  }

  private extractITGlueWanCandidate(input: {
    ticketNarrative: string;
    itglueAssets: any[];
    itglueConfigs: any[];
    docs: Doc[];
  }): ITGlueWanCandidate | null {
    return extractITGlueWanCandidateHelper(input);
  }

  private inferIspName(input: {
    ticketNarrative: string;
    docs: Doc[];
    itglueConfigs: any[];
  }): string {
    return inferIspNameHelper(input);
  }

  private extractITGlueInfraCandidates(input: {
    itgluePasswords: any[];
    itglueConfigs: any[];
    itglueAssets: any[];
    docs: Doc[];
  }) {
    return extractITGlueInfraCandidatesHelper(input);
  }

  private extractInfraMakeModel(
    kind: 'firewall' | 'wifi' | 'switch',
    configs: any[],
    docs: Doc[]
  ) {
    return extractInfraMakeModelHelper(kind, configs, docs);
  }

  private parseMakeModel(value: string): { vendor: string; model: string } | null {
    const normalized = normalizeName(String(value || ''));
    if (!normalized || normalized.toLowerCase() === 'unknown') return null;
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    return {
      vendor: parts[0] || normalized,
      model: parts.slice(1).join(' '),
    };
  }

  private rankITGlueDocsForTicket(ticketNarrative: string, docs: Doc[]): Doc[] {
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

  private normalizeFusionResolutionValue(path: string, value: unknown): string {
    if (value === null || value === undefined) return 'unknown';
    const raw = typeof value === 'string' ? value : String(value);
    const trimmed = normalizeName(raw).trim();
    if (!trimmed) return 'unknown';

    const lowered = trimmed.toLowerCase();
    if (this.isFusionUnknownValue(lowered)) return 'unknown';
    if (path.includes('email') || path.includes('principal_name')) return lowered;
    if (['identity.account_status', 'identity.mfa_state', 'endpoint.device_type', 'network.vpn_state', 'network.location_context'].includes(path)) {
      return lowered;
    }
    return trimmed;
  }

  private isFusionUnknownValue(value: unknown): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '' || ['unknown', 'n/a', 'na', 'none', 'null', 'undefined'].includes(normalized);
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
      const strictFormat = await this.formatDisplayMarkdownVerbatimWithLLM(canonicalDisplayText).catch(() => '');
      if (this.isDisplayMarkdownVerbatimEnough(canonicalDisplayText, strictFormat)) {
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

  private isDisplayMarkdownVerbatimEnough(sourceText: string, markdownText: string): boolean {
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

  private async resolveLastLoggedInContext(
    ninjaoneClient: NinjaOneClient,
    deviceId: string
  ): Promise<{ userName: string; logonTime: string }> {
    const direct = await ninjaoneClient.getDeviceLastLoggedOnUser(deviceId).catch(() => null);
    const directUser = String(direct?.userName || '').trim();
    const directTime = this.enrichmentEngine.normalizeTimeValue(direct?.logonTime || '');
    if (directUser) return { userName: directUser, logonTime: directTime };

    const report = await ninjaoneClient.listLastLoggedOnUsers({ pageSize: 1000 }).catch(() => null);
    const rows = Array.isArray(report?.results) ? report.results : [];
    const match = rows.find((row) => String(row.deviceId) === String(deviceId));
    const reportUser = String(match?.userName || '').trim();
    const reportTime = this.enrichmentEngine.normalizeTimeValue(match?.logonTime || '');
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
      if (iface.ipAddress && this.enrichmentEngine.isPublicIPv4(iface.ipAddress)) {
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
