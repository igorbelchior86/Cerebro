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
                    await graphClient.markEmailAsRead(mailbox, messageId);

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

export default router;
