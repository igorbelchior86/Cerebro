import { query, execute } from '../../db/index.js';

export class PgStore {
    private hasCompanyColumnCache: boolean | null = null;

    private async hasCompanyColumn(): Promise<boolean> {
        if (this.hasCompanyColumnCache !== null) return this.hasCompanyColumnCache;
        const rows = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_name = 'tickets_processed'
                 AND column_name = 'company'
             ) AS exists`
        );
        this.hasCompanyColumnCache = Boolean(rows[0]?.exists);
        return this.hasCompanyColumnCache;
    }

    /**
     * Saves the raw email payload to the tickets_raw table.
     */
    async saveRawEmail(messageId: string, emailData: any) {
        try {
            await execute(
                `INSERT INTO tickets_raw (message_id, email_data)
         VALUES ($1, $2)
         ON CONFLICT (message_id) DO UPDATE 
         SET email_data = EXCLUDED.email_data, ingested_at = CURRENT_TIMESTAMP`,
                [messageId, JSON.stringify(emailData)]
            );
        } catch (error) {
            console.error('[PgStore] Error saving raw email:', error);
        }
    }

    /**
     * Saves or updates a processed ticket in the tickets_processed table.
     */
    async saveProcessedTicket(ticket: any) {
        try {
            const includeCompany = await this.hasCompanyColumn();
            // Check if ticket exists
            const existing = await query<any>(
                `SELECT id, updates FROM tickets_processed WHERE id = $1`,
                [ticket.id]
            );

            if (existing.length > 0 && ticket.isReply) {
                // Append update/activity
                const currentUpdates = existing[0].updates || [];
                const newUpdate = {
                    timestamp: new Date().toISOString(),
                    content: ticket.rawBody,
                };
                const updatedUpdates = [...currentUpdates, newUpdate];

                await execute(
                    `UPDATE tickets_processed 
           SET updates = $1, last_updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
                    [JSON.stringify(updatedUpdates), ticket.id]
                );
            } else {
                // Create new ticket record or overwrite if not a reply (e.g. reprocessing)
                if (includeCompany) {
                    await execute(
                        `INSERT INTO tickets_processed (
              id, title, description, company, requester, source, status, raw_body, is_reply, updates, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              company = EXCLUDED.company,
              requester = EXCLUDED.requester,
              status = EXCLUDED.status,
              raw_body = EXCLUDED.raw_body,
              created_at = EXCLUDED.created_at,
              last_updated_at = CURRENT_TIMESTAMP`,
                        [
                            ticket.id,
                            ticket.title,
                            ticket.description,
                            ticket.company || null,
                            ticket.requester,
                            ticket.source,
                            ticket.status,
                            ticket.rawBody,
                            ticket.isReply,
                            JSON.stringify([]), // initial empty updates array
                            ticket.createdAt ?? new Date().toISOString(),
                        ]
                    );
                } else {
                    await execute(
                        `INSERT INTO tickets_processed (
              id, title, description, requester, source, status, raw_body, is_reply, updates, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              requester = EXCLUDED.requester,
              status = EXCLUDED.status,
              raw_body = EXCLUDED.raw_body,
              created_at = EXCLUDED.created_at,
              last_updated_at = CURRENT_TIMESTAMP`,
                        [
                            ticket.id,
                            ticket.title,
                            ticket.description,
                            ticket.requester,
                            ticket.source,
                            ticket.status,
                            ticket.rawBody,
                            ticket.isReply,
                            JSON.stringify([]), // initial empty updates array
                            ticket.createdAt ?? new Date().toISOString(),
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('[PgStore] Error saving processed ticket:', error);
        }
    }
}

export const pgStore = new PgStore();
