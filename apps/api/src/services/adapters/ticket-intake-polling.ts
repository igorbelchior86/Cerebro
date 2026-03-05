import { backfillPendingEmailTickets, ingestSupportMailboxOnce } from '../application/route-handlers/ticket-intake-route-handlers.js';
import { withTryAdvisoryLock } from '../../db/index.js';
import { operationalLogger } from '../../lib/operational-logger.js';

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
            operationalLogger.info('adapters.ticket_intake_polling.already_running', {
                module: 'adapters.ticket-intake-polling',
            });
            return;
        }

        if (!hasGraphCreds) {
            operationalLogger.warn('adapters.ticket_intake_polling.graph_credentials_missing', {
                module: 'adapters.ticket-intake-polling',
                integration: 'microsoft_graph',
                signal: 'integration_failure',
                degraded_mode: true,
            });
        }

        operationalLogger.info('adapters.ticket_intake_polling.started', {
            module: 'adapters.ticket-intake-polling',
            poll_interval_ms: this.pollIntervalMs,
        });
        this.poll().catch((err) => operationalLogger.error(
            'adapters.ticket_intake_polling.initial_poll_failed',
            err,
            {
                module: 'adapters.ticket-intake-polling',
                signal: 'integration_failure',
                degraded_mode: true,
            },
        ));

        this.intervalId = setInterval(() => {
            this.poll().catch((err) => operationalLogger.error(
                'adapters.ticket_intake_polling.poll_failed',
                err,
                {
                    module: 'adapters.ticket-intake-polling',
                    signal: 'integration_failure',
                    degraded_mode: true,
                },
            ));
        }, this.pollIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            operationalLogger.info('adapters.ticket_intake_polling.stopped', {
                module: 'adapters.ticket-intake-polling',
            });
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
                        operationalLogger.info('adapters.ticket_intake_polling.emails_processed', {
                            module: 'adapters.ticket-intake-polling',
                            processed_count: processed,
                        });
                    }
                }
                const backfill = await backfillPendingEmailTickets(25);
                if (backfill.processed > 0) {
                    operationalLogger.info('adapters.ticket_intake_polling.backfill_processed', {
                        module: 'adapters.ticket-intake-polling',
                        processed_count: backfill.processed,
                    });
                }
            });
            if (!lock.acquired) {
                operationalLogger.info('adapters.ticket_intake_polling.lock_not_acquired', {
                    module: 'adapters.ticket-intake-polling',
                    lock_namespace: this.advisoryLockNamespace,
                    lock_key: this.advisoryLockKey,
                });
            }
        } finally {
            this.isPolling = false;
        }
    }
}

export const ticketIntakePollingService = new TicketIntakePollingService();
