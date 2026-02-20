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

        const processedResults = await query(
            `SELECT tp.id,
                    tp.title,
                    tp.description,
                    ${includeCompany ? 'tp.company,' : `''::text AS company,`}
                    tp.requester,
                    tp.raw_body,
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
             LIMIT 200`
        );

        const sessionResults = await query(
            `SELECT ts.id AS session_id,
                    ts.ticket_id,
                    ts.status AS session_status,
                    ts.created_at AS session_created_at,
                    ep.payload AS evidence_payload
             FROM triage_sessions ts
             LEFT JOIN LATERAL (
               SELECT payload
               FROM evidence_packs ep
               WHERE ep.session_id = ts.id
               ORDER BY ep.created_at DESC
               LIMIT 1
             ) ep ON true
             ORDER BY ts.created_at DESC
             LIMIT 300`
        );

        const normalizeStatus = (status: string) => (status === 'approved' ? 'completed' : 'pending');
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

        const fromProcessed = (processedResults as any[]).map(ticket => ({
            id: ticket.id,
            ticket_id: ticket.id,
            status: normalizeStatus(ticket.pipeline_status),
            priority: 'P3',
            title: cleanTitle(ticket.title, ticket.description),
            description: normalizeText(ticket.description, ''),
            company: extractCompany(ticket.company, ticket.raw_body),
            requester: extractRequester(ticket.requester, ticket.raw_body),
            org: extractCompany(ticket.company, ticket.raw_body),
            site: extractRequester(ticket.requester, ticket.raw_body),
            created_at: ticket.created_at,
        }));
        const processedById = new Map(fromProcessed.map((t) => [t.ticket_id, t]));
        const rawFallbackById = new Map<string, { title: string; description: string; requester: string; company: string; created_at?: string }>();

        const sessionCandidateIds = (sessionResults as any[])
            .map((r) => String(r?.ticket_id || '').trim())
            .filter(Boolean);
        const needsRawFallback = sessionCandidateIds.filter((id) => !processedById.has(id));
        for (const ticketId of needsRawFallback.slice(0, 120)) {
            const rawRows = await query<any>(
                `SELECT email_data
                 FROM tickets_raw
                 WHERE (email_data->>'subject') ILIKE '%' || $1 || '%'
                    OR (email_data->'body'->>'content') ILIKE '%' || $1 || '%'
                 ORDER BY ingested_at DESC
                 LIMIT 1`,
                [ticketId]
            );
            const emailData = rawRows[0]?.email_data;
            if (!emailData) continue;
            const parsed = emailParser.parseEmail(
                String(emailData.subject || ''),
                String(emailData?.body?.content || ''),
                String(emailData.receivedDateTime || '')
            );
            if (!parsed) continue;
            rawFallbackById.set(ticketId, {
                title: cleanTitle(parsed.title, parsed.description),
                description: normalizeText(parsed.description, ''),
                requester: normalizeText(parsed.requester, 'Unknown requester'),
                company: normalizeText(parsed.company, 'Unknown org'),
                created_at: parsed.createdAt,
            });
        }

        const fromSessions = (sessionResults as any[])
            .map((row) => {
                const pack = row.evidence_payload || {};
                const packTicket = pack.ticket || {};
                const packOrg = pack.org || {};
                const packUser = pack.user || {};
                const ticketId = String(row.ticket_id || row.session_id || '');
                if (!ticketId) return null;
                const processed = processedById.get(ticketId);
                const rawFallback = rawFallbackById.get(ticketId);
                const hasPackData = Boolean(packTicket.title || packTicket.description || packOrg.name || packUser.name);
                const hasProcessedData = Boolean(processed || rawFallback);
                // Ignore failed/placeholder sessions that have no parsed ticket/raw fallback and no evidence payload.
                if (!hasPackData && !hasProcessedData) return null;
                const processedTitle = processed?.title || '';
                const rawTitle = normalizeText(rawFallback?.title, '');
                const packTitle = normalizeText(packTicket.title || '', '');
                const bestTitle = processedTitle && processedTitle !== 'Untitled Ticket'
                    ? processedTitle
                    : (rawTitle && rawTitle !== 'Untitled Ticket'
                        ? rawTitle
                        : cleanTitle(packTitle, packTicket.description || processed?.description || rawFallback?.description));
                const processedCompany = normalizeText(processed?.company, '');
                const rawCompany = normalizeText(rawFallback?.company, '');
                const packCompany = normalizeText(packOrg.name, '');
                const bestCompany = processedCompany && !/^unknown org$/i.test(processedCompany)
                    ? processedCompany
                    : (rawCompany && !/^unknown org$/i.test(rawCompany)
                        ? rawCompany
                        : (packCompany && !/^organization$/i.test(packCompany) ? packCompany : 'Unknown org'));
                const processedRequester = normalizeText(processed?.requester, '');
                const rawRequester = normalizeText(rawFallback?.requester, '');
                const packRequester = normalizeText(packUser.name, '');
                const bestRequester = processedRequester && !/^unknown requester$/i.test(processedRequester)
                    ? processedRequester
                    : (rawRequester && !/^unknown requester$/i.test(rawRequester)
                        ? rawRequester
                        : (packRequester || 'Unknown requester'));
                return {
                    id: ticketId,
                    ticket_id: ticketId,
                    status: normalizeStatus(row.session_status || 'pending'),
                    priority: 'P3',
                    title: bestTitle || 'Untitled Ticket',
                    description: normalizeText(packTicket.description || processed?.description || rawFallback?.description, ''),
                    company: bestCompany,
                    requester: bestRequester,
                    org: bestCompany,
                    site: bestRequester,
                    created_at: packTicket.created_at || processed?.created_at || rawFallback?.created_at || row.session_created_at,
                };
            })
            .filter(Boolean) as any[];

        const byTicketId = new Map<string, any>();
        for (const item of [...fromSessions, ...fromProcessed]) {
            const existing = byTicketId.get(item.ticket_id);
            if (!existing) {
                byTicketId.set(item.ticket_id, item);
                continue;
            }
            const existingDate = new Date(existing.created_at || 0).getTime();
            const nextDate = new Date(item.created_at || 0).getTime();
            if (nextDate > existingDate) {
                byTicketId.set(item.ticket_id, item);
            }
        }

        const mapped = Array.from(byTicketId.values())
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
            .slice(0, 200);

        res.json({ success: true, data: mapped });
    } catch (error: any) {
        console.error('[EmailIngestion] List failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
