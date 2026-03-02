import { backfillPendingEmailTickets, ingestSupportMailboxOnce } from '../application/route-handlers/email-ingestion-route-handlers.js';
import { withTryAdvisoryLock } from '../../db/index.js';
import { operationalLogger } from '../../lib/operational-logger.js';

export class EmailIngestionPollingService {
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    private pollIntervalMs = parseInt(process.env.EMAIL_INGEST_POLL_INTERVAL_MS || '60000', 10);
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
            operationalLogger.info('adapters.email_ingestion_polling.already_running', {
                module: 'adapters.email-ingestion-polling',
            });
            return;
        }

        if (!hasGraphCreds) {
            operationalLogger.warn('adapters.email_ingestion_polling.graph_credentials_missing', {
                module: 'adapters.email-ingestion-polling',
                integration: 'microsoft_graph',
                signal: 'integration_failure',
                degraded_mode: true,
            });
        }

        operationalLogger.info('adapters.email_ingestion_polling.started', {
            module: 'adapters.email-ingestion-polling',
            poll_interval_ms: this.pollIntervalMs,
        });
        this.poll().catch((err) => operationalLogger.error(
            'adapters.email_ingestion_polling.initial_poll_failed',
            err,
            {
                module: 'adapters.email-ingestion-polling',
                signal: 'integration_failure',
                degraded_mode: true,
            },
        ));

        this.intervalId = setInterval(() => {
            this.poll().catch((err) => operationalLogger.error(
                'adapters.email_ingestion_polling.poll_failed',
                err,
                {
                    module: 'adapters.email-ingestion-polling',
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
            operationalLogger.info('adapters.email_ingestion_polling.stopped', {
                module: 'adapters.email-ingestion-polling',
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
                        operationalLogger.info('adapters.email_ingestion_polling.emails_processed', {
                            module: 'adapters.email-ingestion-polling',
                            processed_count: processed,
                        });
                    }
                }
                const backfill = await backfillPendingEmailTickets(25);
                if (backfill.processed > 0) {
                    operationalLogger.info('adapters.email_ingestion_polling.backfill_processed', {
                        module: 'adapters.email-ingestion-polling',
                        processed_count: backfill.processed,
                    });
                }
            });
            if (!lock.acquired) {
                operationalLogger.info('adapters.email_ingestion_polling.lock_not_acquired', {
                    module: 'adapters.email-ingestion-polling',
                    lock_namespace: this.advisoryLockNamespace,
                    lock_key: this.advisoryLockKey,
                });
            }
        } finally {
            this.isPolling = false;
        }
    }
}

export const emailIngestionPollingService = new EmailIngestionPollingService();
