import { AutotaskClient } from '../clients/autotask.js';
import { queryOne, withTryAdvisoryLock } from '../db/index.js';
import { triageOrchestrator } from './triage-orchestrator.js';

interface AutotaskCreds {
    apiIntegrationCode: string;
    username: string;
    secret: string;
    zoneUrl?: string;
}

export class AutotaskPollingService {
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    // Polling interval in ms (default: 60 seconds)
    private pollIntervalMs = 60 * 1000;
    private readonly advisoryLockNamespace = 41023;
    private readonly advisoryLockKey = 1;
    constructor() { }

    private async getAutotaskCredentials(): Promise<AutotaskCreds | null> {
        try {
            const latest = await queryOne<{ credentials: AutotaskCreds }>(
                `SELECT credentials
                 FROM integration_credentials
                 WHERE service = 'autotask'
                 ORDER BY updated_at DESC
                 LIMIT 1`
            );
            if (latest?.credentials?.apiIntegrationCode && latest.credentials?.username && latest.credentials?.secret) {
                return latest.credentials;
            }
        } catch {
            // Fall through to env fallback if DB is unavailable / table not ready.
        }

        const apiIntegrationCode =
            process.env.AUTOTASK_API_INTEGRATION_CODE ||
            process.env.AUTOTASK_API_INTEGRATIONCODE ||
            '';
        const username =
            process.env.AUTOTASK_USERNAME ||
            process.env.AUTOTASK_API_USER ||
            '';
        const secret =
            process.env.AUTOTASK_SECRET ||
            process.env.AUTOTASK_API_SECRET ||
            '';
        const zoneUrl = process.env.AUTOTASK_ZONE_URL || undefined;

        if (!apiIntegrationCode || !username || !secret) return null;
        return { apiIntegrationCode, username, secret, ...(zoneUrl ? { zoneUrl } : {}) };
    }

    private async buildClient(): Promise<AutotaskClient | null> {
        const creds = await this.getAutotaskCredentials();
        if (!creds) return null;
        return new AutotaskClient(creds);
    }

    start() {
        if (this.intervalId) {
            console.log('[AutotaskPolling] Already running.');
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
            const lock = await withTryAdvisoryLock(this.advisoryLockNamespace, this.advisoryLockKey, async () => {
                const client = await this.buildClient();
                if (!client) {
                    console.warn('[AutotaskPolling] Missing Autotask credentials (DB/UI and env fallback). Skipping poll.');
                    return;
                }

                // Find tickets created in the last 1 hour
                // Autotask REST API allows querying by CreateDate
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

                // We search for new tickets. You can adjust the filter as needed (e.g. specific queues).
                // Note: We're passing the raw string filter for now.
                const filter = `{"op": "gt", "field": "createDate", "value": "${oneHourAgo}"}`;

                // In apps/api/src/clients/autotask.ts, searchTickets expects a string 'filter' that gets passed as 'search' param
                // According to Autotask API, search param is a JSON string of filters.
                const tickets = await client.searchTickets(filter, 50, 0);

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
                }
            });
            if (!lock.acquired) {
                console.log('[AutotaskPolling] Another instance holds the polling lock. Skipping this iteration.');
            }
        } catch (error) {
            console.error('[AutotaskPolling] Polling failed:', error);
        } finally {
            this.isPolling = false;
        }
    }
}

export const autotaskPollingService = new AutotaskPollingService();
