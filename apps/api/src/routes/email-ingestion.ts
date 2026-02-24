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
           AND COALESCE(tp.manual_suppressed, FALSE) = FALSE
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
        const hasManualSuppressedColumn = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_name = 'tickets_processed'
                 AND column_name = 'manual_suppressed'
             ) AS exists`
        );
        const includeManualSuppressed = Boolean(hasManualSuppressedColumn[0]?.exists);

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
                    tp.id AS ticket_id,
                    ls.session_status,
                    ls.session_created_at,
                    ls.first_session_created_at,
                    tp.title,
                    tp.description,
                    ${includeCompany ? 'tp.company,' : `''::text AS company,`}
                    tp.requester,
                    tp.raw_body,
                    ${includeManualSuppressed ? 'COALESCE(tp.manual_suppressed, FALSE) AS manual_suppressed,' : 'FALSE AS manual_suppressed,'}
                    tp.created_at AS ticket_created_at,
                    ep.payload AS evidence_payload,
                    ssot.payload AS ssot_payload
             FROM tickets_processed tp
             LEFT JOIN latest_sessions ls ON ls.ticket_id = tp.id
             LEFT JOIN LATERAL (
               SELECT payload
               FROM triage_sessions ts_pack
               JOIN evidence_packs ep ON ep.session_id = ts_pack.id
               WHERE ts_pack.ticket_id = tp.id
               ORDER BY ep.created_at DESC
               LIMIT 1
             ) ep ON true
             LEFT JOIN LATERAL (
               SELECT payload
               FROM ticket_ssot
               WHERE ticket_id = tp.id
               ORDER BY updated_at DESC
               LIMIT 1
             ) ssot ON true
             ORDER BY
               CASE
                 WHEN tp.id ~ '^T[0-9]{8}\\.[0-9]+$' THEN substring(tp.id from 2 for 8)
                 ELSE NULL
               END DESC NULLS LAST,
               CASE
                 WHEN tp.id ~ '^T[0-9]{8}\\.[0-9]+$' THEN LPAD(split_part(tp.id, '.', 2), 12, '0')
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
        const extractSite = (rawBody?: string, company?: string) => {
            const raw = rawBody || '';
            const explicit =
                raw.match(/(?:site|office|location)\s*[:\-]\s*([^\n<]+)/i) ||
                raw.match(/at\s+[^,\n.]{2,80},\s*([A-Za-z0-9][^.\n<]{1,80})/i);
            const parsed = normalizeText(explicit?.[1], '');
            if (parsed && !/^unknown$/i.test(parsed)) return parsed;

            const companyName = normalizeText(company, '');
            if (companyName) {
                const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const companyScoped = raw.match(new RegExp(`${escaped}\\s*,\\s*([^\\.\\n<]{2,80})`, 'i'));
                const companySite = normalizeText(companyScoped?.[1], '');
                if (companySite && !/^unknown$/i.test(companySite)) return companySite;
            }
            return 'Unknown site';
        };
        const countMatches = (text: string, needles: string[]) =>
            needles.reduce((count, needle) => count + (text.includes(needle) ? 1 : 0), 0);
        const classifySuppression = (input: { title?: string; description?: string; rawBody?: string }) => {
            const text = normalizeText(
                [input.title || '', input.description || '', input.rawBody || ''].join('\n'),
                ''
            ).toLowerCase();
            if (!text) return null;

            const quarantineMarkerCount = countMatches(text, [
                'quarantined emails',
                'spam/junk emails',
                'generate a new quarantine report',
                'trust sender',
            ]);
            if (quarantineMarkerCount >= 3) {
                return {
                    suppressed: true,
                    reason_code: 'quarantine_digest',
                    reason_label: 'Quarantine digest',
                    confidence: 0.999,
                };
            }

            const marketingMarkerCount = countMatches(text, [
                'join now',
                'exclusive rates',
                'report abuse',
                'business edge',
                'hotel discounts',
            ]);
            if (text.includes('unsubscribe') && marketingMarkerCount >= 2) {
                return {
                    suppressed: true,
                    reason_code: 'marketing_promotional',
                    reason_label: 'Marketing / promotional',
                    confidence: 0.999,
                };
            }

            const bounceMarkerCount = countMatches(text, [
                'mailer-daemon',
                'mail delivery system',
                'undelivered mail returned to sender',
                'message could not be delivered',
                'recipient address rejected',
                'in reply to rcpt to command',
                'connection timed out',
            ]);
            const hasBounceTransportSignal =
                /\b(?:4|5)\.\d+\.\d+\b/.test(text) ||
                /\brcpt to\b/.test(text) ||
                /\bport 25\b/.test(text) ||
                /\bsmtp\b/.test(text);
            if (bounceMarkerCount >= 2 && hasBounceTransportSignal) {
                return {
                    suppressed: true,
                    reason_code: 'delivery_failure_bounce',
                    reason_label: 'Bounce / delivery failure',
                    confidence: 0.995,
                };
            }

            return null;
        };

        const isMeaningful = (value?: string, ...blocked: string[]) => {
            const normalized = normalizeText(value, '').toLowerCase();
            if (!normalized) return false;
            if (blocked.some((label) => normalized === label.toLowerCase())) return false;
            return normalized !== 'unknown';
        };
        const isSpecificAffectedUser = (value?: string) => {
            const normalized = normalizeText(value, '').toLowerCase();
            if (!normalized || normalized === 'unknown') return false;
            if (/name not provided/.test(normalized)) return false;
            if (/^(new|another|the)\s+employee\b/.test(normalized)) return false;
            if (/^employee\b/.test(normalized)) return false;
            if (/^new hire\b/.test(normalized)) return false;
            return true;
        };
        const selectUiUserFromSsot = (ssot: any, fallbackRequester: string) => {
            const affected = normalizeText(ssot?.affected_user_name, '');
            const requester = normalizeText(ssot?.requester_name, '');
            if (isSpecificAffectedUser(affected)) return affected;
            if (isMeaningful(requester, 'Unknown requester', 'requester', 'user')) return requester;
            return fallbackRequester;
        };
        const mapped = (pipelineRows as any[])
            .map((row) => {
                const pack = row.evidence_payload || {};
                const ssot = row.ssot_payload || {};
                const packTicket = pack.ticket || {};
                const packOrg = pack.org || {};
                const packUser = pack.user || {};
                const normalizedTicketSection = pack?.iterative_enrichment?.sections?.ticket || {};

                const processedTitle = cleanTitle(row.title, row.description);
                const packTitle = cleanTitle(packTicket.title, packTicket.description);
                const ssotTitle = cleanTitle(ssot.title, ssot.description_clean);
                const title = isMeaningful(ssotTitle, 'Untitled Ticket')
                    ? ssotTitle
                    : (isMeaningful(processedTitle, 'Untitled Ticket')
                    ? processedTitle
                    : (isMeaningful(packTitle, 'Untitled Ticket') ? packTitle : 'Untitled Ticket'));

                const processedCompany = extractCompany(row.company, row.raw_body);
                const packCompany = normalizeText(packOrg.name, '');
                const ssotCompany = normalizeText(ssot.company, '');
                const company = isMeaningful(ssotCompany, 'Unknown org', 'organization')
                    ? ssotCompany
                    : (isMeaningful(processedCompany, 'Unknown org', 'organization')
                    ? processedCompany
                    : (isMeaningful(packCompany, 'Unknown org', 'organization') ? packCompany : 'Unknown org'));

                const processedRequester = extractRequester(row.requester, row.raw_body);
                const packRequester = normalizeText(packUser.name, '');
                const ssotRequester = selectUiUserFromSsot(ssot, '');
                const canonicalRequester = normalizeText(
                    normalizedTicketSection?.affected_user_name?.value ||
                    normalizedTicketSection?.requester_name?.value,
                    ''
                );
                const requester = isMeaningful(ssotRequester, 'Unknown requester', 'requester', 'user')
                    ? ssotRequester
                    : (isMeaningful(canonicalRequester, 'Unknown requester', 'requester', 'user')
                    ? canonicalRequester
                    : (isMeaningful(processedRequester, 'Unknown requester', 'requester', 'user')
                    ? processedRequester
                    : (isMeaningful(packRequester, 'Unknown requester', 'requester', 'user') ? packRequester : 'Unknown requester')));

                const canonicalSite = normalizeText(
                    normalizedTicketSection?.site?.value || packTicket.site,
                    ''
                );
                const site = isMeaningful(canonicalSite, 'Unknown site', 'site')
                    ? canonicalSite
                    : extractSite(row.raw_body, company);
                const suppression = classifySuppression({
                    title: row.title || packTicket.title || ssot.title,
                    description: row.description || packTicket.description || ssot.description_clean,
                    rawBody: row.raw_body,
                });
                const manuallySuppressed = Boolean(row.manual_suppressed);
                const effectiveSuppressed = manuallySuppressed || Boolean(suppression?.suppressed);

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
                    site,
                    created_at: ssot.created_at || row.ticket_created_at || row.first_session_created_at || row.session_created_at,
                    manual_suppressed: manuallySuppressed,
                    suppressed: effectiveSuppressed,
                    suppression_reason: manuallySuppressed ? 'manual_override' : (suppression?.reason_code ?? null),
                    suppression_reason_label: manuallySuppressed ? 'Manual suppression' : (suppression?.reason_label ?? null),
                    suppression_confidence: manuallySuppressed ? null : (suppression?.confidence ?? null),
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

router.patch('/tickets/:ticketId/manual-suppression', async (req: Request, res: Response) => {
    try {
        const ticketId = String(req.params.ticketId || '').trim();
        const requested = req.body?.suppressed;
        const suppressed =
            requested === true ||
            requested === 1 ||
            String(requested || '').toLowerCase() === 'true' ||
            String(requested || '').toLowerCase() === '1';

        if (!ticketId) {
            return res.status(400).json({ error: 'Missing ticketId' });
        }

        const { query, execute } = await import('../db/index.js');
        const hasManualSuppressedColumn = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_name = 'tickets_processed'
                 AND column_name = 'manual_suppressed'
             ) AS exists`
        );
        if (!hasManualSuppressedColumn[0]?.exists) {
            return res.status(500).json({ error: 'manual_suppressed column not available (run migrations)' });
        }

        const exists = await query<{ id: string }>(
            `SELECT id FROM tickets_processed WHERE id = $1 LIMIT 1`,
            [ticketId]
        );
        if (!exists[0]?.id) {
            return res.status(404).json({ error: 'Ticket not found', ticketId });
        }

        await execute(
            `UPDATE tickets_processed
             SET manual_suppressed = $1,
                 manual_suppressed_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
                 last_updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [suppressed, ticketId]
        );

        if (suppressed) {
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

        return res.json({
            success: true,
            ticketId,
            manual_suppressed: suppressed,
            suppressed: suppressed,
            suppression_reason: suppressed ? 'manual_override' : null,
            suppression_reason_label: suppressed ? 'Manual suppression' : null,
        });
    } catch (error: any) {
        console.error('[EmailIngestion] Manual suppression update failed:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
