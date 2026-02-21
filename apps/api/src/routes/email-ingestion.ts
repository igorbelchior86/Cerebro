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
        const hasCompanyColumn = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_name = 'tickets_processed'
                 AND column_name = 'company'
             ) AS exists`
        );
        const includeCompany = Boolean(hasCompanyColumn[0]?.exists);

        const pipelineRows = await query(
            `WITH ticket_sessions AS (
               SELECT ts.id,
                      ts.ticket_id,
                      ts.status,
                      ts.created_at,
                      MIN(ts.created_at) OVER (PARTITION BY ts.ticket_id) AS first_session_created_at
               FROM triage_sessions ts
               WHERE ts.ticket_id IS NOT NULL
                 AND ts.ticket_id <> ''
             ),
             latest_sessions AS (
               SELECT DISTINCT ON (ticket_id)
                      id AS session_id,
                      ticket_id,
                      status AS session_status,
                      created_at AS session_created_at,
                      first_session_created_at
               FROM ticket_sessions
               ORDER BY ticket_id, created_at DESC
             )
             SELECT ls.session_id,
                    ls.ticket_id,
                    ls.session_status,
                    ls.session_created_at,
                    ls.first_session_created_at,
                    tp.title,
                    tp.description,
                    ${includeCompany ? 'tp.company,' : `''::text AS company,`}
                    tp.requester,
                    tp.raw_body,
                    tp.created_at AS ticket_created_at,
                    ep.payload AS evidence_payload
             FROM latest_sessions ls
             LEFT JOIN tickets_processed tp ON tp.id = ls.ticket_id
             LEFT JOIN LATERAL (
               SELECT payload
               FROM triage_sessions ts_pack
               JOIN evidence_packs ep ON ep.session_id = ts_pack.id
               WHERE ts_pack.ticket_id = ls.ticket_id
               ORDER BY ep.created_at DESC
               LIMIT 1
             ) ep ON true
             ORDER BY
               CASE
                 WHEN ls.ticket_id ~ '^T[0-9]{8}\\.[0-9]+$' THEN substring(ls.ticket_id from 2 for 8)
                 ELSE NULL
               END DESC NULLS LAST,
               CASE
                 WHEN ls.ticket_id ~ '^T[0-9]{8}\\.[0-9]+$' THEN LPAD(split_part(ls.ticket_id, '.', 2), 12, '0')
                 ELSE NULL
               END DESC NULLS LAST,
               COALESCE(tp.created_at, ls.first_session_created_at) DESC
             LIMIT 200`
        );

        const normalizeStatus = (status: string) => {
            const normalized = String(status || '').toLowerCase();
            if (normalized === 'approved' || normalized === 'completed') return 'completed';
            if (normalized === 'failed') return 'failed';
            if (normalized === 'processing') return 'processing';
            return 'pending';
        };
        const normalizeText = (value?: string, fallback = '') =>
            (value || '')
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/\s+/g, ' ')
                .trim() || fallback;
        const cleanTitle = (title?: string, description?: string) => {
            const t = normalizeText(title, '');
            if (!t) return 'Untitled Ticket';
            const cut = t.replace(/\s+Description\s*:\s*.*$/i, '').trim();
            if (cut) return cut;
            return normalizeText(description, 'Untitled Ticket');
        };
        const extractRequester = (requester?: string, rawBody?: string) => {
            const raw = rawBody || '';
            const requestFrom = raw.match(/request\s+from\s+([A-Za-z][A-Za-z\s.'-]{1,80})\s*:/i);
            const salutation = raw.match(/^\s*([A-Za-z][A-Za-z\s.'-]{1,80})\s*,\s*(?:<br\s*\/?>|\n|\r)/i);
            const requestedFor = normalizeText(requestFrom?.[1] || salutation?.[1], '');
            if (requestedFor) return requestedFor;
            const r = normalizeText(requester, '');
            if (r && !/^unknown$/i.test(r)) return r;
            const m = raw.match(/Created by:\s*([^\n<]+)/i) || raw.match(/Created on\s+[^\n<]*?\s+by\s+([^\n<]+)/i);
            return normalizeText(m?.[1], 'Unknown requester');
        };
        const extractCompany = (company?: string, rawBody?: string) => {
            const c = normalizeText(company, '');
            if (c) return c;
            const raw = rawBody || '';
            const m = raw.match(/has been created for\s+(.+?)\.\s*we will attend/i);
            return normalizeText(m?.[1], 'Unknown org');
        };

        const isMeaningful = (value?: string, ...blocked: string[]) => {
            const normalized = normalizeText(value, '').toLowerCase();
            if (!normalized) return false;
            if (blocked.some((label) => normalized === label.toLowerCase())) return false;
            return normalized !== 'unknown';
        };
        const mapped = (pipelineRows as any[])
            .map((row) => {
                const pack = row.evidence_payload || {};
                const packTicket = pack.ticket || {};
                const packOrg = pack.org || {};
                const packUser = pack.user || {};

                const processedTitle = cleanTitle(row.title, row.description);
                const packTitle = cleanTitle(packTicket.title, packTicket.description);
                const title = isMeaningful(processedTitle, 'Untitled Ticket')
                    ? processedTitle
                    : (isMeaningful(packTitle, 'Untitled Ticket') ? packTitle : 'Untitled Ticket');

                const processedCompany = extractCompany(row.company, row.raw_body);
                const packCompany = normalizeText(packOrg.name, '');
                const company = isMeaningful(processedCompany, 'Unknown org', 'organization')
                    ? processedCompany
                    : (isMeaningful(packCompany, 'Unknown org', 'organization') ? packCompany : 'Unknown org');

                const processedRequester = extractRequester(row.requester, row.raw_body);
                const packRequester = normalizeText(packUser.name, '');
                const requester = isMeaningful(processedRequester, 'Unknown requester', 'requester', 'user')
                    ? processedRequester
                    : (isMeaningful(packRequester, 'Unknown requester', 'requester', 'user') ? packRequester : 'Unknown requester');

                return {
                    id: String(row.ticket_id),
                    ticket_id: String(row.ticket_id),
                    status: normalizeStatus(row.session_status || 'pending'),
                    priority: 'P3',
                    title,
                    description: normalizeText(row.description || packTicket.description, ''),
                    company,
                    requester,
                    org: company,
                    site: requester,
                    created_at: row.ticket_created_at || row.first_session_created_at || row.session_created_at,
                };
            })
            .filter((item) => item.ticket_id)
            .sort((a, b) => {
                const am = String(a.ticket_id || '').match(/^T(\d{8})\.(\d+)$/);
                const bm = String(b.ticket_id || '').match(/^T(\d{8})\.(\d+)$/);
                if (am && bm) {
                    const aDay = am[1] || '';
                    const bDay = bm[1] || '';
                    if (aDay !== bDay) return aDay < bDay ? 1 : -1;
                    const aSeq = Number(am[2] || 0);
                    const bSeq = Number(bm[2] || 0);
                    if (aSeq !== bSeq) return bSeq - aSeq;
                }
                const byTime = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                if (byTime !== 0) return byTime;
                return String(b.ticket_id || '').localeCompare(String(a.ticket_id || ''));
            })
            .slice(0, 200);

        res.json({ success: true, data: mapped });
    } catch (error: any) {
        console.error('[EmailIngestion] List failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
