import { v4 as uuidv4 } from 'uuid';
import { execute, query, transaction } from '../../db/index.js';
import type { PoolClient } from 'pg';
import type { DiagnosisOutput, EvidencePack, PlaybookOutput, ValidationOutput } from '@cerebro/types';
import { tenantContext } from '../../lib/tenantContext.js';
import { PrepareContextService, persistEvidencePack } from '../context/prepare-context.js';
import { DiagnoseService } from '../ai/diagnose.js';
import { ValidatePolicyService, isSafeToGenerate } from '../domain/validate-policy.js';
import { PlaybookWriterService } from '../ai/playbook-writer.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import { workflowService } from './workflow-runtime.js';

type TriageSessionStatus = 'pending' | 'processing' | 'approved' | 'needs_more_info' | 'blocked' | 'failed';
type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as JsonRecord)
        : {};
}

function readModelName(output: unknown): string {
    const meta = asJsonRecord(asJsonRecord(output).meta);
    const model = String(meta.model || '').trim();
    return model || 'groq';
}

function readErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error || '');
}

function readErrorName(error: unknown): string {
    if (error instanceof Error) return error.name;
    return String(asJsonRecord(error).name || '');
}

function toTriageSessionStatus(status: unknown): TriageSessionStatus {
    switch (String(status || '').trim()) {
        case 'pending':
        case 'processing':
        case 'approved':
        case 'needs_more_info':
        case 'blocked':
        case 'failed':
            return String(status) as TriageSessionStatus;
        default:
            return 'failed';
    }
}

function readPositiveMs(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

export class TriageOrchestrator {
    private prepareService: PrepareContextService;
    private diagnoseService: DiagnoseService;
    private validateService: ValidatePolicyService;
    private playbookService: PlaybookWriterService;
    private retryIntervalId: NodeJS.Timeout | null = null;
    private isRetrySweepRunning = false;
    private readonly retryBaseDelayMs = 2 * 60 * 1000;
    private readonly retryMaxDelayMs = 30 * 60 * 1000;
    private readonly advisoryLockNamespace = 41021;
    private readonly stageTimeoutMs = readPositiveMs(process.env.TRIAGE_STAGE_TIMEOUT_MS, 90_000);
    private readonly queueWaitWarnMs = readPositiveMs(process.env.TRIAGE_QUEUE_WAIT_WARN_MS, 5_000);
    private hasManualSuppressedColumnCache: boolean | null = null;
    private pipelineQueue: Promise<void> = Promise.resolve();
    private queuedPipelines = 0;

    constructor() {
        this.prepareService = new PrepareContextService();
        this.diagnoseService = new DiagnoseService();
        this.validateService = new ValidatePolicyService();
        this.playbookService = new PlaybookWriterService();
    }

    /**
     * Start a background listener to retry pending/stale sessions.
     */
    startRetryListener() {
        if (this.retryIntervalId) return;
        operationalLogger.info('orchestration.triage.retry_listener_started', {
            module: 'orchestration.triage-orchestrator',
            interval_ms: 2 * 60 * 1000,
        });

        // Execute immediately on startup
        this.processPendingSessions().catch(err =>
            operationalLogger.error('orchestration.triage.initial_pending_processing_failed', err, {
                module: 'orchestration.triage-orchestrator',
                signal: 'integration_failure',
                degraded_mode: true,
            })
        );

        this.retryIntervalId = setInterval(() => {
            this.processPendingSessions().catch(err =>
                operationalLogger.error('orchestration.triage.pending_processing_failed', err, {
                    module: 'orchestration.triage-orchestrator',
                    signal: 'integration_failure',
                    degraded_mode: true,
                })
            );
        }, 2 * 60 * 1000);
        this.retryIntervalId.unref?.();
    }

    private async processPendingSessions() {
        if (this.isRetrySweepRunning) {
            operationalLogger.info('orchestration.triage.retry_sweep_overlap_skipped', {
                module: 'orchestration.triage-orchestrator',
            });
            return;
        }

        this.isRetrySweepRunning = true;
        try {
            return tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
                // Find sessions that are 'pending' or 'processing' but stale (> 10 mins)
                // Limit to 5 per cycle to avoid hammering the API
                const staleSessions = await query<{ ticket_id: string; tenant_id: string | null }>(
                    `SELECT ticket_id, tenant_id FROM triage_sessions 
                     WHERE (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
                     OR (status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes')
                     ORDER BY updated_at ASC
                     LIMIT 5`
                );

                if (staleSessions.length === 0) return;

                operationalLogger.info('orchestration.triage.retry_sweep_batch_found', {
                    module: 'orchestration.triage-orchestrator',
                    batch_size: staleSessions.length,
                });
                let quotaHit = false;

                for (const s of staleSessions) {
                    if (quotaHit) {
                        operationalLogger.info('orchestration.triage.retry_sweep_quota_stop', {
                            module: 'orchestration.triage-orchestrator',
                        });
                        break;
                    }

                    try {
                        await this.runPipeline(s.ticket_id, undefined, 'autotask', s.tenant_id || undefined);
                    } catch (err) {
                        const message = readErrorMessage(err).toLowerCase();
                        operationalLogger.error('orchestration.triage.retry_sweep_ticket_failed', err, {
                            module: 'orchestration.triage-orchestrator',
                            signal: 'integration_failure',
                            degraded_mode: true,
                        }, { ticket_id: s.ticket_id });
                        if (this.isTransientProviderError(message) || readErrorName(err) === 'LLMQuotaExceededError') {
                            quotaHit = true;
                        }
                    }

                    // Delay 10s between tickets to avoid rate-limiting bursts
                    if (!quotaHit) {
                        await new Promise(resolve => setTimeout(resolve, 10_000));
                    }
                }
            });
        } finally {
            this.isRetrySweepRunning = false;
        }
    }

    /**
     * Run the full triage pipeline for a ticket.
     * System-triggered pipeline always bypasses tenant RLS checks.
     */
    async runPipeline(
        ticketId: string,
        orgId?: string,
        source: 'email' | 'autotask' = 'autotask',
        tenantId?: string,
    ) {
        const enqueuedAt = Date.now();
        this.queuedPipelines += 1;
        const runCore = async () => {
            this.queuedPipelines = Math.max(0, this.queuedPipelines - 1);
            const queueWaitMs = Date.now() - enqueuedAt;
            if (queueWaitMs >= this.queueWaitWarnMs) {
                operationalLogger.warn('orchestration.triage.pipeline_queue_wait_detected', {
                    module: 'orchestration.triage-orchestrator',
                    queue_wait_ms: queueWaitMs,
                    queue_wait_warn_ms: this.queueWaitWarnMs,
                    queued_pipelines: this.queuedPipelines,
                    degraded_mode: true,
                }, { ticket_id: ticketId });
            }
            await this.runPipelineCore(ticketId, orgId, source, tenantId);
        };

        const scheduled = this.pipelineQueue.then(runCore, runCore);
        this.pipelineQueue = scheduled.then(() => undefined, () => undefined);
        return scheduled;
    }

    private async withStageTimeout<T>(
        stage: 'prepare_context' | 'diagnose' | 'playbook',
        operation: Promise<T>,
        ticketId: string,
        sessionId: string
    ): Promise<T> {
        const startedAt = Date.now();
        let timeoutHandle: NodeJS.Timeout | null = null;
        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`triage_stage_timeout:${stage}:${this.stageTimeoutMs}ms`));
                }, this.stageTimeoutMs);
            });
            const result = await Promise.race([operation, timeoutPromise]);
            operationalLogger.info('orchestration.triage.stage_completed', {
                module: 'orchestration.triage-orchestrator',
                session_id: sessionId,
                stage,
                duration_ms: Date.now() - startedAt,
            }, { ticket_id: ticketId });
            return result as T;
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
        }
    }

    private async runPipelineCore(
        ticketId: string,
        orgId?: string,
        source: 'email' | 'autotask' = 'autotask',
        tenantId?: string,
    ) {
        return tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
            operationalLogger.info('orchestration.triage.pipeline_started', {
                module: 'orchestration.triage-orchestrator',
                source,
            }, { ticket_id: ticketId });
            if (await this.isTicketManuallySuppressed(ticketId)) {
                operationalLogger.info('orchestration.triage.pipeline_skipped_manual_suppression', {
                    module: 'orchestration.triage-orchestrator',
                }, { ticket_id: ticketId });
                await this.markLatestSessionBlockedBySuppression(ticketId);
                return;
            }
            const claimed = await this.claimOrCreateSession(ticketId, orgId, tenantId);
            if (!claimed) return;
                const sid = claimed;
                const syncWorkflowProjection = async (input: {
                    pack?: EvidencePack | null;
                    diagnosis?: DiagnosisOutput | null;
                    validation?: ValidationOutput | null;
                    playbook?: PlaybookOutput | null;
                }) => {
                    const resolvedTenantId = String(tenantId || '').trim();
                    if (!resolvedTenantId) return;
                    await workflowService.syncAnalysisProjection({
                        tenantId: resolvedTenantId,
                        ticketRef: ticketId,
                        sessionId: sid,
                        pack: input.pack,
                        diagnosis: input.diagnosis,
                        validation: input.validation,
                        playbook: input.playbook,
                    });
                };

            try {
                // PHASE 1: Prepare Context
                operationalLogger.info('orchestration.triage.phase_prepare_context_started', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                }, { ticket_id: ticketId });
                const pack = await this.withStageTimeout(
                    'prepare_context',
                    this.prepareService.prepare({
                        sessionId: sid,
                        ticketId,
                        ...(orgId ? { orgId } : {}),
                    }),
                    ticketId,
                    sid
                );
                await persistEvidencePack(sid, pack);
                await syncWorkflowProjection({ pack });

                // PHASE 2: Diagnose
                operationalLogger.info('orchestration.triage.phase_diagnose_started', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                }, { ticket_id: ticketId });
                const diagnosis = await this.withStageTimeout(
                    'diagnose',
                    this.diagnoseService.diagnose(pack),
                    ticketId,
                    sid
                );
                await execute(
                    `INSERT INTO llm_outputs (id, session_id, step, model, payload, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (session_id, step)
                     DO UPDATE SET
                       model = EXCLUDED.model,
                       payload = EXCLUDED.payload,
                       created_at = NOW()`,
                    [
                        uuidv4(),
                        sid,
                        'diagnose',
                        readModelName(diagnosis),
                        JSON.stringify(diagnosis),
                    ]
                );
                await syncWorkflowProjection({ pack, diagnosis });

                // PHASE 3: Validate
                operationalLogger.info('orchestration.triage.phase_validate_started', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                }, { ticket_id: ticketId });
                const validation = this.validateService.validate(diagnosis, pack);
                const persistedRequiredFixes = [
                    ...(validation.required_fixes || []),
                    ...(validation.coverage_scores
                        ? [`coverage_scores=${JSON.stringify(validation.coverage_scores)}`]
                        : []),
                    ...(validation.blocking_reasons?.length
                        ? [`blocking_reasons=${JSON.stringify(validation.blocking_reasons)}`]
                        : []),
                ];
                const persistedQuestions = [
                    ...(validation.required_questions || []),
                    ...(validation.quality_gates
                        ? [`quality_gates=${JSON.stringify(validation.quality_gates)}`]
                        : []),
                ];
                await execute(
                    `INSERT INTO validation_results (
                        id, session_id, status, violations, required_fixes, req_questions, safe_to_proceed, created_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                     ON CONFLICT (session_id)
                     DO UPDATE SET
                       status = EXCLUDED.status,
                       violations = EXCLUDED.violations,
                       required_fixes = EXCLUDED.required_fixes,
                       req_questions = EXCLUDED.req_questions,
                       safe_to_proceed = EXCLUDED.safe_to_proceed,
                       created_at = NOW()`,
                    [
                        uuidv4(),
                        sid,
                        validation.status,
                        JSON.stringify(validation.violations || []),
                        JSON.stringify(persistedRequiredFixes),
                        JSON.stringify(persistedQuestions),
                        validation.safe_to_generate_playbook,
                    ]
                );
                await syncWorkflowProjection({ pack, diagnosis, validation });

                if (!isSafeToGenerate(validation)) {
                    operationalLogger.warn('orchestration.triage.validation_blocked', {
                        module: 'orchestration.triage-orchestrator',
                        session_id: sid,
                        validation_status: validation.status,
                    }, { ticket_id: ticketId });
                    await this.updateSessionStatus(sid, toTriageSessionStatus(validation.status), { clearRetry: true, lastError: null });
                    await syncWorkflowProjection({ pack, diagnosis, validation });
                    return;
                }

                // PHASE 4: Playbook
                operationalLogger.info('orchestration.triage.phase_playbook_started', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                }, { ticket_id: ticketId });
                const playbook = await this.withStageTimeout(
                    'playbook',
                    this.playbookService.generatePlaybook(diagnosis, validation, pack),
                    ticketId,
                    sid
                );

                await execute(
                    `INSERT INTO playbooks (id, session_id, content_md, content_json, created_at)
                     VALUES ($1, $2, $3, $4, NOW())
                     ON CONFLICT (session_id)
                     DO UPDATE SET
                       content_md = EXCLUDED.content_md,
                       content_json = EXCLUDED.content_json,
                       created_at = NOW()`,
                    [uuidv4(), sid, playbook.content_md, JSON.stringify(playbook)]
                );

                await execute(
                    `INSERT INTO llm_outputs (id, session_id, step, model, payload, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (session_id, step)
                     DO UPDATE SET
                       model = EXCLUDED.model,
                       payload = EXCLUDED.payload,
                       created_at = NOW()`,
                    [
                        uuidv4(),
                        sid,
                        'playbook',
                        readModelName(playbook),
                        JSON.stringify(playbook),
                    ]
                );

                await this.updateSessionStatus(sid, 'approved', { clearRetry: true, lastError: null });
                await syncWorkflowProjection({ pack, diagnosis, validation, playbook });
                operationalLogger.info('orchestration.triage.pipeline_completed', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                }, { ticket_id: ticketId });
            } catch (error) {
                operationalLogger.error('orchestration.triage.pipeline_failed', error, {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sid,
                    signal: 'integration_failure',
                    degraded_mode: true,
                }, { ticket_id: ticketId });
                const message = readErrorMessage(error);
                if (this.isTransientProviderError(message) || readErrorName(error) === 'LLMQuotaExceededError') {
                    await this.markPendingForRetry(sid, message);
                    operationalLogger.warn('orchestration.triage.marked_pending_for_retry', {
                        module: 'orchestration.triage-orchestrator',
                        session_id: sid,
                        reason: message,
                        degraded_mode: true,
                    }, { ticket_id: ticketId });
                } else {
                    await this.updateSessionStatus(sid, 'failed', { lastError: message, clearRetry: true });
                }
            }
        });
    }

    private isTransientProviderError(message: string): boolean {
        const normalized = message.toLowerCase();
        return normalized.includes('[geminilimiter]') ||
            normalized.includes('rpd limit reached') ||
            normalized.includes('resource_exhausted') ||
            normalized.includes('429') ||
            normalized.includes('rate limit') ||
            normalized.includes('timeout') ||
            normalized.includes('temporarily unavailable') ||
            normalized.includes('service unavailable') ||
            normalized.includes('econnreset') ||
            normalized.includes('etimedout') ||
            normalized.includes('network error') ||
            normalized.includes('quota_exceeded');
    }

    private computeBackoffDelayMs(retryCount: number): number {
        const exponent = Math.max(0, retryCount - 1);
        const delay = this.retryBaseDelayMs * Math.pow(2, Math.min(exponent, 6));
        return Math.min(delay, this.retryMaxDelayMs);
    }

    private async markPendingForRetry(sessionId: string, errorMessage: string) {
        await transaction(async (client: PoolClient) => {
            const current = await client.query<{ retry_count: number | null }>(
                `SELECT retry_count FROM triage_sessions WHERE id = $1 FOR UPDATE`,
                [sessionId]
            );
            const nextRetryCount = (current.rows[0]?.retry_count ?? 0) + 1;
            const delayMs = this.computeBackoffDelayMs(nextRetryCount);
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

    private async claimOrCreateSession(ticketId: string, orgId?: string, tenantId?: string): Promise<string | null> {
        type SessionRow = { id: string; status: string; updated_at: string };
        type TenantRow = { id: string };
        type PlaybookRow = { id: string };

        return transaction(async (client: PoolClient) => {
            await client.query(
                `SELECT pg_advisory_xact_lock($1, hashtext($2))`,
                [this.advisoryLockNamespace, ticketId]
            );

            const existingResult = tenantId
                ? await client.query<SessionRow>(
                    `SELECT id, status, updated_at
                     FROM triage_sessions
                     WHERE ticket_id = $1
                       AND tenant_id = $2
                     ORDER BY created_at DESC
                    LIMIT 1
                     FOR UPDATE`,
                    [ticketId, tenantId]
                )
                : await client.query<SessionRow>(
                    `SELECT id, status, updated_at
                     FROM triage_sessions
                     WHERE ticket_id = $1
                     ORDER BY created_at DESC
                     LIMIT 1
                     FOR UPDATE`,
                    [ticketId]
                );
            const existingSession = existingResult.rows[0];

            if (existingSession) {
                const sessionId = existingSession.id;
                if (existingSession.status === 'processing') {
                    const updatedAt = new Date(existingSession.updated_at);
                    const ageMs = Number.isNaN(updatedAt.getTime()) ? 0 : Date.now() - updatedAt.getTime();
                    const staleMs = 5 * 60 * 1000;
                    if (ageMs < staleMs) {
                        operationalLogger.info('orchestration.triage.claim_skip_processing_active', {
                            module: 'orchestration.triage-orchestrator',
                            session_id: sessionId,
                        }, { ticket_id: ticketId });
                        return null;
                    }
                    operationalLogger.warn('orchestration.triage.claim_resume_stuck_processing', {
                        module: 'orchestration.triage-orchestrator',
                        session_id: sessionId,
                        stale_seconds: Math.round(ageMs / 1000),
                        degraded_mode: true,
                    }, { ticket_id: ticketId });
                }

                if (existingSession.status === 'approved') {
                    const playbookResult = await client.query<PlaybookRow>(
                        `SELECT id FROM playbooks WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
                        [sessionId]
                    );
                    if (playbookResult.rows[0]) {
                        operationalLogger.info('orchestration.triage.claim_skip_already_approved', {
                            module: 'orchestration.triage-orchestrator',
                            session_id: sessionId,
                        }, { ticket_id: ticketId });
                        return null;
                    }
                    operationalLogger.warn('orchestration.triage.claim_reprocess_missing_playbook', {
                        module: 'orchestration.triage-orchestrator',
                        session_id: sessionId,
                        degraded_mode: true,
                    }, { ticket_id: ticketId });
                }

                await client.query(
                    `UPDATE triage_sessions
                     SET status = 'processing', last_error = NULL, updated_at = NOW()
                     WHERE id = $1`,
                    [sessionId]
                );
                operationalLogger.info('orchestration.triage.claim_existing_session_resumed', {
                    module: 'orchestration.triage-orchestrator',
                    session_id: sessionId,
                }, { ticket_id: ticketId });
                return sessionId;
            }

            const sessionId = uuidv4();
            let resolvedTenantId = String(tenantId || '').trim() || null;
            if (!resolvedTenantId) {
                const defaultTenantResult = await client.query<TenantRow>(
                    `SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`
                );
                const defaultTenant = defaultTenantResult.rows[0];
                resolvedTenantId = String(defaultTenant?.id || '').trim() || null;
            }

            await client.query(
                `INSERT INTO triage_sessions (id, ticket_id, org_id, status, created_by, tenant_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                [sessionId, ticketId, orgId || null, 'processing', 'system', resolvedTenantId]
            );
            operationalLogger.info('orchestration.triage.claim_new_session_created', {
                module: 'orchestration.triage-orchestrator',
                session_id: sessionId,
            }, { ticket_id: ticketId });
            return sessionId;
        });
    }

    private async hasManualSuppressedColumn(): Promise<boolean> {
        if (this.hasManualSuppressedColumnCache !== null) return this.hasManualSuppressedColumnCache;
        const rows = await query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'tickets_processed'
                  AND column_name = 'manual_suppressed'
             ) AS exists`
        );
        this.hasManualSuppressedColumnCache = Boolean(rows[0]?.exists);
        return this.hasManualSuppressedColumnCache;
    }

    private async isTicketManuallySuppressed(ticketId: string): Promise<boolean> {
        if (!await this.hasManualSuppressedColumn()) return false;
        const rows = await query<{ manual_suppressed: boolean | null }>(
            `SELECT COALESCE(manual_suppressed, FALSE) AS manual_suppressed
             FROM tickets_processed
             WHERE id = $1
             LIMIT 1`,
            [ticketId]
        );
        return Boolean(rows[0]?.manual_suppressed);
    }

    private async markLatestSessionBlockedBySuppression(ticketId: string): Promise<void> {
        await execute(
            `UPDATE triage_sessions
             SET status = 'blocked',
                 last_error = 'manual suppression',
                 retry_count = 0,
                 next_retry_at = NULL,
                 updated_at = NOW()
             WHERE id IN (
               SELECT id
               FROM triage_sessions
               WHERE ticket_id = $1
                 AND status IN ('pending', 'processing', 'failed')
               ORDER BY created_at DESC
               LIMIT 1
             )`,
            [ticketId]
        );
    }

    private async updateSessionStatus(
        sessionId: string,
        status: TriageSessionStatus,
        options?: { clearRetry?: boolean; lastError?: string | null }
    ) {
        const updates: string[] = ['status = $1', 'updated_at = NOW()'];
        const params: Array<string | null | boolean> = [status];
        let paramIndex = 2;

        if (options?.lastError !== undefined) {
            updates.push(`last_error = $${paramIndex}`);
            params.push(options.lastError ?? null);
            paramIndex += 1;
        }
        if (options?.clearRetry) {
            updates.push('retry_count = 0');
            updates.push('next_retry_at = NULL');
        }
        params.push(sessionId);
        await execute(
            `UPDATE triage_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            params
        );
    }
}

export const triageOrchestrator = new TriageOrchestrator();
