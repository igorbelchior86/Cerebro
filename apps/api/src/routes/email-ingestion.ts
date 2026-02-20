import { Router, Request, Response } from 'express';
import { graphClient } from '../services/email/graph-client.js';
import { emailParser, ParsedTicket } from '../services/email/email-parser.js';
import { pgStore } from '../services/email/pg-store.js';

const router: Router = Router();

router.post('/ingest', async (req: Request, res: Response) => {
    try {
        const mailbox = process.env.GRAPH_MAILBOX_ADDRESS || 'help@refreshtech.com';
        console.log(`[EmailIngestion] Starting ingestion for mailbox: ${mailbox}`);

        const emails = await graphClient.fetchSupportEmails(mailbox);

        if (!emails || emails.length === 0) {
            console.log('[EmailIngestion] No new matching emails found.');
            return res.json({ message: 'No new emails to process.', processed: 0 });
        }

        let processedCount = 0;

        for (const email of emails) {
            try {
                const { id: messageId, subject, body } = email;
                const bodyContent = body?.content || '';

                // 1. Save Raw Email
                await pgStore.saveRawEmail(messageId, email);

                // 2. Parse Email
                const parsed = emailParser.parseEmail(subject, bodyContent);

                if (parsed) {
                    // 3. Save Processed Ticket
                    await pgStore.saveProcessedTicket(parsed);

                    // 4. Mark as read
                    try {
                        await graphClient.markEmailAsRead(mailbox, messageId);
                    } catch (markErr: any) {
                        console.warn(`[EmailIngestion] Could not mark as read: ${markErr.message}`);
                    }

                    processedCount++;
                }
            } catch (err) {
                console.error(`[EmailIngestion] Error processing email id ${email.id}:`, err);
            }
        }

        console.log(`[EmailIngestion] Finished processing ${processedCount} emails.`);
        return res.json({ message: 'Ingestion completed', processed: processedCount });

    } catch (error: any) {
        console.error('[EmailIngestion] Ingestion failed:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.get('/list', async (req: Request, res: Response) => {
    try {
        // Fetch from pgStore
        const { query } = await import('../db/index.js');
        const results = await query(
            `SELECT id, title, description, requester, status, is_reply, updates, created_at, last_updated_at
             FROM tickets_processed
             ORDER BY last_updated_at DESC
             LIMIT 50`
        );

        // Map to ChatSidebar expected format
        const mapped = (results as any[]).map(ticket => ({
            id: ticket.id,
            ticket_id: ticket.id,
            status: ticket.status === 'completed' ? 'completed' : 'pending',
            priority: 'P3', // Default priority for emails
            title: ticket.title || 'Untitled Ticket',
            org: ticket.requester || 'Unknown User',
            created_at: ticket.created_at,
        }));

        res.json({ success: true, data: mapped });
    } catch (error: any) {
        console.error('[EmailIngestion] List failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
