import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne } from '../db/index.js';
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

    constructor() {
        this.prepareService = new PrepareContextService();
        this.diagnoseService = new DiagnoseService();
        this.validateService = new ValidatePolicyService();
        this.playbookService = new PlaybookWriterService();
    }

    /**
     * Run the full triage pipeline for a ticket.
     * System-triggered pipeline always bypasses tenant RLS checks.
     */
    async runPipeline(ticketId: string, orgId?: string, source: 'email' | 'autotask' = 'autotask') {
        return tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
            console.log(`[Orchestrator] Starting zero-click pipeline for ticket ${ticketId} (source: ${source})`);

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
                await execute(
                    `INSERT INTO validation_results (
                        id, session_id, status, violations, required_fixes, req_questions, safe_to_proceed, created_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    [
                        uuidv4(),
                        sid,
                        validation.status,
                        JSON.stringify(validation.violations || []),
                        JSON.stringify(validation.required_fixes || []),
                        JSON.stringify(validation.required_questions || []),
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
                await this.updateSessionStatus(sid, 'failed');
            }
        });
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
