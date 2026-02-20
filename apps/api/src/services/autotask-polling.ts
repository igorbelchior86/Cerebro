import { AutotaskClient } from '../clients/autotask.js';
import { triageOrchestrator } from './triage-orchestrator.js';

export class AutotaskPollingService {
    private client: AutotaskClient;
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    // Polling interval in ms (default: 60 seconds)
    private pollIntervalMs = 60 * 1000;

    constructor() {
        this.client = new AutotaskClient({
            apiIntegrationCode: process.env.AUTOTASK_API_INTEGRATION_CODE || '',
            username: process.env.AUTOTASK_USERNAME || '',
            secret: process.env.AUTOTASK_SECRET || '',
        });
    }

    start() {
        if (this.intervalId) {
            console.log('[AutotaskPolling] Already running.');
            return;
        }

        // Only start if credentials are provided
        if (!process.env.AUTOTASK_API_INTEGRATION_CODE || !process.env.AUTOTASK_USERNAME || !process.env.AUTOTASK_SECRET) {
            console.warn('[AutotaskPolling] Missing Autotask credentials. Polling will NOT start.');
            return;
        }

        console.log(`[AutotaskPolling] Starting polling service. Interval: ${this.pollIntervalMs}ms`);

        // Initial poll
        this.poll().catch(console.error);

        // Schedule subsequent polls
        this.intervalId = setInterval(() => {
            this.poll().catch(console.error);
        }, this.pollIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[AutotaskPolling] Stopped.');
        }
    }

    private async poll() {
        if (this.isPolling) {
            console.log('[AutotaskPolling] Previous poll still running, skipping this iteration.');
            return;
        }

        this.isPolling = true;
        try {
            // Find tickets created in the last 1 hour
            // Autotask REST API allows querying by CreateDate
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            // We search for new tickets. You can adjust the filter as needed (e.g. specific queues).
            // Note: We're passing the raw string filter for now.
            const filter = `{"op": "gt", "field": "createDate", "value": "${oneHourAgo}"}`;

            // In apps/api/src/clients/autotask.ts, searchTickets expects a string 'filter' that gets passed as 'search' param
            // According to Autotask API, search param is a JSON string of filters.
            const tickets = await this.client.searchTickets(filter, 50, 0);

            if (tickets && tickets.length > 0) {
                console.log(`[AutotaskPolling] Found ${tickets.length} recently created tickets.`);

                for (const ticket of tickets) {
                    const ticketIdStr = String(ticket.id);
                    try {
                        // triageOrchestrator internally prevents duplicate sessions
                        await triageOrchestrator.runPipeline(ticketIdStr, undefined, 'autotask');
                    } catch (err) {
                        console.error(`[AutotaskPolling] Error orchestrating ticket ${ticket.id}:`, err);
                    }
                }
            } else {
                // console.log('[AutotaskPolling] No new tickets found.');
            }
        } catch (error) {
            console.error('[AutotaskPolling] Polling failed:', error);
        } finally {
            this.isPolling = false;
        }
    }
}

export const autotaskPollingService = new AutotaskPollingService();
