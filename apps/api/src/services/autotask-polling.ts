import { AutotaskClient } from '../clients/autotask.js';
import { queryOne, withTryAdvisoryLock } from '../db/index.js';
import type { WorkflowEventEnvelope } from './ticket-workflow-core.js';
import { triageOrchestrator } from './triage-orchestrator.js';
import { workflowService } from './workflow-runtime.js';
import { classifyQueueError } from '../platform/errors.js';

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
type SyncRetryDisposition = 'retry_pending' | 'dlq';
type SyncRetryEntry = {
  event: WorkflowEventEnvelope;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: number;
  disposition: SyncRetryDisposition;
  lastError: string;
  errorCode: string;
};

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
  private readonly nowFn: () => number;
  private readonly retryBackoffMsFn: (attempt: number) => number;
  private readonly syncRetryMaxAttempts: number;
  private readonly syncRetryQueue = new Map<string, SyncRetryEntry>();
  private readonly syncDlq = new Map<string, SyncRetryEntry>();

  constructor(input?: {
    pollIntervalMs?: number;
    buildPollContext?: () => Promise<AutotaskPollContext | null>;
    workflowSync?: (event: WorkflowEventEnvelope) => Promise<unknown>;
    triageRun?: (ticketId: string) => Promise<void>;
    runWithLock?: (fn: () => Promise<void>) => Promise<PollLockResult>;
    now?: () => number;
    retryBackoffMs?: (attempt: number) => number;
    syncRetryMaxAttempts?: number;
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
    this.nowFn = input?.now || (() => Date.now());
    this.retryBackoffMsFn = input?.retryBackoffMs || ((attempt) => {
      const base = 1_000;
      const exponent = Math.min(Math.max(attempt - 1, 0), 6);
      return Math.min(base * Math.pow(2, exponent), 60_000);
    });
    this.syncRetryMaxAttempts = Math.max(1, Number(input?.syncRetryMaxAttempts ?? 5));
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
        await this.processPendingSyncRetries();
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

    await this.dispatchSyncEvent(event, 'autotask.poller');
  }

  private async processPendingSyncRetries(): Promise<void> {
    if (this.syncRetryQueue.size === 0) return;
    const now = this.nowFn();
    const due = Array.from(this.syncRetryQueue.values()).filter((entry) => (entry.nextRetryAt ?? 0) <= now);
    for (const entry of due) {
      await this.dispatchSyncEvent(entry.event, 'autotask.retry');
    }
  }

  private async dispatchSyncEvent(event: WorkflowEventEnvelope, source: 'autotask.poller' | 'autotask.retry'): Promise<void> {
    const key = `${event.tenant_id}::${event.event_id}`;
    try {
      await this.workflowSyncFn(event);
      this.syncRetryQueue.delete(key);
    } catch (error) {
      const classified = classifyQueueError(error);
      const retryable = classified.disposition === 'retry';
      const previous = this.syncRetryQueue.get(key);
      const attempts = (previous?.attempts ?? 0) + 1;
      const ticketId = String(event.correlation.ticket_id || event.entity_id || '').trim();
      const operation: SyncRetryEntry = {
        event,
        attempts,
        maxAttempts: this.syncRetryMaxAttempts,
        disposition: (!retryable || attempts >= this.syncRetryMaxAttempts) ? 'dlq' : 'retry_pending',
        ...(retryable && attempts < this.syncRetryMaxAttempts
          ? { nextRetryAt: this.nowFn() + this.retryBackoffMsFn(attempts) }
          : {}),
        lastError: String((error as any)?.message || error || 'unknown sync error'),
        errorCode: classified.code,
      };
      if (operation.disposition === 'retry_pending') {
        this.syncRetryQueue.set(key, operation);
      } else {
        this.syncRetryQueue.delete(key);
        this.syncDlq.set(key, operation);
      }

      console.error(
        '[AutotaskPolling] Workflow sync ingestion failed',
        JSON.stringify({
          source,
          tenant_id: event.tenant_id,
          ticket_id: ticketId,
          trace_id: event.correlation.trace_id,
          classification: classified,
          degraded_mode: true,
          operation: {
            attempts: operation.attempts,
            max_attempts: operation.maxAttempts,
            disposition: operation.disposition,
            ...(operation.nextRetryAt ? { next_retry_at: new Date(operation.nextRetryAt).toISOString() } : {}),
          },
        }),
      );
    }
  }
}

export const autotaskPollingService = new AutotaskPollingService();
