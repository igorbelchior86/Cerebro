import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, query } from '../db/index.js';
import { tenantContext } from '../lib/tenantContext.js';
import { PrepareContextService, persistEvidencePack } from './prepare-context.js';
import { DiagnoseService } from './diagnose.js';
import { ValidatePolicyService } from './validate-policy.js';
import { PlaybookWriterService } from './playbook-writer.js';

export class TriageOrchestrator {
    private prepareService: PrepareContextService;
    private diagnoseService: DiagnoseService;
    private validateService: ValidatePolicyService;
    private playbookService: PlaybookWriterService;
    private retryIntervalId: NodeJS.Timeout | null = null;

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
        console.log('[Orchestrator] Starting background retry listener (every 2 mins)');

        // Execute immediately on startup
        this.processPendingSessions().catch(err =>
            console.error('[Orchestrator] Initial pending sessions processing failed:', err)
        );

        this.retryIntervalId = setInterval(() => {
            this.processPendingSessions().catch(err =>
                console.error('[Orchestrator] Pending sessions processing failed:', err)
            );
        }, 2 * 60 * 1000);
    }

    private async processPendingSessions() {
        return tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
            // Find sessions that are 'pending' or 'processing' but stale (> 10 mins)
            // Limit to 5 per cycle to avoid hammering the API
            const staleSessions = await query<{ ticket_id: string }>(
                `SELECT ticket_id FROM triage_sessions 
                 WHERE status = 'pending' 
                 OR (status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes')
                 ORDER BY updated_at ASC
                 LIMIT 5`
            );

            if (staleSessions.length === 0) return;

            console.log(`[Orchestrator] Found ${staleSessions.length} stale/pending sessions. Processing batch...`);
            let quotaHit = false;

            for (const s of staleSessions) {
                if (quotaHit) {
                    console.log(`[Orchestrator] Quota was hit, skipping remaining tickets in this cycle.`);
                    break;
                }

                try {
                    await this.runPipeline(s.ticket_id, undefined, 'autotask');
                } catch (err: any) {
                    const message = String(err?.message || err || '').toLowerCase();
                    console.error(`[Orchestrator] Error processing ${s.ticket_id}:`, message);
                    if (this.isTransientProviderError(message) || err?.name === 'LLMQuotaExceededError') {
                        quotaHit = true;
                    }
                }

                // Delay 10s between tickets to avoid rate-limiting bursts
                if (!quotaHit) {
                    await new Promise(resolve => setTimeout(resolve, 10_000));
                }
            }
        });
    }

    /**
     * Run the full triage pipeline for a ticket.
     * System-triggered pipeline always bypasses tenant RLS checks.
     */
    async runPipeline(ticketId: string, orgId?: string, source: 'email' | 'autotask' = 'autotask') {
        return tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
            console.log(`[Orchestrator] Starting pipeline for ticket ${ticketId} (source: ${source})`);

            const existingSession = await queryOne<{ id: string; status: string; updated_at: string }>(
                `SELECT id, status, updated_at FROM triage_sessions WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [ticketId]
            );

            let sessionId = existingSession?.id;

            if (existingSession) {
                if (existingSession.status === 'processing') {
                    const updatedAt = new Date(existingSession.updated_at);
                    const ageMs = Number.isNaN(updatedAt.getTime()) ? 0 : Date.now() - updatedAt.getTime();
                    const staleMs = 5 * 60 * 1000;
                    if (ageMs < staleMs) {
                        console.log(`[Orchestrator] Ticket ${ticketId} is already processing in session ${sessionId}. Skipping.`);
                        return;
                    }
                    console.warn(`[Orchestrator] Session ${sessionId} was stuck in processing (${Math.round(ageMs / 1000)}s). Resuming.`);
                }
                if (existingSession.status === 'approved') {
                    const existingPlaybook = await queryOne<{ id: string }>(
                        `SELECT id FROM playbooks WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
                        [sessionId]
                    );
                    if (existingPlaybook) {
                        console.log(`[Orchestrator] Ticket ${ticketId} already has approved playbook in session ${sessionId}. Skipping.`);
                        return;
                    }
                    console.warn(`[Orchestrator] Session ${sessionId} is approved but has no playbook. Reprocessing.`);
                }
                console.log(`[Orchestrator] Resuming/retrying existing session ${sessionId}`);
                await this.updateSessionStatus(sessionId as string, 'processing');
            } else {
                sessionId = uuidv4();
                const defaultTenant = await queryOne<{ id: string }>(
                    `SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`
                );
                await execute(
                    `INSERT INTO triage_sessions (id, ticket_id, org_id, status, created_by, tenant_id, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                    [sessionId, ticketId, orgId || null, 'processing', 'system', defaultTenant?.id || null]
                );
                console.log(`[Orchestrator] Created new session ${sessionId} for ticket ${ticketId}`);
            }
            const sid = sessionId as string;

            try {
                // PHASE 1: Prepare Context
                console.log(`[Orchestrator] [${sid}] Phase 1: Prepare Context`);
                const pack = await this.prepareService.prepare({
                    sessionId: sid,
                    ticketId,
                    ...(orgId ? { orgId } : {}),
                });
                await persistEvidencePack(sid, pack);

                // PHASE 2: Diagnose
                console.log(`[Orchestrator] [${sid}] Phase 2: Diagnose`);
                const diagnosis = await this.diagnoseService.diagnose(pack);
                await execute(
                    `INSERT INTO llm_outputs (id, session_id, step, model, payload, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                        uuidv4(),
                        sid,
                        'diagnose',
                        (diagnosis as any)?.meta?.model || 'groq',
                        JSON.stringify(diagnosis),
                    ]
                );

                // PHASE 3: Validate
                console.log(`[Orchestrator] [${sid}] Phase 3: Validate`);
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
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
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

                if (!validation.safe_to_generate_playbook) {
                    console.warn(`[Orchestrator] [${sid}] Pipeline stopped at validation. Status: ${validation.status}`);
                    await this.updateSessionStatus(sid, validation.status as any);
                    return;
                }

                // PHASE 4: Playbook
                console.log(`[Orchestrator] [${sid}] Phase 4: Playbook Generation`);
                const playbook = await this.playbookService.generatePlaybook(diagnosis, validation, pack);

                await execute(
                    `INSERT INTO playbooks (id, session_id, content_md, content_json, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [uuidv4(), sid, playbook.content_md, JSON.stringify(playbook)]
                );

                await execute(
                    `INSERT INTO llm_outputs (id, session_id, step, model, payload, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                        uuidv4(),
                        sid,
                        'playbook',
                        (playbook as any)?.meta?.model || 'groq',
                        JSON.stringify(playbook),
                    ]
                );

                await this.updateSessionStatus(sid, 'approved');
                console.log(`[Orchestrator] [${sid}] Pipeline completed successfully. Playbook ready.`);
            } catch (error: any) {
                console.error(`[Orchestrator] [${sid}] Pipeline failed:`, error);
                const message = String(error?.message || error || '');
                if (this.isTransientProviderError(message) || error.name === 'LLMQuotaExceededError') {
                    await this.updateSessionStatus(sid, 'pending');
                    console.warn(`[Orchestrator] [${sid}] Marked as pending for retry (quota/transient error): ${message}`);
                } else {
                    await this.updateSessionStatus(sid, 'failed');
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
            normalized.includes('api key not set') ||
            normalized.includes('invalid api key') ||
            normalized.includes('quota_exceeded') ||
            normalized.includes('access is denied');
    }

    private async updateSessionStatus(
        sessionId: string,
        status: 'pending' | 'processing' | 'approved' | 'needs_more_info' | 'blocked' | 'failed'
    ) {
        await execute(
            `UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [status, sessionId]
        );
    }
}

export const triageOrchestrator = new TriageOrchestrator();
