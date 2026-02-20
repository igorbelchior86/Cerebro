import { Router, Request, Response } from 'express';
import { graphClient } from '../services/email/graph-client.js';
import { emailParser } from '../services/email/email-parser.js';
import { pgStore } from '../services/email/pg-store.js';
import { triageOrchestrator } from '../services/triage-orchestrator.js';

const router: Router = Router();

export async function ingestSupportMailboxOnce(mailbox?: string): Promise<{ processed: number }> {
    const mailboxAddress = mailbox || process.env.GRAPH_MAILBOX_ADDRESS || 'help@refreshtech.com';
    console.log(`[EmailIngestion] Starting ingestion for mailbox: ${mailboxAddress}`);

    const emails = await graphClient.fetchSupportEmails(mailboxAddress);

    if (!emails || emails.length === 0) {
        console.log('[EmailIngestion] No new matching emails found.');
        return { processed: 0 };
    }

    let processedCount = 0;

    for (const email of emails) {
        try {
            const { id: messageId, subject, body } = email;
            const bodyContent = body?.content || '';

            await pgStore.saveRawEmail(messageId, email);

            const parsed = emailParser.parseEmail(subject, bodyContent, email.receivedDateTime);
            if (!parsed) continue;

            await pgStore.saveProcessedTicket(parsed);

            // Run the pipeline and wait for completion to avoid backlog.
            await triageOrchestrator.runPipeline(parsed.id, undefined, 'email');

            try {
                await graphClient.markEmailAsRead(mailboxAddress, messageId);
            } catch (markErr: any) {
                console.warn(`[EmailIngestion] Could not mark as read: ${markErr.message}`);
            }

            processedCount++;
        } catch (err: any) {
            console.error(`[EmailIngestion] Error processing email id ${email.id}:`, err);
        }
    }

    console.log(`[EmailIngestion] Finished processing ${processedCount} emails.`);
    return { processed: processedCount };
}

export async function backfillPendingEmailTickets(limit = 20): Promise<{ processed: number }> {
    const { query } = await import('../db/index.js');
    const rows = await query<{ id: string }>(
        `SELECT tp.id
         FROM tickets_processed tp
         LEFT JOIN LATERAL (
            SELECT ts.id, ts.status
            FROM triage_sessions ts
            WHERE ts.ticket_id = tp.id
            ORDER BY ts.created_at DESC
            LIMIT 1
         ) latest_session ON true
         LEFT JOIN playbooks p ON p.session_id = latest_session.id
         WHERE p.id IS NULL
           AND (latest_session.id IS NULL OR latest_session.status IN ('pending', 'failed', 'needs_more_info', 'blocked'))
         ORDER BY tp.created_at DESC
         LIMIT $1`,
        [limit]
    );

    let processed = 0;
    for (const row of rows) {
        try {
            await triageOrchestrator.runPipeline(row.id, undefined, 'email');
            processed++;
        } catch (err: any) {
            console.error(`[EmailIngestion] Backfill failed for ticket ${row.id}:`, err?.message || err);
        }
    }
    if (processed > 0) {
        console.log(`[EmailIngestion] Backfill processed ${processed} pending ticket(s).`);
    }
    return { processed };
}

router.post('/ingest', async (_req: Request, res: Response) => {
    try {
        const result = await ingestSupportMailboxOnce();
        return res.json({ message: 'Ingestion completed', processed: result.processed });
    } catch (error: any) {
        console.error('[EmailIngestion] Ingestion failed:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.get('/list', async (_req: Request, res: Response) => {
    try {
        const { query } = await import('../db/index.js');

        const results = await query(
            `SELECT tp.id,
                    tp.title,
                    tp.description,
                    tp.requester,
                    tp.status,
                    tp.is_reply,
                    tp.updates,
                    tp.created_at,
                    tp.last_updated_at,
                    COALESCE(ts.status, 'pending') AS pipeline_status
             FROM tickets_processed tp
             LEFT JOIN LATERAL (
               SELECT status
               FROM triage_sessions ts
               WHERE ts.ticket_id = tp.id
               ORDER BY ts.created_at DESC
               LIMIT 1
             ) ts ON true
             ORDER BY tp.created_at DESC
             LIMIT 50`
        );

        const mapped = (results as any[]).map(ticket => ({
            id: ticket.id,
            ticket_id: ticket.id,
            status: ticket.pipeline_status === 'approved' ? 'completed' : 'pending',
            priority: 'P3',
            title: ticket.title || 'Untitled Ticket',
            company: 'Unknown org',
            requester: ticket.requester || 'Unknown requester',
            org: 'Unknown org',
            site: ticket.requester || 'Unknown requester',
            created_at: ticket.created_at,
        }));

        res.json({ success: true, data: mapped });
    } catch (error: any) {
        console.error('[EmailIngestion] List failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
