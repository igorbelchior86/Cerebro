// ─────────────────────────────────────────────────────────────
// Playbook Routes — Generate & Retrieve Playbooks
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import type { PlaybookOutput, ValidationOutput } from '@playbook-brain/types';
import { generatePlaybook } from '../services/playbook-writer.js';
import {
  getEvidencePack,
  getTicketContextAppendix,
  getTicketTextArtifact,
  persistEvidencePack,
} from '../services/prepare-context.js';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute, transaction } from '../db/index.js';
import { diagnoseEvidencePack } from '../services/diagnose.js';
import { validateDiagnosis } from '../services/validate-policy.js';
import { PrepareContextService } from '../services/prepare-context.js';
import { AutotaskClient } from '../clients/autotask.js';

const router: Router = Router();
const fullFlowInFlight = new Set<string>();
const FULL_FLOW_SESSION_CREATE_LOCK_NAMESPACE = 41022;
const FULL_FLOW_RETRY_BASE_DELAY_MS = 2 * 60 * 1000;
const FULL_FLOW_RETRY_MAX_DELAY_MS = 30 * 60 * 1000;

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

type AuthoritativeFieldDiff = {
  field: string;
  local: unknown;
  autotask: unknown;
};

async function getAutotaskClientForReviewer(): Promise<AutotaskClient | null> {
  const row = await queryOne<{ credentials: AutotaskCreds }>(
    `SELECT credentials
     FROM integration_credentials
     WHERE service = 'autotask'
     ORDER BY updated_at DESC
     LIMIT 1`
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
  localTicket: Record<string, unknown>
): Promise<{
  ticket: Record<string, unknown>;
  review: {
    source: 'autotask';
    applied: true;
    ticket_ref: string;
    divergences: AuthoritativeFieldDiff[];
  };
} | null> {
  const client = await getAutotaskClientForReviewer();
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

  const companyId = Number((remoteTicket as any)?.companyID);
  const contactId = Number((remoteTicket as any)?.contactID);
  const primaryResourceId = Number((remoteTicket as any)?.assignedResourceID);
  const secondaryResourceId = Number((remoteTicket as any)?.secondaryResourceID);
  const queueId = Number((remoteTicket as any)?.queueID);

  const [company, contact, primaryResource, secondaryResource, queueOptions] = await Promise.all([
    Number.isFinite(companyId) ? client.getCompany(companyId).catch(() => null) : Promise.resolve(null),
    Number.isFinite(contactId) ? client.getContact(contactId).catch(() => null) : Promise.resolve(null),
    Number.isFinite(primaryResourceId) ? client.getResource(primaryResourceId).catch(() => null) : Promise.resolve(null),
    Number.isFinite(secondaryResourceId) ? client.getResource(secondaryResourceId).catch(() => null) : Promise.resolve(null),
    client.getTicketQueues().catch(() => []),
  ]);

  const queueLabelMap = new Map<number, string>();
  for (const option of queueOptions || []) {
    const id = Number((option as any)?.id);
    const label = String((option as any)?.label || '').trim();
    if (Number.isFinite(id) && label) queueLabelMap.set(id, label);
  }

  const contactName = `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim();
  const primaryName = `${String((primaryResource as any)?.firstName || '').trim()} ${String((primaryResource as any)?.lastName || '').trim()}`.trim();
  const secondaryName = `${String((secondaryResource as any)?.firstName || '').trim()} ${String((secondaryResource as any)?.lastName || '').trim()}`.trim();

  const authoritativeOverlay: Record<string, unknown> = {
    company_id: Number.isFinite(companyId) ? companyId : null,
    company: String((company as any)?.companyName || (remoteTicket as any)?.companyName || '').trim() || null,
    contact_id: Number.isFinite(contactId) ? contactId : null,
    contact_name: contactName || null,
    contact_email: String((contact as any)?.emailAddress || '').trim() || null,
    status: (remoteTicket as any)?.status ?? null,
    priority: (remoteTicket as any)?.priority ?? null,
    additional_contacts: (remoteTicket as any)?.additionalContactIDs ?? null,
    issue_type: (remoteTicket as any)?.issueType ?? null,
    sub_issue_type: (remoteTicket as any)?.subIssueType ?? null,
    source: (remoteTicket as any)?.source ?? null,
    due_date: (remoteTicket as any)?.dueDateTime ?? (remoteTicket as any)?.dueDate ?? null,
    sla: (remoteTicket as any)?.serviceLevelAgreementID ?? null,
    queue_id: Number.isFinite(queueId) ? queueId : null,
    queue_name: Number.isFinite(queueId) ? (queueLabelMap.get(queueId) || null) : null,
    assigned_resource_id: Number.isFinite(primaryResourceId) ? primaryResourceId : null,
    assigned_resource_name: primaryName || null,
    assigned_resource_email: String((primaryResource as any)?.email || '').trim() || null,
    secondary_resource_id: Number.isFinite(secondaryResourceId) ? secondaryResourceId : null,
    secondary_resource_name: secondaryName || null,
    secondary_resource_email: String((secondaryResource as any)?.email || '').trim() || null,
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

async function resolveOrCreateFullFlowSession(ticketId: string, tenantId: string | null): Promise<{ id: string; created: boolean }> {
  return transaction(async (client) => {
    await client.query(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [FULL_FLOW_SESSION_CREATE_LOCK_NAMESPACE, ticketId]
    );

    const existing = await client.query<{ id: string }>(
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
      [uuidv4(), ticketId, 'pending', '00000000-0000-0000-0000-000000000000', tenantId]
    );
    const newSession = inserted.rows[0];
    if (!newSession) {
      throw new Error('Failed to create triage session');
    }
    return { id: newSession.id, created: true };
  });
}

function isTransientProviderError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if ((error as any)?.name === 'LLMQuotaExceededError') return true;
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

    console.log(`[FULL-FLOW] Starting complete flow for ${rawId}`);

    // Resolve Session ID
    let sessionId = rawId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    if (!isUuid) {
      const tenantId = req.auth?.tid || null;
      const resolvedSession = await resolveOrCreateFullFlowSession(rawId, tenantId);
      if (resolvedSession.created) {
        console.log(`[FULL-FLOW] Creating new session for ticket ${rawId}`);
      } else {
        console.log(`[FULL-FLOW] Found existing session ${resolvedSession.id} for ticket ${rawId}`);
      }
      sessionId = resolvedSession.id;

      // Return initializing state but let background processing continue
      // We set pack/diagnosis/etc to null to trigger background logic later
    }

    console.log(`[FULL-FLOW] Using sessionId: ${sessionId}`);
    let sessionRow = await queryOne<{
      id: string;
      ticket_id: string;
      status: string;
      retry_count: number | null;
      next_retry_at: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, ticket_id, status, retry_count, next_retry_at, last_error, created_at, updated_at
       FROM triage_sessions
       WHERE id = $1
       LIMIT 1`,
      [sessionId]
    );
    const ticketId = sessionRow?.ticket_id || rawId;

    if (forceRefresh && sessionRow?.id) {
      console.log(`[FULL-FLOW] Force refresh requested for ${sessionId} / ticket ${ticketId}`);
      const existingPack = await queryOne<{ payload: any }>(
        `SELECT ep.payload
         FROM evidence_packs ep
         WHERE ep.session_id = $1
         ORDER BY ep.created_at DESC
         LIMIT 1`,
        [sessionId]
      );
      const existingOrgId = String(existingPack?.payload?.org?.id || '').trim();
      const existingNinjaOrgId = String(
        existingPack?.payload?.device?.organizationId ||
        existingPack?.payload?.device?.organization_id ||
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
          status: string;
          retry_count: number | null;
          next_retry_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT id, ticket_id, status, retry_count, next_retry_at, last_error, created_at, updated_at
           FROM triage_sessions
           WHERE id = $1
           LIMIT 1`,
          [sessionId]
        );
        console.log(`[FULL-FLOW] Force refresh restarted pipeline with new session ${sessionId} for ticket ${ticketId}`);
      }
    }

    // Get all the data
    console.log('[FULL-FLOW] Fetching Evidence Pack...');
    let pack = await getEvidencePack(sessionId);
    if (!pack) {
      const result = await queryOne<{ payload: any }>(
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
      console.log(`[FULL-FLOW] Evidence pack NOT found for ${sessionId}. Will trigger background preparation.`);
      // Continue execution so background processing can start
    } else {
      console.log(`[FULL-FLOW] Evidence pack found, status: ✅`);
    }
    const ticketResult = await queryOne<{ payload: any }>(
      `SELECT to_jsonb(tp) AS payload
       FROM tickets_processed tp
       WHERE tp.id = $1
       ORDER BY tp.created_at DESC
       LIMIT 1`,
      [ticketId]
    );
    const packTicket = (pack as any)?.ticket || {};
    const packOrg = (pack as any)?.org || {};
    const packUser = (pack as any)?.user || {};
    const normalizedTicketSection = (pack as any)?.iterative_enrichment?.sections?.ticket || {};
    const round0Finding = Array.isArray((pack as any)?.source_findings)
      ? (pack as any).source_findings.find((f: any) => Number(f?.round) === 0)
      : null;
    const round0Details = Array.isArray(round0Finding?.details) ? round0Finding.details : [];
    const normalizationMethod = String(
      round0Details.find((d: string) => String(d).startsWith('method:')) || ''
    ).replace('method:', '').trim();
    const normalizationConfidence = String(
      round0Details.find((d: string) => String(d).startsWith('confidence:')) || ''
    ).replace('confidence:', '').trim();
    const dbTicket = ticketResult?.payload || {};
    const manuallySuppressed = Boolean((dbTicket as any)?.manual_suppressed);
    const ssotResult = await queryOne<{ payload: any }>(
      `SELECT payload FROM ticket_ssot WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [String(ticketId || rawId || '')]
    );
    const ssot = ssotResult?.payload || null;
    const ticketTextArtifact = await getTicketTextArtifact(String(ticketId || rawId || ''));
    const ticketContextAppendix = await getTicketContextAppendix(String(ticketId || rawId || ''));
    const normalizedDescription = String(
      normalizedTicketSection?.description_clean?.value || ''
    ).trim();
    const normalizedRequesterName = String(
      normalizedTicketSection?.requester_name?.value || ''
    ).trim();
    const normalizedRequesterEmail = String(
      normalizedTicketSection?.requester_email?.value || ''
    ).trim();
    const normalizedAffectedName = String(
      normalizedTicketSection?.affected_user_name?.value || ''
    ).trim();
    const normalizedAffectedEmail = String(
      normalizedTicketSection?.affected_user_email?.value || ''
    ).trim();

    const canonicalTicket = {
      id: String(ssot?.autotask_authoritative?.ticket_number || ssot?.ticket_id || ticketId || dbTicket.id || rawId),
      autotask_ticket_id_numeric: ssot?.autotask_authoritative?.ticket_id_numeric ?? null,
      title: ssot?.autotask_authoritative?.title ?? ssot?.title ?? dbTicket.title ?? packTicket.title ?? null,
      description: ssot?.autotask_authoritative?.description ?? ssot?.description_clean ?? dbTicket.description ?? packTicket.description ?? null,
      description_normalized: ssot?.description_clean ?? (normalizedDescription || null),
      requester: ssot?.autotask_authoritative?.contact_name ?? ssot?.requester_name ?? dbTicket.requester ?? packUser.name ?? null,
      requester_normalized: ssot?.autotask_authoritative?.contact_name ?? ssot?.requester_name ?? (normalizedRequesterName || null),
      requester_email_normalized: ssot?.autotask_authoritative?.contact_email ?? ssot?.requester_email ?? (normalizedRequesterEmail || null),
      affected_user_normalized: ssot?.affected_user_name ?? (normalizedAffectedName || null),
      affected_user_email_normalized: ssot?.affected_user_email ?? (normalizedAffectedEmail || null),
      company: ssot?.autotask_authoritative?.company_name ?? ssot?.company ?? dbTicket.company ?? packOrg.name ?? null,
      company_id: ssot?.autotask_authoritative?.company_id ?? null,
      contact_id: ssot?.autotask_authoritative?.contact_id ?? null,
      contact_name: ssot?.autotask_authoritative?.contact_name ?? null,
      contact_email: ssot?.autotask_authoritative?.contact_email ?? null,
      assigned_resource_id: ssot?.autotask_authoritative?.assigned_resource_id ?? null,
      assigned_resource_name: ssot?.autotask_authoritative?.assigned_resource_name ?? null,
      assigned_resource_email: ssot?.autotask_authoritative?.assigned_resource_email ?? null,
      created_at: ssot?.created_at ?? dbTicket.created_at ?? sessionRow?.created_at ?? null,
      priority: dbTicket.priority ?? 'P3',
      normalization_audit: {
        round: round0Finding ? 0 : null,
        method: normalizationMethod || null,
        confidence: normalizationConfidence || null,
        source: round0Finding?.source || null,
      },
    };
    const authoritativeReviewed = await applyAutotaskReviewerOverlay(String(ticketId || rawId || ''), canonicalTicket);
    const canonicalTicketResolved = authoritativeReviewed?.ticket || canonicalTicket;

    const diagResult = await queryOne<{ payload: any }>(
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
      violations: any;
      required_fixes: any;
      req_questions: any;
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
      status: valResult.status as any,
      violations: valResult.violations,
      required_fixes: valResult.required_fixes,
      required_questions: valResult.req_questions,
      safe_to_generate_playbook: valResult.safe_to_proceed
    } : null;

    const playbookRow = await queryOne<{ content_md: string; content_json: any }>(
      `SELECT content_md, content_json
       FROM playbooks
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    const playbookResult = await queryOne<{ payload: any }>(
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
          console.log(`[FULL-FLOW] Background: Preparing Evidence for ${sessionId}`);
          const contextService = new PrepareContextService();
          currentPack = await contextService.prepare({ sessionId, ticketId: rawId });
          await persistEvidencePack(sessionId, currentPack);
        }

        // 2. Diagnosis
        if (!currentDiagnosis && currentPack) {
          console.log(`[FULL-FLOW] Background: Generating Diagnosis for ${sessionId}`);
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
          console.log(`[FULL-FLOW] Background: Validating Diagnosis for ${sessionId}`);
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

        // 4. Playbook
        if (!playbook && currentValidation?.safe_to_generate_playbook && currentDiagnosis && currentPack) {
          console.log(`[FULL-FLOW] Background: Generating Playbook for ${sessionId}`);
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

        console.log(`[FULL-FLOW] Background processing complete for ${sessionId}`);
      } catch (bgErr) {
        console.error(`[FULL-FLOW] Background error for ${sessionId}:`, bgErr);
        const bgMessage = String((bgErr as any)?.message || bgErr || '');
        if (isTransientProviderError(bgErr)) {
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
      console.log(`[FULL-FLOW] Ticket ${ticketId} is manually suppressed. Skipping background trigger.`);
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
        console.log(
          `[FULL-FLOW] Retry backoff active for ${sessionId} until ${nextRetryAt?.toISOString()}. Skipping background trigger.`
        );
      } else 
      if (fullFlowInFlight.has(sessionId)) {
        console.log(`[FULL-FLOW] Background already running for ${sessionId}. Skipping duplicate trigger.`);
      } else {
        console.log(`[FULL-FLOW] Scheduling background processing for ${sessionId}`);
        fullFlowInFlight.add(sessionId);
        void triggerBackgroundProcessing().finally(() => {
          fullFlowInFlight.delete(sessionId);
        });
      }
    } else {
      console.log(`[FULL-FLOW] All artifacts already ready for ${sessionId}. No background trigger needed.`);
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
    console.error('[FULL-FLOW] Error:', err);
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
    console.log(`[PLAYBOOK] Generating playbook for session ${sessionId}`);
    const playbook = await generatePlaybook(diagnosis, validation, pack);
    console.log(
      `[PLAYBOOK] Generated ${playbook.meta?.output_tokens || 0} tokens`
    );

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
    console.error('[PLAYBOOK] Error:', err);
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
    console.error('[PLAYBOOK] GET Error:', err);
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
    console.error('[PLAYBOOK] Markdown GET Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});



export default router;
