import { backfillPendingEmailTickets, ingestSupportMailboxOnce } from '../routes/email-ingestion.js';

export class EmailIngestionPollingService {
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    private pollIntervalMs = parseInt(process.env.EMAIL_INGEST_POLL_INTERVAL_MS || '60000', 10);

    start() {
        const hasGraphCreds = !!(
            process.env.GRAPH_TENANT_ID &&
            process.env.GRAPH_CLIENT_ID &&
            process.env.GRAPH_CLIENT_SECRET &&
            process.env.GRAPH_MAILBOX_ADDRESS
        );

        if (this.intervalId) {
            console.log('[EmailIngestionPolling] Already running.');
            return;
        }

        if (!hasGraphCreds) {
            console.warn('[EmailIngestionPolling] Missing Graph credentials. New-email ingestion disabled; backfill still enabled.');
        }

        console.log(`[EmailIngestionPolling] Starting polling. Interval: ${this.pollIntervalMs}ms`);
        this.poll().catch((err) => console.error('[EmailIngestionPolling] Initial poll failed:', err));

        this.intervalId = setInterval(() => {
            this.poll().catch((err) => console.error('[EmailIngestionPolling] Poll failed:', err));
        }, this.pollIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[EmailIngestionPolling] Stopped.');
        }
    }

    private async poll() {
        if (this.isPolling) return;
        this.isPolling = true;
        try {
            const hasGraphCreds = !!(
                process.env.GRAPH_TENANT_ID &&
                process.env.GRAPH_CLIENT_ID &&
                process.env.GRAPH_CLIENT_SECRET &&
                process.env.GRAPH_MAILBOX_ADDRESS
            );
            if (hasGraphCreds) {
                const { processed } = await ingestSupportMailboxOnce(process.env.GRAPH_MAILBOX_ADDRESS);
                if (processed > 0) {
                    console.log(`[EmailIngestionPolling] Processed ${processed} email ticket(s).`);
                }
            }
            const backfill = await backfillPendingEmailTickets(25);
            if (backfill.processed > 0) {
                console.log(`[EmailIngestionPolling] Backfilled ${backfill.processed} pending ticket(s).`);
            }
        } finally {
            this.isPolling = false;
        }
    }
}

export const emailIngestionPollingService = new EmailIngestionPollingService();
