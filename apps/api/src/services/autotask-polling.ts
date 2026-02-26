import { AutotaskClient } from '../clients/autotask.js';
import { queryOne, withTryAdvisoryLock } from '../db/index.js';
import type { WorkflowEventEnvelope } from './ticket-workflow-core.js';
import { triageOrchestrator } from './triage-orchestrator.js';
import { workflowService } from './workflow-runtime.js';

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

type AutotaskPollContext = {
  client: AutotaskClient;
  tenantId?: string;
};

type PollLockResult = { acquired: boolean };

export class AutotaskPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private pollIntervalMs = 60 * 1000;
  private readonly advisoryLockNamespace = 41023;
  private readonly advisoryLockKey = 1;
  private readonly buildPollContextFn: () => Promise<AutotaskPollContext | null>;
  private readonly workflowSyncFn: (event: WorkflowEventEnvelope) => Promise<unknown>;
  private readonly triageRunFn: (ticketId: string) => Promise<void>;
  private readonly runWithLockFn: (fn: () => Promise<void>) => Promise<PollLockResult>;

  constructor(input?: {
    pollIntervalMs?: number;
    buildPollContext?: () => Promise<AutotaskPollContext | null>;
    workflowSync?: (event: WorkflowEventEnvelope) => Promise<unknown>;
    triageRun?: (ticketId: string) => Promise<void>;
    runWithLock?: (fn: () => Promise<void>) => Promise<PollLockResult>;
  }) {
    if (Number.isFinite(Number(input?.pollIntervalMs))) {
      this.pollIntervalMs = Math.max(5_000, Number(input?.pollIntervalMs));
    }
    this.buildPollContextFn = input?.buildPollContext || (() => this.buildPollContext());
    this.workflowSyncFn = input?.workflowSync || ((event) => workflowService.processAutotaskSyncEvent(event));
    this.triageRunFn = input?.triageRun || ((ticketId) => triageOrchestrator.runPipeline(ticketId, undefined, 'autotask'));
    this.runWithLockFn = input?.runWithLock || (async (fn) =>
      withTryAdvisoryLock(this.advisoryLockNamespace, this.advisoryLockKey, async () => {
        await fn();
      }));
  }

  private async getAutotaskCredentials(): Promise<{ tenantId?: string; credentials: AutotaskCreds } | null> {
    try {
      const latest = await queryOne<{ tenant_id?: string | null; credentials: AutotaskCreds }>(
        `SELECT tenant_id, credentials
         FROM integration_credentials
         WHERE service = 'autotask'
         ORDER BY updated_at DESC
         LIMIT 1`
      );
      if (latest?.credentials?.apiIntegrationCode && latest.credentials?.username && latest.credentials?.secret) {
        return {
          ...(latest.tenant_id ? { tenantId: String(latest.tenant_id) } : {}),
          credentials: latest.credentials,
        };
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
    const tenantId =
      process.env.AUTOTASK_POLLER_TENANT_ID ||
      process.env.P0_SYSTEM_TENANT_ID ||
      process.env.DEFAULT_TENANT_ID ||
      undefined;

    if (!apiIntegrationCode || !username || !secret) return null;
    return {
      ...(tenantId ? { tenantId } : {}),
      credentials: { apiIntegrationCode, username, secret, ...(zoneUrl ? { zoneUrl } : {}) },
    };
  }

  private async buildPollContext(): Promise<AutotaskPollContext | null> {
    const creds = await this.getAutotaskCredentials();
    if (!creds) return null;
    return {
      client: new AutotaskClient(creds.credentials),
      ...(creds.tenantId ? { tenantId: creds.tenantId } : {}),
    };
  }

  start() {
    if (this.intervalId) {
      console.log('[AutotaskPolling] Already running.');
      return;
    }

    console.log(`[AutotaskPolling] Starting polling service. Interval: ${this.pollIntervalMs}ms`);

    this.runOnce().catch(console.error);
    this.intervalId = setInterval(() => {
      this.runOnce().catch(console.error);
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[AutotaskPolling] Stopped.');
    }
  }

  async runOnce(): Promise<void> {
    if (this.isPolling) {
      console.log('[AutotaskPolling] Previous poll still running, skipping this iteration.');
      return;
    }

    this.isPolling = true;
    try {
      const lock = await this.runWithLockFn(async () => {
        const context = await this.buildPollContextFn();
        if (!context) {
          console.warn('[AutotaskPolling] Missing Autotask credentials (DB/UI and env fallback). Skipping poll.');
          return;
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const filter = `{"op": "gt", "field": "createDate", "value": "${oneHourAgo}"}`;
        const tickets = await context.client.searchTickets(filter, 50, 0);

        if (!tickets || tickets.length === 0) return;

        console.log(`[AutotaskPolling] Found ${tickets.length} recently created tickets.`);
        for (const ticket of tickets) {
          const ticketIdStr = String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
          if (!ticketIdStr) continue;
          await this.ingestWorkflowSyncEvent(ticket as unknown as Record<string, unknown>, context.tenantId);
          try {
            await this.triageRunFn(String((ticket as any)?.id ?? ticketIdStr));
          } catch (err) {
            console.error(`[AutotaskPolling] Error orchestrating ticket ${(ticket as any)?.id}:`, err);
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

  private async ingestWorkflowSyncEvent(ticket: Record<string, unknown>, tenantId?: string): Promise<void> {
    if (!tenantId) {
      console.warn('[AutotaskPolling] Workflow sync ingestion skipped: no tenant_id available for poller runtime.');
      return;
    }

    const rawId = String(ticket.id ?? '').trim();
    const ticketRef = String(ticket.ticketNumber || rawId).trim();
    if (!ticketRef) return;
    const occurredAt = String(ticket.createDate || new Date().toISOString());
    const eventId = `autotask-poller:${rawId || ticketRef}:ticket.created:${occurredAt}`;

    const event: WorkflowEventEnvelope = {
      event_id: eventId,
      tenant_id: tenantId,
      event_type: 'ticket.created',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: ticketRef,
      payload: {
        external_id: rawId || ticketRef,
        ticket_number: String(ticket.ticketNumber || '').trim() || undefined,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        assigned_to: ticket.assignedResourceID,
        queue_id: ticket.queueID,
      },
      occurred_at: occurredAt,
      correlation: {
        trace_id: `autotask-poller-${rawId || ticketRef}`,
        ticket_id: ticketRef,
      },
      provenance: {
        source: 'autotask_poller',
        fetched_at: new Date().toISOString(),
      },
    };

    try {
      await this.workflowSyncFn(event);
    } catch (error) {
      console.error(`[AutotaskPolling] Workflow sync ingestion failed for ticket ${ticketRef}:`, error);
    }
  }
}

export const autotaskPollingService = new AutotaskPollingService();
