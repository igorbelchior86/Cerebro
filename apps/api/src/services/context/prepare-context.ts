// ─────────────────────────────────────────────────────────────
// PrepareContext Service — Orquestra coleta de dados
// ─────────────────────────────────────────────────────────────

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
  IterativeEnrichmentProfile,
  IterativeEnrichmentSections,
} from '@cerebro/types';
import type { NinjaOneClient } from '../../clients/ninjaone.js';
import type { ITGlueClient } from '../../clients/itglue.js';
import { webSearch } from '../ai/web-search.js';
import { callLLM } from '../ai/llm-adapter.js';
import { operationalLogger } from '../../lib/operational-logger.js';

import { AutotaskFetcher } from '../read-models/data-fetchers/autotask-fetcher.js';
import { ITGlueFetcher } from '../read-models/data-fetchers/itglue-fetcher.js';
import { EvidenceBuilder } from '../domain/evidence-builder.js';
import { EnrichmentEngine } from '../ai/enrichment-engine.js';
import { FusionEngine } from '../orchestration/fusion-engine.js';

import {
  persistTicketTextArtifact,
  persistTicketSSOT,
  persistTicketContextAppendix,
  persistItglueOrgSnapshot,
  persistNinjaOrgSnapshot,
} from './persistence.js';

import {
  resolveClientsForSession,
  checkHasCompanyColumn,
} from './client-resolver.js';

import {
  hashSnapshot,
  hashSnapshotWithVersion,
  buildItglueExtractionInput,
  buildNinjaExtractionInput,
  getOrRefreshItglueEnriched,
  getOrRefreshNinjaEnriched,
} from './enrichment-cache.js';

import {
  buildTicketSSOT,
  applyIntakeAntiRegressionToSSOT,
} from './ssot-builder.js';

import {
  getFusionSupportedPaths,
  buildFusionFieldCandidates,
  buildFusionLinksAndInferences,
  buildFusionAdjudicationPrompt,
  sanitizeFusionAdjudicationOutput,
  validateFusionLlmResolutions,
  normalizeFusionCandidateValueForCompare,
  buildDeterministicFusionFallbackResolutions,
  applyFusionResolutionsToSections,
  buildFacetActions,
  resolveEvidenceRefsByKind,
} from './fusion-methods.js';

import {
  findRelatedCases,
  buildBroadHistorySearchPlan,
  buildFinalRefinementPlan,
  shouldRunFinalNinjaRefinement,
  findRelatedCasesBroad,
  findRelatedCasesByTerms,
  normalizeHistoryTerms,
  scoreHistoryCandidate,
  applyFinalRefinementToEnrichment,
  applyHistoryConfidenceCalibration,

} from './history-resolver.js';

import {
  resolveNinjaOrg,
  extractLoggedInUser,
  extractITGlueWanCandidate,
  inferIspName,
  extractITGlueInfraCandidates,
  extractInfraMakeModel,
  parseMakeModel,
  rankITGlueDocsForTicket,
  normalizeFusionResolutionValue,
  isFusionUnknownValue,
  normalizeTicketForPipeline,
  formatDisplayMarkdownVerbatimWithLLM,
  isDisplayMarkdownVerbatimEnough,
  inferPhoneProvider,
  resolveLastLoggedInContext,
  resolveDeviceOsLabel,
  buildNinjaContextSignals,
} from './ticket-normalizer.js';

import {
  itgAttr,
  normalizeName,
  buildField,
  buildIterativeEnrichmentProfile,
  flattenEnrichmentFields,
  computeEnrichmentCoverage,
  buildEnrichmentRounds,
  mapAutotaskPriority,
  selectPreferredCompanyName,
  extractEmailDomains,
  extractEmails,
  extractFirstEmail,
  inferCompanyNameFromTicketText,
  buildTicketNarrative,
  normalizeTicketDeterministically,
  postProcessCanonicalTicketText,
  extractJsonObject,
  buildRequesterTokens,
  scoreOrgNameMatch,
  fuzzyMatch,
  capitalize,
  pickEnrichedValue,
} from './prepare-context-helpers.js';

import type {
  PrepareContextInput,
  TicketLike,
  TicketSSOT,
  TicketContextAppendix,
  ScopeMeta,
  ITGlueWanCandidate,
  ITGlueInfraCandidate,
  FacetContext,
  DeviceResolutionResult,
  ItglueEnrichedPayload,
  NinjaEnrichedPayload,
  FusionLink,
  FusionInference,
  FusionFieldCandidate,
  FusionFieldResolution,
  FusionAdjudicationOutput} from './prepare-context.types.js';
import {
} from './prepare-context.types.js';

const ITGLUE_ROUND2_REQUEST_BUDGET = 120;
const NINJA_EXTRACTOR_VERSION = 'v1-summary-2026-02-23';
const ITGLUE_MAX_SCOPE_ORGS = 4;
type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function asJsonRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null)
    : [];
}

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
      normalizeName: (n: string) => normalizeName(n),
      itgAttr: (a: JsonRecord, k: string) => itgAttr(a, k),
      buildField: (input: Parameters<typeof buildField>[0]) => buildField(input),
      isPublicIPv4: (ip: string) => this.enrichmentEngine.isPublicIPv4(ip)
    });
  }

  private _companyColumnCache: { value: boolean | null } = { value: null };

  private async resolveClientsForSession(sessionId: string) {
    return resolveClientsForSession(sessionId);
  }

  private async hasCompanyColumn(): Promise<boolean> {
    return checkHasCompanyColumn(this._companyColumnCache);
  }

  /**
   * Principal: Coleta dados de múltiplas fontes e monta EvidencePack
   */
  async prepare(input: PrepareContextInput): Promise<EvidencePack> {
    operationalLogger.info('context.prepare_context.started', {
      module: 'services.context.prepare-context',
      ticket_id: input.ticketId,
    }, {
      ticket_id: input.ticketId,
    });

    const startTime = Date.now();
    const missingData: Array<{ field: string; why: string }> = [];

    // Temporarily restoring for legacy logic below
    const { autotaskClient, ninjaoneClient, itglueClient, credentialScope, tenantId } =
      await this.resolveClientsForSession(input.sessionId);

    const sourceWorkspace = tenantId ? `tenant:${tenantId}` : 'workspace:latest';
    const phaseDurationsMs: Record<string, number> = {};
    const markPhaseDuration = (phase: string, phaseStartedAt: number) => {
      const durationMs = Date.now() - phaseStartedAt;
      phaseDurationsMs[phase] = durationMs;
      operationalLogger.info('context.prepare_context.phase_completed', {
        module: 'services.context.prepare-context',
        ticket_id: input.ticketId,
        phase,
        duration_ms: durationMs,
      }, {
        tenant_id: tenantId ?? null,
        ticket_id: input.ticketId,
      });
    };

    const autotaskFetcher = new AutotaskFetcher();
    const intakePhaseStartedAt = Date.now();

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
      operationalLogger.info('context.prepare_context.autotask_t_format_lookup_started', {
        module: 'services.context.prepare-context',
        ticket_id: input.ticketId,
      }, {
        tenant_id: tenantId ?? null,
        ticket_id: input.ticketId,
      });
      try {
        const autotaskTicket = await autotaskClient.getTicketByTicketNumber(input.ticketId);
        ticket = autotaskTicket;
        intakeSource = 'autotask';
        operationalLogger.info('context.prepare_context.autotask_t_format_lookup_resolved', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });

        const ticketIdNum = Number(autotaskTicket.id);
        if (!Number.isNaN(ticketIdNum)) {
          const notes = await autotaskClient.getTicketNotes(ticketIdNum);
          signals = notes.map((note: JsonRecord, idx: number) => ({
            id: `autotask-note-${idx}`,
            source: 'autotask' as const,
            timestamp: String(note.createDate || ''),
            type: 'ticket_note',
            summary: String(note.noteText || '').substring(0, 200),
            raw_ref: note,
            tenant_id: tenantId,
            org_id: input.orgId || null,
            source_workspace: sourceWorkspace,
          }));
        }
      } catch (autotaskErr) {
        operationalLogger.warn('context.prepare_context.autotask_t_format_lookup_failed', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
          signal: 'integration_failure',
          degraded_mode: true,
          error_message: (autotaskErr as Error).message,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });
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
        operationalLogger.info('context.prepare_context.autotask_numeric_lookup_resolved', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });

        // Coleta notas (signals)
        const notes = await autotaskClient.getTicketNotes(ticketIdNum);
        signals = notes.map((note: JsonRecord, idx: number) => ({
          id: `autotask-note-${idx}`,
          source: 'autotask' as const,
          timestamp: String(note.createDate || ''),
          type: 'ticket_note',
          summary: String(note.noteText || '').substring(0, 200),
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
    const rawTicket = ticket as JsonRecord;
    if ((String(rawTicket.company || '').trim() === '' || String(rawTicket.company || '').trim().toLowerCase() === 'unknown')
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
          operationalLogger.info('context.prepare_context.autotask_company_resolved', {
            module: 'services.context.prepare-context',
            ticket_id: input.ticketId,
            autotask_company_id: autotaskCompanyId,
            company_name: companyNameCandidate,
          }, {
            tenant_id: tenantId ?? null,
            ticket_id: input.ticketId,
          });
        }
      } catch (error) {
        operationalLogger.warn('context.prepare_context.autotask_company_resolve_failed', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
          autotask_company_id: autotaskCompanyId,
          signal: 'integration_failure',
          degraded_mode: true,
          error_message: (error as Error).message,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });
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
          operationalLogger.info('context.prepare_context.autotask_contact_resolved', {
            module: 'services.context.prepare-context',
            ticket_id: input.ticketId,
            autotask_contact_id: autotaskContactId,
            contact_name: contactNameCandidate || 'unknown',
            contact_email: contactEmailCandidate || null,
          }, {
            tenant_id: tenantId ?? null,
            ticket_id: input.ticketId,
          });
        }
      } catch (error) {
        operationalLogger.warn('context.prepare_context.autotask_contact_resolve_failed', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
          autotask_contact_id: autotaskContactId,
          signal: 'integration_failure',
          degraded_mode: true,
          error_message: (error as Error).message,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });
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
          operationalLogger.info('context.prepare_context.autotask_resource_resolved', {
            module: 'services.context.prepare-context',
            ticket_id: input.ticketId,
            autotask_resource_id: autotaskAssignedResourceId,
            resource_name: resourceNameCandidate || 'unknown',
            resource_email: resourceEmailCandidate || null,
          }, {
            tenant_id: tenantId ?? null,
            ticket_id: input.ticketId,
          });
        }
      } catch (error) {
        operationalLogger.warn('context.prepare_context.autotask_resource_resolve_failed', {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
          autotask_resource_id: autotaskAssignedResourceId,
          signal: 'integration_failure',
          degraded_mode: true,
          error_message: (error as Error).message,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });
      }
    }
    const originalTicketTitle = String(ticket.title || '').trim();
    const originalTicketDescription = String(rawTicket.description || '').trim();
    const originalTicketNarrative = buildTicketNarrative(ticket);
    const autotaskAuthoritativeSeed = (() => {
      const raw = ticket as Record<string, unknown>;
      const numericId = Number(raw.id);
      const companyId = Number(raw.companyID);
      const contactId = Number(raw.contactID);
      const queueId = Number(raw.queueID);
      const assignedResourceId = Number(raw.assignedResourceID);
      const secondaryResourceId = Number(raw.secondaryResourceID);
      const priorityId = Number(raw.priority);
      const issueTypeId = Number(raw.issueType);
      const subIssueTypeId = Number(raw.subIssueType);
      const serviceLevelAgreementId = Number(raw.serviceLevelAgreementID);
      const ticketNumber = String(raw.ticketNumber || '').trim();
      const companyName = String(rawTicket.company || '').trim();
      const queueName = String(rawTicket.queueName || '').trim();
      const statusValue = String(raw.status ?? '').trim();
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
        Number.isFinite(assignedResourceId) ||
        Number.isFinite(secondaryResourceId) ||
        !!statusValue ||
        Number.isFinite(priorityId) ||
        Number.isFinite(issueTypeId) ||
        Number.isFinite(subIssueTypeId) ||
        Number.isFinite(serviceLevelAgreementId);
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
        ...(Number.isFinite(secondaryResourceId) ? { secondary_resource_id: secondaryResourceId } : {}),
        ...(statusValue ? { status: statusValue } : {}),
        ...(Number.isFinite(priorityId) ? { priority_id: priorityId } : {}),
        ...(Number.isFinite(issueTypeId) ? { issue_type_id: issueTypeId } : {}),
        ...(Number.isFinite(subIssueTypeId) ? { sub_issue_type_id: subIssueTypeId } : {}),
        ...(Number.isFinite(serviceLevelAgreementId) ? { service_level_agreement_id: serviceLevelAgreementId } : {}),
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
    markPhaseDuration('intake_normalization', intakePhaseStartedAt);

    // round state
    let relatedCases: RelatedCase[] = [];
    let docs: Doc[] = [];
    let device: JsonRecord | null = null;
    let deviceDetails: JsonRecord | null = null;
    let loggedInUser = '';
    let loggedInAt = '';
    let ninjaChecks: Signal[] = [];
    let ninjaContextSignals: Signal[] = [];
    let ninjaOrgMatch: { id: number; name: string } | null = null;
    let ninjaOrgDevices: JsonRecord[] = [];
    let ninjaAlerts: JsonRecord[] = [];
    let ninjaSoftwareInventory: JsonRecord[] = [];
    let ninjaOrgDetails: Record<string, unknown> | null = null;
    const ninjaCollectionErrors: string[] = [];
    let ninjaEnriched: NinjaEnrichedPayload | null = null;
    let resolvedDeviceScore = 0;
    let itglueOrgMatch: { id: string; name: string } | null = null;
    const itglueOrgDetails: Record<string, unknown> | null = null;
    let itglueConfigs: JsonRecord[] = [];
    let itglueContacts: JsonRecord[] = [];
    let itgluePasswords: JsonRecord[] = [];
    let itglueAssets: JsonRecord[] = [];
    let itglueLocations: JsonRecord[] = [];
    let itglueDomains: JsonRecord[] = [];
    let itglueSslCertificates: JsonRecord[] = [];
    let itglueDocumentsRaw: JsonRecord[] = [];
    let itglueDocumentAttachmentsById: Record<string, JsonRecord[]> = {};
    let itglueDocumentRelatedItemsById: Record<string, JsonRecord[]> = {};
    const itglueCollectionErrors: string[] = [];
    let itglueScopeOrgs: Array<{ id: string; name: string; reason: string }> = [];
    const itglueRequestBudgetRemaining = ITGLUE_ROUND2_REQUEST_BUDGET;
    const itglueAssetTypesTotal = 0;
    const itglueAssetTypesSelectedPerScope = 0;
    let itglueEnriched: ItglueEnrichedPayload | null = null;

    // ROUND 1: AT/Intake -> IT Glue (Targeting Org/Contacts/Standards)
    const itgluePhaseStartedAt = Date.now();
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

      const raw = asJsonRecord(itglueResult.raw);
      const rawOrgMatch = asJsonRecord(raw.itglueOrgMatch);
      itglueOrgMatch =
        String(rawOrgMatch.id || '').trim() && String(rawOrgMatch.name || '').trim()
          ? { id: String(rawOrgMatch.id), name: String(rawOrgMatch.name) }
          : null;
      itglueScopeOrgs = asJsonRecordArray(raw.itglueScopes)
        .map((scope) => ({
          id: String(scope.id || ''),
          name: String(scope.name || ''),
          reason: String(scope.reason || ''),
        }))
        .filter((scope) => scope.id && scope.name);
      itglueConfigs = asJsonRecordArray(raw.itglueConfigs);
      itglueContacts = asJsonRecordArray(raw.itglueContacts);
      itgluePasswords = asJsonRecordArray(raw.itgluePasswords);
      itglueAssets = asJsonRecordArray(raw.itglueAssets);
      itglueLocations = asJsonRecordArray(raw.itglueLocations);
      itglueDomains = asJsonRecordArray(raw.itglueDomains);
      itglueSslCertificates = asJsonRecordArray(raw.itglueSslCertificates);
      itglueDocumentsRaw = asJsonRecordArray(raw.itglueDocumentsRaw);

      const runbooks = asJsonRecordArray(raw.itglueRunbooks);
      const runbooksEndpointUnavailable = !runbooks.length;

      itglueDocumentAttachmentsById = {};
      itglueDocumentRelatedItemsById = {};


      docs = runbooks.slice(0, 5).map((doc, idx) => ({
        id: String(doc.id || `itglue-runbook-${idx}`),
        source: 'itglue' as const,
        title: String(doc.name || `Runbook ${idx + 1}`),
        snippet: String(doc.body || '').substring(0, 500),
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
          flattened.map((doc, idx: number) => ({
            id: String(doc.id),
            source: 'itglue' as const,
            title: String(doc.name || `Context doc ${idx + 1}`),
            snippet: String(doc.body || '').substring(0, 500),
            relevance: 0.45 - idx * 0.05,
            raw_ref: doc as unknown as Record<string, unknown>,
            tenant_id: tenantId,
            org_id: itglueOrgMatch?.id || null,
            source_workspace: sourceWorkspace,
          }))
        );
      }

      if (docs.length === 0 && itglueDocumentsRaw.length > 0) {
        docs = itglueDocumentsRaw.slice(0, 8).map((doc: JsonRecord, idx: number) => {
          const attrs = asJsonRecord(doc.attributes);
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
    } finally {
      markPhaseDuration('itglue_round', itgluePhaseStartedAt);
    }

    // ROUND 3: AT+ITG -> Ninja (Targeting Devices, Health, Alerts)
    const ninjaPhaseStartedAt = Date.now();
    try {
      const orgSeed = normalizedTicket?.organizationHint || itglueOrgMatch?.name || companyName || '';
      if (orgSeed) {
        // @ts-ignore
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
    } finally {
      markPhaseDuration('ninja_round', ninjaPhaseStartedAt);
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
    const historyRefinementPhaseStartedAt = Date.now();
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
    // @ts-ignore
    relatedCases = (await findRelatedCasesByTerms(historyTerms, input.orgId, historyScopeCompany)).map((rc) => ({
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
        operationalLogger.error('context.prepare_context.external_search_failed', e, {
          module: 'services.context.prepare-context',
          ticket_id: input.ticketId,
          query: searchQuery,
          signal: 'integration_failure',
          degraded_mode: true,
        }, {
          tenant_id: tenantId ?? null,
          ticket_id: input.ticketId,
        });
      }
    }
    markPhaseDuration('history_refinement', historyRefinementPhaseStartedAt);

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
    }, getFusionSupportedPaths());

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
    const broadHistoryPhaseStartedAt = Date.now();
    try {
      const historySearchPlan = buildBroadHistorySearchPlan({
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
        ? await findRelatedCasesBroad({
          ticketId: String(ticket.ticketNumber || ticket.id || input.ticketId || ''),
          ...(broadHistoryOrgId ? { orgId: broadHistoryOrgId } : {}),
          ...(!broadHistoryOrgId && broadHistoryCompany && !/^unknown$/i.test(broadHistoryCompany)
            ? { companyName: broadHistoryCompany }
            : {}),
          terms: historySearchPlan.terms,
        })
        : [];
      // @ts-ignore
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
        // @ts-ignore
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
      // @ts-ignore

      const calibration = applyHistoryConfidenceCalibration({
        sections: iterativeEnrichment.sections,
        relatedCases: scopedRelatedCases,
      });
      iterativeEnrichment.sections = calibration.sections;
      historyCalibrationAppendix = calibration.appendix;
      // @ts-ignore
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
    } finally {
      markPhaseDuration('broad_history_correlation', broadHistoryPhaseStartedAt);
    }

    // ROUND 9: Final ITG + Ninja pass guided by gaps/conflicts/history calibration (2f)
    let finalRefinementAppendix: TicketContextAppendix['final_refinement'] | undefined;
    const finalRefinementPhaseStartedAt = Date.now();
    try {
      const finalRefinementPlan = buildFinalRefinementPlan({
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
        const shouldReResolveDevice = shouldRunFinalNinjaRefinement({
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

      // @ts-ignore
      finalFieldsUpdated.push(
        ...applyFinalRefinementToEnrichment({
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
    } finally {
      markPhaseDuration('final_refinement', finalRefinementPhaseStartedAt);
    }

    const finalizeEvidencePhaseStartedAt = Date.now();
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
    markPhaseDuration('finalize_evidence_pack', finalizeEvidencePhaseStartedAt);

    const duration = Date.now() - startTime;
    operationalLogger.info('context.prepare_context.completed', {
      module: 'services.context.prepare-context',
      ticket_id: input.ticketId,
      duration_ms: duration,
      phase_durations_ms: phaseDurationsMs,
    }, {
      tenant_id: tenantId ?? null,
      ticket_id: input.ticketId,
    });

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
    const firstNameLabel = text.match(/(?:first\s*name|firstname)\s*[:-]\s*([a-zA-Z]+)\b/i)?.[1];
    const lastNameLabel = text.match(/(?:last\s*name|lastname)\s*[:-]\s*([a-zA-Z]+)\b/i)?.[1];
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
        (text.match(/(?:site|office|location)\s*[:-]\s*([^\n,.]+)/gi) || []).map((v) =>
          v.replace(/(?:site|office|location)\s*[:-]\s*/i, '').trim()
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

    // @ts-ignore
    const candidateActions: DigestAction[] = buildFacetActions(input.facetContext)
      .map((action) => ({
        // @ts-ignore
        ...action,
        // @ts-ignore
        evidence_refs: action.evidence_refs
          // @ts-ignore
          .flatMap((kind) => resolveEvidenceRefsByKind(kind, factsConfirmed))
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
    // @ts-ignore
    inferredPhoneProvider: string | null;
    // @ts-ignore
  }): IterativeEnrichmentSections['network'] {
    // @ts-ignore
    const wanCandidate = this.extractITGlueWanCandidate({
      ticketNarrative: input.ticketNarrative,
      itglueAssets: input.itglueAssets,
      itglueConfigs: input.itglueConfigs,
      docs: input.docs,
    });
    // @ts-ignore
    const narrativeLocationContext = this.enrichmentEngine.inferLocationContext(input.ticketNarrative);
    const locationContext = narrativeLocationContext !== 'unknown'
      // @ts-ignore
      ? narrativeLocationContext
      // @ts-ignore
      : wanCandidate?.location_hint
        // @ts-ignore
        ? 'office'
        : 'unknown';
    const publicIp = this.enrichmentEngine.resolvePublicIp(input.device, input.deviceDetails);
    // @ts-ignore
    const itglueLlmIsp = this.pickEnrichedValue(input.itglueEnriched, 'isp_name');
    // @ts-ignore
    const ispName = itglueLlmIsp || wanCandidate?.isp_name || this.inferIspName({
      ticketNarrative: input.ticketNarrative,
      docs: input.docs,
      itglueConfigs: input.itglueConfigs,
    });
    const vpnState = this.enrichmentEngine.inferVpnState(input.ninjaChecks, input.ticketNarrative);
    const phoneProviderConnected = Boolean(input.inferredPhoneProvider);

    return {
      // @ts-ignore
      location_context: buildField({
        value: locationContext,
        status: locationContext === 'unknown' ? 'unknown' : 'inferred',
        confidence: locationContext === 'unknown' ? 0 : narrativeLocationContext !== 'unknown' ? 0.65 : 0.75,
        // @ts-ignore
        sourceSystem: locationContext === 'unknown' ? 'unknown' : narrativeLocationContext !== 'unknown' ? 'ticket_narrative' : 'itglue',
        // @ts-ignore
        sourceRef: locationContext === 'unknown' ? undefined : narrativeLocationContext !== 'unknown' ? 'ticket.text' : wanCandidate?.source_ref,
        round: narrativeLocationContext !== 'unknown' ? 1 : 2,
      }),
      public_ip: buildField({
        value: publicIp || 'unknown',
        status: publicIp ? 'confirmed' : 'unknown',
        confidence: publicIp ? 0.9 : 0,
        sourceSystem: publicIp ? 'ninjaone' : 'unknown',
        // @ts-ignore
        sourceRef: publicIp ? 'ninja.device.publicIP/ipAddresses' : undefined,
        // @ts-ignore
        round: 1,
      }),
      isp_name: buildField({
        value: ispName || 'unknown',
        // @ts-ignore
        status: ispName ? 'inferred' : 'unknown',
        // @ts-ignore
        confidence: itglueLlmIsp ? 0.75 : wanCandidate?.isp_name ? Math.max(0.65, wanCandidate.confidence) : ispName ? 0.6 : 0,
        // @ts-ignore
        sourceSystem: itglueLlmIsp ? 'itglue_llm' : wanCandidate?.isp_name ? 'itglue' : ispName ? 'cross_correlation' : 'unknown',
        // @ts-ignore
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
    itglueConfigs: JsonRecord[];
    itgluePasswords: JsonRecord[];
    itglueAssets: JsonRecord[];
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
    return hashSnapshot(snapshot);
  }

  private hashSnapshotWithVersion(snapshot: Record<string, unknown>, version: string): string {
    return hashSnapshotWithVersion(snapshot, version);
  }

  private pickEnrichedValue(payload: ItglueEnrichedPayload | null, key: string): string | null {
    return pickEnrichedValue(payload, key);
  }

  private buildItglueExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    return buildItglueExtractionInput(snapshot);
  }

  private buildNinjaExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    return buildNinjaExtractionInput(snapshot);
  }

  private async getOrRefreshItglueEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
  }): Promise<ItglueEnrichedPayload | null> {
    return getOrRefreshItglueEnriched(input);
  }

  private async getOrRefreshNinjaEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
  }): Promise<NinjaEnrichedPayload | null> {
    return getOrRefreshNinjaEnriched(input);
  }

  private buildTicketSSOT(sections: IterativeEnrichmentSections): TicketSSOT {
    return buildTicketSSOT(sections);
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
        organizationHint?: string;
        title?: string;
        descriptionCanonical?: string;
        descriptionUi?: string;
      } | null;
      companyName?: string;
      autotaskAuthoritativeSeed?: TicketSSOT['autotask_authoritative'] | null;
    }
  ): TicketSSOT {
    return applyIntakeAntiRegressionToSSOT(ssot, input);
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
    const supportedPaths = getFusionSupportedPaths();
    const fieldCandidates = buildFusionFieldCandidates(input, supportedPaths);
    const { links, inferences } = buildFusionLinksAndInferences(input);

    if (fieldCandidates.length === 0 && links.length === 0) return null;

    let llmOutput: FusionAdjudicationOutput | null = null;
    let usedLlm = false;
    let llmError: string | null = null;

    try {
      const prompt = buildFusionAdjudicationPrompt({
        ticket: input.ticket,
        ticketNarrative: input.ticketNarrative,
        fieldCandidates,
        links,
        inferences,
      });
      const llm = await callLLM(prompt);
      const parsed = extractJsonObject(llm.content);
      llmOutput = sanitizeFusionAdjudicationOutput(parsed, supportedPaths);
      usedLlm = true;
    } catch (error) {
      llmError = (error as Error)?.message || String(error);
    }

    const fallbackResolutions = buildDeterministicFusionFallbackResolutions(input, links);
    const validatedLlmResolutions = validateFusionLlmResolutions({
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

    const applied = applyFusionResolutionsToSections(input.sections, mergedOutput.resolutions);

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
    return getFusionSupportedPaths();
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
    return buildFusionFieldCandidates(input, supportedPaths);
  }

  private buildFusionLinksAndInferences(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    itglueContacts: any[];
    ninjaSoftwareInventory: any[];
    device: any | null;
    loggedInUser: string;
  }): { links: FusionLink[]; inferences: FusionInference[] } {
    return buildFusionLinksAndInferences(input);
  }

  private buildFusionAdjudicationPrompt(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    fieldCandidates: FusionFieldCandidate[];
    links: FusionLink[];
    inferences: FusionInference[];
  }): string {
    return buildFusionAdjudicationPrompt(input);
  }

  private sanitizeFusionAdjudicationOutput(parsed: any, supportedPaths: Set<string>): FusionAdjudicationOutput {
    return sanitizeFusionAdjudicationOutput(parsed, supportedPaths);
  }

  private validateFusionLlmResolutions(input: {
    resolutions: FusionFieldResolution[];
    fieldCandidates: FusionFieldCandidate[];
    deterministicLinks: FusionLink[];
    deterministicInferences: FusionInference[];
  }): FusionFieldResolution[] {
    return validateFusionLlmResolutions(input);
  }

  private normalizeFusionCandidateValueForCompare(value: unknown): string {
    return normalizeFusionCandidateValueForCompare(value);
  }

  private buildDeterministicFusionFallbackResolutions(input: {
    sections: IterativeEnrichmentSections;
    itglueContacts: any[];
    loggedInUser: string;
  }, links: FusionLink[]): FusionFieldResolution[] {
    return buildDeterministicFusionFallbackResolutions(input, links);
  }

  private applyFusionResolutionsToSections(
    sections: IterativeEnrichmentSections,
    resolutions: FusionFieldResolution[]
  ): { sections: IterativeEnrichmentSections; appliedCount: number; appliedPaths: string[] } {
    return applyFusionResolutionsToSections(sections, resolutions);
  }

  private buildFacetActions(facets: FacetContext): any[] {
    return buildFacetActions(facets);
  }

  private resolveEvidenceRefsByKind(kind: string, facts: any[]): string[] {
    return resolveEvidenceRefsByKind(kind, facts);
  }

  private async findRelatedCases(...args: any[]): Promise<any> {
    return (findRelatedCases as any)(...args);
  }

  private buildBroadHistorySearchPlan(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    normalizedTicket: any | null;
    sections: IterativeEnrichmentSections;
    docs: Doc[];
    fusionAudit?: Record<string, unknown>;
  }): { terms: string[]; strategies: string[] } {
    return buildBroadHistorySearchPlan(input);
  }

  private buildFinalRefinementPlan(input: {
    sections: IterativeEnrichmentSections;
    missingData: Array<{ field: string; why: string }>;
    fusionAudit?: Record<string, unknown>;
    historyCalibration?: TicketContextAppendix['history_confidence_calibration'];
    historyCorrelation?: TicketContextAppendix['history_correlation'];
  }): { targets: string[]; terms: string[] } {
    return buildFinalRefinementPlan(input);
  }

  private shouldRunFinalNinjaRefinement(input: {
    sections: IterativeEnrichmentSections;
    finalRefinementPlanTargets: string[];
    currentDevice: any | null;
  }): boolean {
    return shouldRunFinalNinjaRefinement(input);
  }

  private async findRelatedCasesBroad(...args: any[]): Promise<RelatedCase[]> {
    return (findRelatedCasesBroad as any)(...args);
  }

  private async findRelatedCasesByTerms(...args: any[]): Promise<RelatedCase[]> {
    return (findRelatedCasesByTerms as any)(...args);
  }

  private normalizeHistoryTerms(terms: string[]): Array<{ term: string; normalized: string; weight: number }> {
    return normalizeHistoryTerms(terms);
  }

  private scoreHistoryCandidate(
    haystack: string,
    terms: Array<{ term: string; normalized: string; weight: number }>
  ): { score: number; matchedTerms: string[] } {
    return scoreHistoryCandidate(haystack, terms);
  }



  private mapAutotaskPriority(
    priority: Parameters<typeof mapAutotaskPriority>[0]
  ): ReturnType<typeof mapAutotaskPriority> {
    return mapAutotaskPriority(priority);
  }

  private resolveNinjaOrg(
    ...args: Parameters<typeof resolveNinjaOrg>
  ): ReturnType<typeof resolveNinjaOrg> {
    return resolveNinjaOrg(...args);
  }

  private extractLoggedInUser(deviceDetails: unknown): string | null {
    return extractLoggedInUser(deviceDetails);
  }

  private extractITGlueWanCandidate(
    input: Parameters<typeof extractITGlueWanCandidate>[0]
  ): ReturnType<typeof extractITGlueWanCandidate> {
    return extractITGlueWanCandidate(input);
  }

  private inferIspName(
    input: Parameters<typeof inferIspName>[0]
  ): ReturnType<typeof inferIspName> {
    return inferIspName(input);
  }

  private extractITGlueInfraCandidates(
    input: Parameters<typeof extractITGlueInfraCandidates>[0]
  ): ReturnType<typeof extractITGlueInfraCandidates> {
    return extractITGlueInfraCandidates(input);
  }

  private extractInfraMakeModel(
    ...args: Parameters<typeof extractInfraMakeModel>
  ): ReturnType<typeof extractInfraMakeModel> {
    return extractInfraMakeModel(...args);
  }

  private parseMakeModel(
    value: Parameters<typeof parseMakeModel>[0]
  ): ReturnType<typeof parseMakeModel> {
    return parseMakeModel(value);
  }

  private rankITGlueDocsForTicket(
    ...args: Parameters<typeof rankITGlueDocsForTicket>
  ): ReturnType<typeof rankITGlueDocsForTicket> {
    return rankITGlueDocsForTicket(...args);
  }

  private normalizeFusionResolutionValue(path: string, val: unknown): string {
    return normalizeFusionResolutionValue(path, val);
  }

  private isFusionUnknownValue(val: unknown): boolean {
    return isFusionUnknownValue(val);
  }

  
  // For tests
  public postProcessCanonicalTicketText(raw: string): string {
    return postProcessCanonicalTicketText(raw);
  }

  public buildTicketNarrative(input: { title: string; description: string; company?: string; symptom?: string }): string {
    return buildTicketNarrative(input);
  }

  public normalizeTicketDeterministically(title: string, rawDescription: string) {
    return normalizeTicketDeterministically(title, rawDescription);
  }

  private async normalizeTicketForPipeline(ticketLike: TicketLike) {
    return normalizeTicketForPipeline(ticketLike);
  }

  private async formatDisplayMarkdownVerbatimWithLLM(text: string): Promise<string> {
    return formatDisplayMarkdownVerbatimWithLLM(text);
  }

  private isDisplayMarkdownVerbatimEnough(raw: string, mark: string): boolean {
    return isDisplayMarkdownVerbatimEnough(raw, mark);
  }

  private inferPhoneProvider(
    input: Parameters<typeof inferPhoneProvider>[0]
  ): ReturnType<typeof inferPhoneProvider> {
    return inferPhoneProvider(input);
  }

  private resolveLastLoggedInContext(
    ...args: Parameters<typeof resolveLastLoggedInContext>
  ): ReturnType<typeof resolveLastLoggedInContext> {
    return resolveLastLoggedInContext(...args);
  }

  private resolveDeviceOsLabel(
    ...args: Parameters<typeof resolveDeviceOsLabel>
  ): ReturnType<typeof resolveDeviceOsLabel> {
    return resolveDeviceOsLabel(...args);
  }

  private async buildNinjaContextSignals(
    input: Parameters<typeof buildNinjaContextSignals>[0]
  ): ReturnType<typeof buildNinjaContextSignals> {
    return buildNinjaContextSignals(input);
  }

}


// ─────────────────────────────────────────────────────────────
// Persistence — re-exported from context/persistence.ts
// All existing consumers continue to import from prepare-context.ts
// ─────────────────────────────────────────────────────────────
export {
  persistEvidencePack,
  getEvidencePack,
  persistTicketSSOT,
  persistTicketTextArtifact,
  getTicketTextArtifact,
  persistTicketContextAppendix,
  getTicketContextAppendix,
  persistItglueOrgSnapshot,
  getItglueOrgEnriched,
  upsertItglueOrgEnriched,
  persistNinjaOrgSnapshot,
  getNinjaOrgEnriched,
  upsertNinjaOrgEnriched,
} from './persistence.js';
