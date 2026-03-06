import { backfillPendingEmailTickets, ingestSupportMailboxOnce } from './application/route-handlers/ticket-intake-route-handlers.js';
import { withTryAdvisoryLock } from '../db/index.js';

export class TicketIntakePollingService {
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    private pollIntervalMs = parseInt(process.env.TICKET_INTAKE_POLL_INTERVAL_MS || '60000', 10);
    private readonly advisoryLockNamespace = 41023;
    private readonly advisoryLockKey = 2;

    start() {
        const hasGraphCreds = !!(
            process.env.GRAPH_TENANT_ID &&
            process.env.GRAPH_CLIENT_ID &&
            process.env.GRAPH_CLIENT_SECRET &&
            process.env.GRAPH_MAILBOX_ADDRESS
        );

        if (this.intervalId) {
            console.log('[TicketIntakePolling] Already running.');
            return;
        }

        if (!hasGraphCreds) {
            console.warn('[TicketIntakePolling] Missing Graph credentials. New-ticket intake disabled; backfill still enabled.');
        }

        console.log(`[TicketIntakePolling] Starting polling. Interval: ${this.pollIntervalMs}ms`);
        this.poll().catch((err) => console.error('[TicketIntakePolling] Initial poll failed:', err));

        this.intervalId = setInterval(() => {
            this.poll().catch((err) => console.error('[TicketIntakePolling] Poll failed:', err));
        }, this.pollIntervalMs);
        this.intervalId.unref?.();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[TicketIntakePolling] Stopped.');
        }
    }

    private async poll() {
        if (this.isPolling) return;
        this.isPolling = true;
        try {
            const lock = await withTryAdvisoryLock(this.advisoryLockNamespace, this.advisoryLockKey, async () => {
                const hasGraphCreds = !!(
                    process.env.GRAPH_TENANT_ID &&
                    process.env.GRAPH_CLIENT_ID &&
                    process.env.GRAPH_CLIENT_SECRET &&
                    process.env.GRAPH_MAILBOX_ADDRESS
                );
                if (hasGraphCreds) {
                    const { processed } = await ingestSupportMailboxOnce(process.env.GRAPH_MAILBOX_ADDRESS);
                    if (processed > 0) {
                        console.log(`[TicketIntakePolling] Processed ${processed} email ticket(s).`);
                    }
                }
                const backfill = await backfillPendingEmailTickets(25);
                if (backfill.processed > 0) {
                    console.log(`[TicketIntakePolling] Backfilled ${backfill.processed} pending ticket(s).`);
                }
            });
            if (!lock.acquired) {
                console.log('[TicketIntakePolling] Another instance holds the polling lock. Skipping this iteration.');
            }
        } finally {
            this.isPolling = false;
        }
    }
}

export const ticketIntakePollingService = new TicketIntakePollingService();
