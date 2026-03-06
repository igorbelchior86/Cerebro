// ─────────────────────────────────────────────────────────────
// Playbook Routes — Generate & Retrieve Playbooks
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import type { DiagnosisOutput, EvidencePack, PlaybookOutput, ValidationOutput } from '@cerebro/types';
import { generatePlaybook } from '../../ai/playbook-writer.js';
import {
  getEvidencePack,
  getTicketContextAppendix,
  getTicketTextArtifact,
  persistEvidencePack,
} from '../../context/prepare-context.js';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute, transaction } from '../../../db/index.js';
import { diagnoseEvidencePack } from '../../ai/diagnose.js';
import { validateDiagnosis } from '../../domain/validate-policy.js';
import { PrepareContextService } from '../../context/prepare-context.js';
import { AutotaskClient } from '../../../clients/autotask.js';
import { operationalLogger } from '../../../lib/operational-logger.js';
import { tenantContext } from '../../../lib/tenantContext.js';
import { workflowService } from '../../orchestration/workflow-runtime.js';

const router: Router = Router();
const fullFlowInFlight = new Set<string>();
const FULL_FLOW_SESSION_CREATE_LOCK_NAMESPACE = 41022;
const FULL_FLOW_RETRY_BASE_DELAY_MS = 2 * 60 * 1000;
const FULL_FLOW_RETRY_MAX_DELAY_MS = 30 * 60 * 1000;
const FULL_FLOW_PROCESSING_STALE_INTERVAL = '5 minutes';

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

function isMissingAutotaskTicketError(error: unknown): boolean {
  const message = String(((error && typeof error === 'object' && !Array.isArray(error)) ? (error as Record<string, unknown>).message : undefined) ?? error ?? '').toLowerCase();
  return (
    message.includes('ticket') &&
    (
      message.includes('not found in autotask query') ||
      message.includes('cannot prepare context without valid ticket from autotask') ||
      message.includes('not found')
    )
  );
}

async function markSessionDeletedFromAutotask(
  sessionId: string,
  ticketId: string,
  tenantId?: string | null,
  reason?: string,
): Promise<void> {
  const normalizedTenantId = String(tenantId || '').trim();
  if (normalizedTenantId) {
    await workflowService.removeInboxTicket(normalizedTenantId, ticketId, {
      reason: 'autotask_ticket_missing_during_full_flow',
      correlation: {
        trace_id: `playbook-stale-${Date.now()}`,
        ticket_id: ticketId,
      },
      metadata: {
        session_id: sessionId,
        upstream_reason: reason || undefined,
      },
    });
  }

  await execute(
    `UPDATE triage_sessions
     SET status = 'failed',
         last_error = $1,
         retry_count = 0,
         next_retry_at = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [`deleted in Autotask: ${reason || 'Ticket missing in Autotask'}`, sessionId]
  );
}

export const __testables = {
  isMissingAutotaskTicketError,
  markSessionDeletedFromAutotask,
  resolveOrCreateFullFlowSession,
};

type AuthoritativeFieldDiff = {
  field: string;
  local: unknown;
  autotask: unknown;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is JsonRecord => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)))
    : [];
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickFirstText(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
}

function resolvePicklistLabel(options: Array<{ id: number; label: string }>, rawValue: unknown): string | null {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return null;
  const match = options.find((option) => option.id === numeric);
  return match?.label || null;
}

async function getAutotaskClientForReviewer(explicitTenantId?: string | null): Promise<AutotaskClient | null> {
  const tenantId = String(explicitTenantId || tenantContext.getStore()?.tenantId || '').trim();
  if (!tenantId) return null;
  const row = await queryOne<{ credentials: AutotaskCreds }>(
    `SELECT credentials
     FROM integration_credentials
     WHERE tenant_id = $1 AND service = 'autotask'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [tenantId]
  );
  const creds = row?.credentials;
  if (!creds?.apiIntegrationCode || !creds?.username || !creds?.secret) return null;
  return new AutotaskClient({
    apiIntegrationCode: creds.apiIntegrationCode,
    username: creds.username,
    secret: creds.secret,
    ...(creds.zoneUrl ? { zoneUrl: creds.zoneUrl } : {}),
  });
}

function normalizeCompareValue(input: unknown): unknown {
  if (input === undefined || input === null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return input;
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeCompareValue(a)) !== JSON.stringify(normalizeCompareValue(b));
}

async function applyAutotaskReviewerOverlay(
  ticketRef: string,
  localTicket: Record<string, unknown>,
  tenantId?: string | null,
): Promise<{
  ticket: Record<string, unknown>;
  review: {
    source: 'autotask';
    applied: true;
    ticket_ref: string;
    divergences: AuthoritativeFieldDiff[];
  };
} | null> {
  const client = await getAutotaskClientForReviewer(tenantId);
  if (!client) return null;

  const ref = String(ticketRef || '').trim();
  if (!ref) return null;

  let remoteTicket: Record<string, unknown>;
  try {
    remoteTicket = /^\d+$/.test(ref)
      ? await client.getTicket(Number(ref)) as unknown as Record<string, unknown>
      : await client.getTicketByTicketNumber(ref) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
  const remoteTicketRecord = asRecord(remoteTicket);

  const companyId = pickFirstNumber(remoteTicketRecord.companyID, remoteTicketRecord.companyId);
  const contactId = pickFirstNumber(remoteTicketRecord.contactID, remoteTicketRecord.contactId);
  const primaryResourceId = pickFirstNumber(remoteTicketRecord.assignedResourceID, remoteTicketRecord.assignedResourceId);
  const secondaryResourceId = pickFirstNumber(remoteTicketRecord.secondaryResourceID, remoteTicketRecord.secondaryResourceId);
  const queueId = pickFirstNumber(remoteTicketRecord.queueID, remoteTicketRecord.queueId);
  const priorityId = pickFirstNumber(remoteTicketRecord.priority, remoteTicketRecord.priorityID, remoteTicketRecord.priorityId);
  const issueTypeId = pickFirstNumber(remoteTicketRecord.issueType, remoteTicketRecord.issueTypeID, remoteTicketRecord.issueTypeId);
  const subIssueTypeId = pickFirstNumber(remoteTicketRecord.subIssueType, remoteTicketRecord.subIssueTypeID, remoteTicketRecord.subIssueTypeId);
  const serviceLevelAgreementId = pickFirstNumber(
    remoteTicketRecord.serviceLevelAgreementID,
    remoteTicketRecord.serviceLevelAgreementId,
    remoteTicketRecord.sla,
  );
  const statusValue = pickFirstText(remoteTicketRecord.status, remoteTicketRecord.statusValue);

  const [
    company,
    contact,
    primaryResource,
    secondaryResource,
    queueOptions,
    statusOptionRows,
    priorityOptionRows,
    issueTypeOptionRows,
    subIssueTypeOptionRows,
    slaOptionRows,
  ] = await Promise.all([
    Number.isFinite(Number(companyId)) ? client.getCompany(Number(companyId)).catch(() => null) : Promise.resolve(null),
    Number.isFinite(Number(contactId)) ? client.getContact(Number(contactId)).catch(() => null) : Promise.resolve(null),
    Number.isFinite(Number(primaryResourceId)) ? client.getResource(Number(primaryResourceId)).catch(() => null) : Promise.resolve(null),
    Number.isFinite(Number(secondaryResourceId)) ? client.getResource(Number(secondaryResourceId)).catch(() => null) : Promise.resolve(null),
    client.getTicketQueues().catch(() => []),
    client.getTicketStatusOptions().catch(() => []),
    client.getTicketPriorityOptions().catch(() => []),
    client.getTicketIssueTypeOptions().catch(() => []),
    client.getTicketSubIssueTypeOptions().catch(() => []),
    client.getTicketServiceLevelAgreementOptions().catch(() => []),
  ]);

  const queueLabelMap = new Map<number, string>();
  for (const option of queueOptions || []) {
    const optionRecord = asRecord(option);
    const id = Number(optionRecord.id);
    const label = String(optionRecord.label || '').trim();
    if (Number.isFinite(id) && label) queueLabelMap.set(id, label);
  }

  const companyRecord = asRecord(company);
  const contactRecord = asRecord(contact);
  const primaryResourceRecord = asRecord(primaryResource);
  const secondaryResourceRecord = asRecord(secondaryResource);
  const contactName = `${String(contactRecord.firstName || '').trim()} ${String(contactRecord.lastName || '').trim()}`.trim();
  const primaryName = `${String(primaryResourceRecord.firstName || '').trim()} ${String(primaryResourceRecord.lastName || '').trim()}`.trim();
  const secondaryName = `${String(secondaryResourceRecord.firstName || '').trim()} ${String(secondaryResourceRecord.lastName || '').trim()}`.trim();
  const priorityLabel = resolvePicklistLabel(priorityOptionRows, priorityId);
  const issueTypeLabel = resolvePicklistLabel(issueTypeOptionRows, issueTypeId);
  const subIssueTypeLabel = resolvePicklistLabel(subIssueTypeOptionRows, subIssueTypeId);
  const serviceLevelAgreementLabel = resolvePicklistLabel(slaOptionRows, serviceLevelAgreementId);
  const statusLabel =
    resolvePicklistLabel(statusOptionRows, statusValue) ||
    pickFirstText(remoteTicketRecord.statusName, remoteTicketRecord.statusLabel);

  const authoritativeOverlay: Record<string, unknown> = {
    company_id: companyId,
    company: pickFirstText(companyRecord.companyName, remoteTicketRecord.companyName, remoteTicketRecord.company),
    contact_id: contactId,
    contact_name: pickFirstText(contactName, remoteTicketRecord.contactName, remoteTicketRecord.requesterName),
    contact_email: String(contactRecord.emailAddress || '').trim() || null,
    status: statusValue,
    status_label: statusLabel,
    priority: priorityId,
    priority_label: priorityLabel,
    additional_contacts: remoteTicketRecord.additionalContactIDs ?? remoteTicketRecord.additionalContactIds ?? null,
    issue_type: issueTypeId,
    issue_type_label: issueTypeLabel,
    sub_issue_type: subIssueTypeId,
    sub_issue_type_label: subIssueTypeLabel,
    source: remoteTicketRecord.source ?? null,
    due_date: remoteTicketRecord.dueDateTime ?? remoteTicketRecord.dueDate ?? null,
    sla: serviceLevelAgreementId,
    sla_label: serviceLevelAgreementLabel,
    queue_id: queueId,
    queue_name: Number.isFinite(Number(queueId)) ? (queueLabelMap.get(Number(queueId)) || null) : null,
    assigned_resource_id: primaryResourceId,
    assigned_resource_name: primaryName || null,
    assigned_resource_email: String(primaryResourceRecord.email || '').trim() || null,
    secondary_resource_id: secondaryResourceId,
    secondary_resource_name: secondaryName || null,
    secondary_resource_email: String(secondaryResourceRecord.email || '').trim() || null,
    created_at: pickFirstText(
      remoteTicketRecord.createDateTime,
      remoteTicketRecord.createDate,
      remoteTicketRecord.created_at,
      remoteTicketRecord.createdAt,
    ),
  };

  const divergences: AuthoritativeFieldDiff[] = [];
  for (const [field, atValue] of Object.entries(authoritativeOverlay)) {
    if (valuesDiffer(localTicket[field], atValue)) {
      divergences.push({ field, local: localTicket[field], autotask: atValue });
    }
  }

  return {
    ticket: {
      ...localTicket,
      ...authoritativeOverlay,
    },
    review: {
      source: 'autotask',
      applied: true,
      ticket_ref: ref,
      divergences,
    },
  };
}

async function getAutotaskTicketNotesForFeed(ticketRef: string, tenantId?: string | null): Promise<Record<string, unknown>[]> {
  const client = await getAutotaskClientForReviewer(tenantId);
  if (!client) return [];

  const ref = String(ticketRef || '').trim();
  if (!ref) return [];

  let numericTicketId = Number.NaN;
  try {
    if (/^\d+$/.test(ref)) {
      numericTicketId = Number(ref);
    } else {
      const remoteTicket = await client.getTicketByTicketNumber(ref);
      const remoteTicketRecord = asRecord(remoteTicket);
      numericTicketId = Number(
        remoteTicketRecord.id ??
        remoteTicketRecord.ticketID ??
        remoteTicketRecord.ticketId
      );
    }
  } catch {
    return [];
  }

  if (!Number.isFinite(numericTicketId)) return [];

  try {
    const notes = await client.getTicketNotes(numericTicketId);
    if (!Array.isArray(notes)) return [];
    return notes
      .filter((note) => Boolean(note && typeof note === 'object'))
      .map((note) => ({ ...(note as Record<string, unknown>) }));
  } catch {
    return [];
  }
}

async function resolveOrCreateFullFlowSession(ticketId: string, tenantId: string | null): Promise<{ id: string; created: boolean }> {
  return transaction(async (client) => {
    const normalizedTenantId = String(tenantId || '').trim() || null;
    const lockScope = normalizedTenantId ? `${normalizedTenantId}:${ticketId}` : ticketId;
    await client.query(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [FULL_FLOW_SESSION_CREATE_LOCK_NAMESPACE, lockScope]
    );

    const existing = normalizedTenantId
      ? await client.query<{ id: string }>(
        `SELECT id
         FROM triage_sessions
         WHERE ticket_id = $1
           AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [ticketId, normalizedTenantId]
      )
      : await client.query<{ id: string }>(
        `SELECT id
         FROM triage_sessions
         WHERE ticket_id = $1
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [ticketId]
      );
    const session = existing.rows[0];
    if (session) {
      return { id: session.id, created: false };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO triage_sessions (id, ticket_id, status, created_by, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [uuidv4(), ticketId, 'pending', '00000000-0000-0000-0000-000000000000', normalizedTenantId]
    );
    const newSession = inserted.rows[0];
    if (!newSession) {
      throw new Error('Failed to create triage session');
    }
    return { id: newSession.id, created: true };
  });
}

function isTransientProviderError(error: unknown): boolean {
  const errorRecord = asRecord(error);
  const message = String(errorRecord.message ?? error ?? '').toLowerCase();
  if (errorRecord.name === 'LLMQuotaExceededError') return true;
  return message.includes('[geminilimiter]') ||
    message.includes('rpd limit reached') ||
    message.includes('resource_exhausted') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network error') ||
    message.includes('api key not set') ||
    message.includes('invalid api key') ||
    message.includes('access is denied');
}

function computeRetryBackoffDelayMs(retryCount: number): number {
  const exponent = Math.max(0, retryCount - 1);
  const delay = FULL_FLOW_RETRY_BASE_DELAY_MS * Math.pow(2, Math.min(exponent, 6));
  return Math.min(delay, FULL_FLOW_RETRY_MAX_DELAY_MS);
}

async function markSessionPendingForRetry(sessionId: string, errorMessage: string): Promise<void> {
  await transaction(async (client) => {
    const current = await client.query<{ retry_count: number | null }>(
      `SELECT retry_count FROM triage_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    const nextRetryCount = (current.rows[0]?.retry_count ?? 0) + 1;
    const delayMs = computeRetryBackoffDelayMs(nextRetryCount);
    const nextRetryAt = new Date(Date.now() + delayMs);

    await client.query(
      `UPDATE triage_sessions
       SET status = 'pending',
           retry_count = $1,
           next_retry_at = $2,
           last_error = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [nextRetryCount, nextRetryAt, errorMessage, sessionId]
    );
  });
}

async function claimSessionForFullFlowBackground(sessionId: string): Promise<boolean> {
  const claimed = await queryOne<{ id: string }>(
    `UPDATE triage_sessions
     SET status = 'processing',
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND (
         status IN ('pending', 'failed')
         OR (status = 'processing' AND updated_at < NOW() - INTERVAL '${FULL_FLOW_PROCESSING_STALE_INTERVAL}')
       )
     RETURNING id`,
    [sessionId]
  );
  return Boolean(claimed?.id);
}

// ─── GET /playbook/full-flow ──────────────────────────────
/**
 * Complete flow: Evidence → Diagnosis → Validation → Playbook
 * @route GET /playbook/full-flow
 * @param {string} sessionId - Session ID (UUID) or Ticket ID (e.g. T2026.001)
 * @returns {complete flow result}
 */
router.get('/full-flow', async (req, res) => {
  try {
    const rawId = (req.query.sessionId || req.body?.sessionId) as string;
    const forceRefresh =
      String(req.query.refresh || req.body?.refresh || '').toLowerCase() === '1' ||
      String(req.query.refresh || req.body?.refresh || '').toLowerCase() === 'true';

    if (!rawId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    operationalLogger.info('routes.ai.playbook.full_flow.started', {
      module: 'routes.ai.playbook',
      raw_id: rawId,
      force_refresh: forceRefresh,
    });

    // Resolve Session ID
    let sessionId = rawId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    if (!isUuid) {
      const tenantId = req.auth?.tid || null;
      const resolvedSession = await resolveOrCreateFullFlowSession(rawId, tenantId);
      if (resolvedSession.created) {
        operationalLogger.info('routes.ai.playbook.full_flow.session_created', {
          module: 'routes.ai.playbook',
          session_id: resolvedSession.id,
        }, { tenant_id: tenantId, ticket_id: rawId });
      } else {
        operationalLogger.info('routes.ai.playbook.full_flow.session_reused', {
          module: 'routes.ai.playbook',
          session_id: resolvedSession.id,
        }, { tenant_id: tenantId, ticket_id: rawId });
      }
      sessionId = resolvedSession.id;

      // Return initializing state but let background processing continue
      // We set pack/diagnosis/etc to null to trigger background logic later
    }

    operationalLogger.info('routes.ai.playbook.full_flow.session_resolved', {
      module: 'routes.ai.playbook',
      session_id: sessionId,
    }, { ticket_id: rawId });
    let sessionRow = await queryOne<{
      id: string;
      ticket_id: string;
      tenant_id: string | null;
      status: string;
      retry_count: number | null;
      next_retry_at: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, ticket_id, tenant_id, status, retry_count, next_retry_at, last_error, created_at, updated_at
       FROM triage_sessions
       WHERE id = $1
       LIMIT 1`,
      [sessionId]
    );
    const ticketId = sessionRow?.ticket_id || rawId;
    const sessionTenantId = String(sessionRow?.tenant_id || req.auth?.tid || '').trim() || null;

    if (forceRefresh && sessionRow?.id) {
      operationalLogger.info('routes.ai.playbook.full_flow.force_refresh_requested', {
        module: 'routes.ai.playbook',
        session_id: sessionId,
      }, { ticket_id: ticketId });
      const existingPack = await queryOne<{ payload: JsonRecord | null }>(
        `SELECT ep.payload
         FROM evidence_packs ep
         WHERE ep.session_id = $1
         ORDER BY ep.created_at DESC
         LIMIT 1`,
        [sessionId]
      );
      const existingPackPayload = asRecord(existingPack?.payload);
      const existingPackOrg = asRecord(existingPackPayload.org);
      const existingPackDevice = asRecord(existingPackPayload.device);
      const existingOrgId = String(existingPackOrg.id || '').trim();
      const existingNinjaOrgId = String(
        existingPackDevice.organizationId ||
        existingPackDevice.organization_id ||
        ''
      ).trim();
      await execute(
        `DELETE FROM playbooks WHERE session_id = $1`,
        [sessionId]
      );
      await execute(
        `DELETE FROM llm_outputs WHERE session_id = $1`,
        [sessionId]
      );
      await execute(
        `DELETE FROM validation_results WHERE session_id = $1`,
        [sessionId]
      );
      await execute(
        `DELETE FROM evidence_packs WHERE session_id = $1`,
        [sessionId]
      );
      const hasTicketTextArtifacts = await queryOne<{ exists: boolean }>(
        `SELECT to_regclass('public.ticket_text_artifacts') IS NOT NULL AS exists`
      );
      if (hasTicketTextArtifacts?.exists) {
        await execute(
          `DELETE FROM ticket_text_artifacts WHERE ticket_id = $1`,
          [ticketId]
        );
      }
      const hasTicketContextAppendix = await queryOne<{ exists: boolean }>(
        `SELECT to_regclass('public.ticket_context_appendix') IS NOT NULL AS exists`
      );
      if (hasTicketContextAppendix?.exists) {
        await execute(
          `DELETE FROM ticket_context_appendix WHERE ticket_id = $1`,
          [ticketId]
        );
      }
      const hasTicketSSOT = await queryOne<{ exists: boolean }>(
        `SELECT to_regclass('public.ticket_ssot') IS NOT NULL AS exists`
      );
      if (hasTicketSSOT?.exists) {
        await execute(
          `DELETE FROM ticket_ssot WHERE ticket_id = $1`,
          [ticketId]
        );
      }
      if (existingOrgId && existingOrgId !== 'unknown') {
        const hasItglueEnriched = await queryOne<{ exists: boolean }>(
          `SELECT to_regclass('public.itglue_org_enriched') IS NOT NULL AS exists`
        );
        if (hasItglueEnriched?.exists) {
          await execute(
            `DELETE FROM itglue_org_enriched WHERE org_id = $1`,
            [existingOrgId]
          );
        }
        const hasItglueSnapshot = await queryOne<{ exists: boolean }>(
          `SELECT to_regclass('public.itglue_org_snapshot') IS NOT NULL AS exists`
        );
        if (hasItglueSnapshot?.exists) {
          await execute(
            `DELETE FROM itglue_org_snapshot WHERE org_id = $1`,
            [existingOrgId]
          );
        }
      }
      const ninjaOrgIds = [...new Set([existingNinjaOrgId, existingOrgId].filter((v) => v && v !== 'unknown'))];
      if (ninjaOrgIds.length > 0) {
        const hasNinjaEnriched = await queryOne<{ exists: boolean }>(
          `SELECT to_regclass('public.ninja_org_enriched') IS NOT NULL AS exists`
        );
        if (hasNinjaEnriched?.exists) {
          for (const orgId of ninjaOrgIds) {
            await execute(`DELETE FROM ninja_org_enriched WHERE org_id = $1`, [orgId]);
          }
        }
        const hasNinjaSnapshot = await queryOne<{ exists: boolean }>(
          `SELECT to_regclass('public.ninja_org_snapshot') IS NOT NULL AS exists`
        );
        if (hasNinjaSnapshot?.exists) {
          for (const orgId of ninjaOrgIds) {
            await execute(`DELETE FROM ninja_org_snapshot WHERE org_id = $1`, [orgId]);
          }
        }
      }
      await execute(
        `UPDATE triage_sessions
         SET status = 'failed', last_error = 'manual refresh restart', updated_at = NOW()
         WHERE id = $1`,
        [sessionId]
      );

      const refreshTenantId = req.auth?.tid || null;
      const restartedSession = await queryOne<{ id: string }>(
        `INSERT INTO triage_sessions (id, ticket_id, status, created_by, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [uuidv4(), ticketId, 'pending', '00000000-0000-0000-0000-000000000000', refreshTenantId]
      );
      if (restartedSession?.id) {
        sessionId = restartedSession.id;
        sessionRow = await queryOne<{
          id: string;
          ticket_id: string;
          tenant_id: string | null;
          status: string;
          retry_count: number | null;
          next_retry_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT id, ticket_id, tenant_id, status, retry_count, next_retry_at, last_error, created_at, updated_at
           FROM triage_sessions
           WHERE id = $1
           LIMIT 1`,
          [sessionId]
        );
        operationalLogger.info('routes.ai.playbook.full_flow.force_refresh_restarted', {
          module: 'routes.ai.playbook',
          session_id: sessionId,
        }, { ticket_id: ticketId });
      }
    }

    // Get all the data
    operationalLogger.info('routes.ai.playbook.full_flow.fetching_evidence_pack', {
      module: 'routes.ai.playbook',
      session_id: sessionId,
    }, { ticket_id: ticketId });
    let pack = await getEvidencePack(sessionId);
    if (!pack) {
      const result = await queryOne<{ payload: EvidencePack | null }>(
        `SELECT payload
         FROM evidence_packs
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId]
      );
      if (result) {
        pack = result.payload;
      }
    }

    if (!pack) {
      operationalLogger.info('routes.ai.playbook.full_flow.evidence_pack_missing', {
        module: 'routes.ai.playbook',
        session_id: sessionId,
        degraded_mode: true,
      }, { ticket_id: ticketId });
      // Continue execution so background processing can start
    } else {
      operationalLogger.info('routes.ai.playbook.full_flow.evidence_pack_ready', {
        module: 'routes.ai.playbook',
        session_id: sessionId,
      }, { ticket_id: ticketId });
    }
    const ticketResult = await queryOne<{ payload: JsonRecord | null }>(
      `SELECT to_jsonb(tp) AS payload
       FROM tickets_processed tp
       WHERE tp.id = $1
       ORDER BY tp.created_at DESC
       LIMIT 1`,
      [ticketId]
    );
    const packRecord = asRecord(pack);
    const packTicket = asRecord(packRecord.ticket);
    const packOrg = asRecord(packRecord.org);
    const packUser = asRecord(packRecord.user);
    const normalizedTicketSection = asRecord(asRecord(asRecord(packRecord.iterative_enrichment).sections).ticket);
    const round0Finding = asRecordArray(packRecord.source_findings).find((finding) => Number(finding.round) === 0) || null;
    const round0Details = Array.isArray(round0Finding?.details) ? round0Finding.details : [];
    const normalizationMethod = String(
      round0Details.find((d: string) => String(d).startsWith('method:')) || ''
    ).replace('method:', '').trim();
    const normalizationConfidence = String(
      round0Details.find((d: string) => String(d).startsWith('confidence:')) || ''
    ).replace('confidence:', '').trim();
    const dbTicket = asRecord(ticketResult?.payload);
    const manuallySuppressed = Boolean(dbTicket.manual_suppressed);
    const ssotResult = await queryOne<{ payload: JsonRecord | null }>(
      `SELECT payload FROM ticket_ssot WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [String(ticketId || rawId || '')]
    );
    const ssot = asRecord(ssotResult?.payload);
    const ssotAutotask = asRecord(ssot.autotask_authoritative);
    const ticketTextArtifact = await getTicketTextArtifact(String(ticketId || rawId || ''));
    const ticketContextAppendix = await getTicketContextAppendix(String(ticketId || rawId || ''));
    const normalizedDescriptionField = asRecord(normalizedTicketSection.description_clean);
    const normalizedRequesterNameField = asRecord(normalizedTicketSection.requester_name);
    const normalizedRequesterEmailField = asRecord(normalizedTicketSection.requester_email);
    const normalizedAffectedNameField = asRecord(normalizedTicketSection.affected_user_name);
    const normalizedAffectedEmailField = asRecord(normalizedTicketSection.affected_user_email);
    const normalizedDescription = String(
      normalizedDescriptionField.value || ''
    ).trim();
    const normalizedRequesterName = String(
      normalizedRequesterNameField.value || ''
    ).trim();
    const normalizedRequesterEmail = String(
      normalizedRequesterEmailField.value || ''
    ).trim();
    const normalizedAffectedName = String(
      normalizedAffectedNameField.value || ''
    ).trim();
    const normalizedAffectedEmail = String(
      normalizedAffectedEmailField.value || ''
    ).trim();

    const canonicalTicket = {
      id: String(ssotAutotask.ticket_number || ssot.ticket_id || ticketId || dbTicket.id || rawId),
      autotask_ticket_id_numeric: ssotAutotask.ticket_id_numeric ?? null,
      title: ssotAutotask.title ?? ssot.title ?? dbTicket.title ?? packTicket.title ?? null,
      description: ssotAutotask.description ?? ssot.description_clean ?? dbTicket.description ?? packTicket.description ?? null,
      description_normalized: ssot.description_clean ?? (normalizedDescription || null),
      requester: ssotAutotask.contact_name ?? ssot.requester_name ?? dbTicket.requester ?? packUser.name ?? null,
      requester_normalized: ssotAutotask.contact_name ?? ssot.requester_name ?? (normalizedRequesterName || null),
      requester_email_normalized: ssotAutotask.contact_email ?? ssot.requester_email ?? (normalizedRequesterEmail || null),
      affected_user_normalized: ssot.affected_user_name ?? (normalizedAffectedName || null),
      affected_user_email_normalized: ssot.affected_user_email ?? (normalizedAffectedEmail || null),
      company: ssotAutotask.company_name ?? ssot.company ?? dbTicket.company ?? packOrg.name ?? null,
      company_id: ssotAutotask.company_id ?? null,
      contact_id: ssotAutotask.contact_id ?? null,
      contact_name: ssotAutotask.contact_name ?? null,
      contact_email: ssotAutotask.contact_email ?? null,
      assigned_resource_id: ssotAutotask.assigned_resource_id ?? null,
      assigned_resource_name: ssotAutotask.assigned_resource_name ?? null,
      assigned_resource_email: ssotAutotask.assigned_resource_email ?? null,
      secondary_resource_id: ssotAutotask.secondary_resource_id ?? null,
      secondary_resource_name: ssotAutotask.secondary_resource_name ?? null,
      secondary_resource_email: ssotAutotask.secondary_resource_email ?? null,
      status: ssotAutotask.status ?? dbTicket.status ?? null,
      status_label: ssotAutotask.status_label ?? null,
      created_at:
        ssotAutotask.created_at ??
        dbTicket.created_at ??
        ssot.created_at ??
        sessionRow?.created_at ??
        null,
      priority: ssotAutotask.priority_id ?? dbTicket.priority ?? 'P3',
      priority_label: ssotAutotask.priority_label ?? null,
      issue_type: ssotAutotask.issue_type_id ?? dbTicket.issue_type ?? null,
      issue_type_label: ssotAutotask.issue_type_label ?? null,
      sub_issue_type: ssotAutotask.sub_issue_type_id ?? dbTicket.sub_issue_type ?? null,
      sub_issue_type_label: ssotAutotask.sub_issue_type_label ?? null,
      sla: ssotAutotask.service_level_agreement_id ?? dbTicket.sla ?? null,
      sla_label: ssotAutotask.service_level_agreement_label ?? null,
      normalization_audit: {
        round: round0Finding ? 0 : null,
        method: normalizationMethod || null,
        confidence: normalizationConfidence || null,
        source: round0Finding?.source || null,
      },
    };
    const authoritativeReviewed = await applyAutotaskReviewerOverlay(
      String(ticketId || rawId || ''),
      canonicalTicket,
      req.auth?.tid || null,
    );
    const canonicalTicketResolved = authoritativeReviewed?.ticket || canonicalTicket;
    const ticketNotes = await getAutotaskTicketNotesForFeed(
      String(canonicalTicketResolved.autotask_ticket_id_numeric || canonicalTicketResolved.id || ticketId || rawId || ''),
      req.auth?.tid || null,
    );

    const diagResult = await queryOne<{ payload: DiagnosisOutput | null }>(
      `SELECT payload
       FROM llm_outputs
       WHERE session_id = $1 AND step = 'diagnose'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    const diagnosis = diagResult ? diagResult.payload : null;

    const valResult = await queryOne<{
      status: string;
      violations: ValidationOutput['violations'];
      required_fixes: ValidationOutput['required_fixes'];
      req_questions: ValidationOutput['required_questions'];
      safe_to_proceed: boolean;
    }>(
      `SELECT status, violations, required_fixes, req_questions, safe_to_proceed
       FROM validation_results
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    const validation: ValidationOutput | null = valResult ? {
      status: valResult.status as ValidationOutput['status'],
      violations: valResult.violations,
      required_fixes: valResult.required_fixes,
      required_questions: valResult.req_questions,
      safe_to_generate_playbook: valResult.safe_to_proceed
    } : null;

    const playbookRow = await queryOne<{ content_md: string; content_json: JsonRecord | null }>(
      `SELECT content_md, content_json
       FROM playbooks
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    const playbookResult = await queryOne<{ payload: JsonRecord | null }>(
      `SELECT payload
       FROM llm_outputs
       WHERE session_id = $1 AND step = 'playbook'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    const playbook = playbookRow
      ? { content_md: playbookRow.content_md, ...(playbookRow.content_json || {}) }
      : (playbookResult ? playbookResult.payload : null);

    // ─── Trigger Background Processing ────────────────────────────
    /**
     * Helper to run processing in background without blocking response.
     * Sequentially fills in missing steps.
     */
    const triggerBackgroundProcessing = async () => {
      try {
        let currentPack = pack;
        let currentDiagnosis = diagnosis;
        let currentValidation: ValidationOutput | null = validation;

        // 1. Evidence Pack
        if (!currentPack) {
          operationalLogger.info('routes.ai.playbook.full_flow.background_prepare_context_started', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
          const contextService = new PrepareContextService();
          currentPack = await contextService.prepare({ sessionId, ticketId: rawId });
          await persistEvidencePack(sessionId, currentPack);
        }

        // 2. Diagnosis
        if (!currentDiagnosis && currentPack) {
          operationalLogger.info('routes.ai.playbook.full_flow.background_diagnose_started', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
          currentDiagnosis = await diagnoseEvidencePack(currentPack);

          await execute(
            `INSERT INTO llm_outputs (session_id, step, model, payload, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (session_id, step)
             DO UPDATE SET
               model = EXCLUDED.model,
               payload = EXCLUDED.payload,
               created_at = NOW()`,
            [sessionId, 'diagnose', currentDiagnosis.meta?.model || 'groq', JSON.stringify(currentDiagnosis)]
          );
        }

        const shouldRevalidate =
          !currentValidation ||
          (!currentValidation.safe_to_generate_playbook && !playbook);

        // 3. Validation
        if (shouldRevalidate && currentDiagnosis && currentPack) {
          operationalLogger.info('routes.ai.playbook.full_flow.background_validate_started', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
          currentValidation = await validateDiagnosis(currentDiagnosis, currentPack);
          const persistedRequiredFixes = [
            ...(currentValidation.required_fixes || []),
            ...(currentValidation.coverage_scores
              ? [`coverage_scores=${JSON.stringify(currentValidation.coverage_scores)}`]
              : []),
            ...(currentValidation.blocking_reasons?.length
              ? [`blocking_reasons=${JSON.stringify(currentValidation.blocking_reasons)}`]
              : []),
          ];
          const persistedQuestions = [
            ...(currentValidation.required_questions || []),
            ...(currentValidation.quality_gates
              ? [`quality_gates=${JSON.stringify(currentValidation.quality_gates)}`]
              : []),
          ];

          await execute(
            `INSERT INTO validation_results (session_id, status, violations, required_fixes, req_questions, safe_to_proceed, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (session_id)
             DO UPDATE SET
               status = EXCLUDED.status,
               violations = EXCLUDED.violations,
               required_fixes = EXCLUDED.required_fixes,
               req_questions = EXCLUDED.req_questions,
               safe_to_proceed = EXCLUDED.safe_to_proceed,
               created_at = NOW()`,
            [
              sessionId,
              currentValidation.status,
              JSON.stringify(currentValidation.violations),
              JSON.stringify(persistedRequiredFixes),
              JSON.stringify(persistedQuestions),
              currentValidation.safe_to_generate_playbook
            ]
          );
        }

        if (currentValidation && !currentValidation.safe_to_generate_playbook) {
          await execute(
            `UPDATE triage_sessions
             SET status = $1,
                 last_error = NULL,
                 retry_count = 0,
                 next_retry_at = NULL,
                 updated_at = NOW()
             WHERE id = $2`,
            [currentValidation.status, sessionId]
          );
          operationalLogger.info('routes.ai.playbook.full_flow.background_validation_blocked', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
            validation_status: currentValidation.status,
          }, { ticket_id: ticketId });
          return;
        }

        // 4. Playbook
        if (!playbook && currentValidation?.safe_to_generate_playbook && currentDiagnosis && currentPack) {
          operationalLogger.info('routes.ai.playbook.full_flow.background_playbook_started', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
          const generatedPlaybook = await generatePlaybook(currentDiagnosis, currentValidation, currentPack);

          await execute(
            `INSERT INTO llm_outputs (session_id, step, model, payload, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (session_id, step)
             DO UPDATE SET
               model = EXCLUDED.model,
               payload = EXCLUDED.payload,
               created_at = NOW()`,
            [sessionId, 'playbook', generatedPlaybook.meta?.model || 'groq', JSON.stringify(generatedPlaybook)]
          );

          // Also save in 'playbooks' table for final display
          await execute(
            `INSERT INTO playbooks (session_id, content_md, content_json, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (session_id)
             DO UPDATE SET
               content_md = EXCLUDED.content_md,
               content_json = EXCLUDED.content_json,
               created_at = NOW()`,
            [sessionId, generatedPlaybook.content_md, JSON.stringify(generatedPlaybook)]
          );

          // Update session status to approved since it's an automated flow
          await execute(
            `UPDATE triage_sessions
             SET status = $1,
                 last_error = NULL,
                 retry_count = 0,
                 next_retry_at = NULL,
                 updated_at = NOW()
             WHERE id = $2`,
            ['approved', sessionId]
          );
        }

        operationalLogger.info('routes.ai.playbook.full_flow.background_completed', {
          module: 'routes.ai.playbook',
          session_id: sessionId,
        }, { ticket_id: ticketId });
      } catch (bgErr) {
        operationalLogger.error('routes.ai.playbook.full_flow.background_failed', bgErr, {
          module: 'routes.ai.playbook',
          session_id: sessionId,
          signal: 'integration_failure',
          degraded_mode: true,
        }, { ticket_id: ticketId });
        const bgMessage = String(asRecord(bgErr).message ?? bgErr ?? '');
        if (isMissingAutotaskTicketError(bgErr)) {
          await markSessionDeletedFromAutotask(sessionId, ticketId, sessionTenantId, bgMessage);
          operationalLogger.info('routes.ai.playbook.full_flow.stale_ticket_removed', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
            reason: 'autotask_ticket_missing_during_full_flow',
          }, {
            tenant_id: sessionTenantId,
            ticket_id: ticketId,
          });
        } else if (isTransientProviderError(bgErr)) {
          await markSessionPendingForRetry(sessionId, bgMessage);
        } else {
          await execute(
            `UPDATE triage_sessions
             SET status = 'failed',
                 last_error = $1,
                 retry_count = 0,
                 next_retry_at = NULL,
                 updated_at = NOW()
             WHERE id = $2`,
            [bgMessage, sessionId]
          );
        }
      }
    };

    const needsBackgroundProcessing =
      !pack ||
      !diagnosis ||
      !validation ||
      (!playbook && (validation?.safe_to_generate_playbook ?? true));

    if (needsBackgroundProcessing && manuallySuppressed) {
      operationalLogger.info('routes.ai.playbook.full_flow.background_skipped_manual_suppression', {
        module: 'routes.ai.playbook',
        session_id: sessionId,
      }, { ticket_id: ticketId });
      if (sessionRow?.id && ['pending', 'processing', 'failed'].includes(String(sessionRow.status || ''))) {
        await execute(
          `UPDATE triage_sessions
           SET status = 'blocked',
               last_error = 'manual suppression',
               retry_count = 0,
               next_retry_at = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [sessionRow.id]
        );
        sessionRow = { ...sessionRow, status: 'blocked', last_error: 'manual suppression', retry_count: 0, next_retry_at: null };
      }
    } else if (needsBackgroundProcessing) {
      const nextRetryAt = sessionRow?.next_retry_at ? new Date(sessionRow.next_retry_at) : null;
      const retryBlocked =
        sessionRow?.status === 'pending' &&
        nextRetryAt &&
        !Number.isNaN(nextRetryAt.getTime()) &&
        nextRetryAt.getTime() > Date.now();
      if (retryBlocked) {
        operationalLogger.info('routes.ai.playbook.full_flow.background_skipped_retry_backoff', {
          module: 'routes.ai.playbook',
          session_id: sessionId,
          next_retry_at: nextRetryAt?.toISOString() || null,
        }, { ticket_id: ticketId });
      } else if (fullFlowInFlight.has(sessionId)) {
        operationalLogger.info('routes.ai.playbook.full_flow.background_skipped_inflight', {
          module: 'routes.ai.playbook',
          session_id: sessionId,
        }, { ticket_id: ticketId });
      } else {
        const claimedForBackground = await claimSessionForFullFlowBackground(sessionId);
        if (!claimedForBackground) {
          operationalLogger.info('routes.ai.playbook.full_flow.background_skipped_claimed_elsewhere', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
        } else {
          operationalLogger.info('routes.ai.playbook.full_flow.background_scheduled', {
            module: 'routes.ai.playbook',
            session_id: sessionId,
          }, { ticket_id: ticketId });
          if (sessionRow?.id === sessionId) {
            sessionRow = {
              ...sessionRow,
              status: 'processing',
              last_error: null,
            };
          }
          fullFlowInFlight.add(sessionId);
          void triggerBackgroundProcessing().finally(() => {
            fullFlowInFlight.delete(sessionId);
          });
        }
      }
    } else {
      operationalLogger.info('routes.ai.playbook.full_flow.background_not_needed', {
        module: 'routes.ai.playbook',
        session_id: sessionId,
      }, { ticket_id: ticketId });
    }

    return res.json({
      sessionId,
      session: sessionRow ?? { id: sessionId, ticket_id: ticketId, status: 'pending' },
      flow: {
        evidence_pack: pack ? '✅ Ready' : (manuallySuppressed ? '⛔ Suppressed' : '⏳ Processing'),
        diagnosis: diagnosis ? '✅ Ready' : (manuallySuppressed ? '⛔ Suppressed' : '⏳ Waiting'),
        validation: validation ? '✅ Ready' : (manuallySuppressed ? '⛔ Suppressed' : '⏳ Waiting'),
        playbook: playbook ? '✅ Ready' : (manuallySuppressed ? '⛔ Suppressed' : '⏳ Waiting'),
      },
      data: {
        ticket: canonicalTicketResolved,
        ticket_notes: ticketNotes,
        authoritative_review: authoritativeReviewed?.review || {
          source: 'autotask',
          applied: false,
          ticket_ref: String(ticketId || rawId || ''),
          divergences: [],
        },
        suppression: {
          manual_suppressed: manuallySuppressed,
          effective_suppressed: manuallySuppressed,
        },
        ssot,
        ticket_text_artifact: ticketTextArtifact?.payload || null,
        ticket_context_appendix: ticketContextAppendix?.payload || null,
        pack,
        diagnosis,
        validation,
        playbook,
      },
    });
  } catch (err) {
    operationalLogger.error('routes.ai.playbook.full_flow.failed', err, {
      module: 'routes.ai.playbook',
      signal: 'integration_failure',
      degraded_mode: true,
    });
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── POST /playbook ─────────────────────────────────────────
/**
 * @route POST /playbook
 * @param {string} sessionId - Session ID with validation complete
 * @returns {PlaybookOutput}
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // ─── Get evidence pack ────────────────────────────────────────
    let pack = await getEvidencePack(sessionId);

    if (!pack) {
      const result = await queryOne<{ payload: string }>(
        `SELECT payload
         FROM evidence_packs
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId]
      );
      if (result) {
        pack = JSON.parse(result.payload);
      }
    }

    if (!pack) {
      return res.status(404).json({
        error: 'Evidence pack not found',
        sessionId,
      });
    }

    // ─── Get diagnosis ────────────────────────────────────────────
    const diagResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'diagnose'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (!diagResult) {
      return res.status(404).json({
        error: 'Diagnosis not found',
        sessionId,
      });
    }

    const diagnosis = JSON.parse(diagResult.payload);

    // ─── Get validation ───────────────────────────────────────────
    const valResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'validation'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (!valResult) {
      return res.status(404).json({
        error: 'Validation not found',
        sessionId,
      });
    }

    const validation = JSON.parse(valResult.payload);

    // ─── Generate playbook ────────────────────────────────────────
    operationalLogger.info('routes.ai.playbook.generate.started', {
      module: 'routes.ai.playbook',
      session_id: sessionId,
    });
    const playbook = await generatePlaybook(diagnosis, validation, pack);
    operationalLogger.info('routes.ai.playbook.generate.completed', {
      module: 'routes.ai.playbook',
      session_id: sessionId,
      output_tokens: playbook.meta?.output_tokens || 0,
    });

    // ─── Persist playbook ─────────────────────────────────────────
    await execute(
      `INSERT INTO llm_outputs (session_id, step, payload, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, step) DO UPDATE SET payload = $3, created_at = NOW()`,
      [sessionId, 'playbook', JSON.stringify(playbook)]
    );

    // ─── Update session status ────────────────────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['approved', sessionId]
    );

    return res.json({
      sessionId,
      playbook,
    });
  } catch (err) {
    operationalLogger.error('routes.ai.playbook.generate.failed', err, {
      module: 'routes.ai.playbook',
      signal: 'integration_failure',
      degraded_mode: true,
    });
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /playbook/:sessionId ───────────────────────────────
/**
 * @route GET /playbook/:sessionId
 * @returns {PlaybookOutput | null}
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Skip if not a valid UUID (avoids Postgres crashes if route clashes)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isUuid) return res.status(400).json({ error: 'Invalid UUID format' });

    const result = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'playbook'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.payload);
    return res.json({ sessionId, playbook });
  } catch (err) {
    operationalLogger.error('routes.ai.playbook.get.failed', err, {
      module: 'routes.ai.playbook',
      signal: 'integration_failure',
      degraded_mode: true,
    });
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /playbook/:sessionId/markdown ──────────────────────
/**
 * @route GET /playbook/:sessionId/markdown
 * Returns raw Markdown for display/rendering
 */
router.get('/:sessionId/markdown', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'playbook'
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.payload);

    // ─── Return raw markdown for rendering ──────────────────────
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(playbook.content_md);
  } catch (err) {
    operationalLogger.error('routes.ai.playbook.markdown_get.failed', err, {
      module: 'routes.ai.playbook',
      signal: 'integration_failure',
      degraded_mode: true,
    });
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});



export default router;
