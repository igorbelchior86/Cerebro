import { AutotaskClient } from '../../clients/autotask.js';
import { queryOne, withTryAdvisoryLock } from '../../db/index.js';
import type { WorkflowEventEnvelope } from '../orchestration/ticket-workflow-core.js';
import { triageOrchestrator } from '../orchestration/triage-orchestrator.js';
import { workflowService } from '../orchestration/workflow-runtime.js';
import { classifyQueueError } from '../../platform/errors.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import { readJsonFileSafe, writeJsonFileAtomic } from '../read-models/runtime-json-file.js';

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

type ParityBackfillTenantState = {
  cursor_iso: string;
  completed: boolean;
  updated_at: string;
};

type ParityBackfillStateFile = {
  tenants: Record<string, ParityBackfillTenantState>;
};

type ParityQueueScope = {
  queues: Array<Record<string, unknown>>;
  excludedQueueIds: Set<number>;
};

function looksLikeNumericId(value: string): boolean {
  return /^[0-9]+$/.test(value.trim());
}

function normalizeQueueName(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export class AutotaskPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private rateLimitCooldownUntil: number | null = null;
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
  private readonly parityBackfillEnabled: boolean;
  private readonly parityActiveOnly: boolean;
  private readonly parityBackfillStateFilePath: string;
  private readonly parityBackfillStartIso: string;
  private readonly parityBackfillChunkHours: number;
  private readonly parityBackfillWindowsPerRun: number;
  private readonly parityPurgeEnabled: boolean;
  private readonly parityPurgeMaxChecksPerRun: number;
  private readonly parityQueueSnapshotEnabled: boolean;
  private readonly parityQueueSnapshotMaxRecords: number;
  private readonly parityActiveExcludedQueueNames: Set<string>;
  private parityBackfillStateCache: ParityBackfillStateFile | null = null;

  constructor(input?: {
    pollIntervalMs?: number;
    buildPollContext?: () => Promise<AutotaskPollContext | null>;
    workflowSync?: (event: WorkflowEventEnvelope) => Promise<unknown>;
    triageRun?: (ticketId: string) => Promise<void>;
    runWithLock?: (fn: () => Promise<void>) => Promise<PollLockResult>;
    now?: () => number;
    retryBackoffMs?: (attempt: number) => number;
    syncRetryMaxAttempts?: number;
    parityBackfillEnabled?: boolean;
    parityActiveOnly?: boolean;
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
    this.parityBackfillEnabled = Boolean(input?.parityBackfillEnabled ?? false);
    this.parityActiveOnly = Boolean(
      input?.parityActiveOnly ??
      (String(process.env.AUTOTASK_PARITY_ACTIVE_ONLY || 'true').toLowerCase() === 'true'),
    );
    this.parityBackfillStateFilePath = process.env.AUTOTASK_PARITY_STATE_FILE || `${process.cwd()}/.run/autotask-parity-state.json`;
    this.parityBackfillStartIso = String(process.env.AUTOTASK_PARITY_START_DATE || '2000-01-01T00:00:00.000Z');
    this.parityBackfillChunkHours = Math.max(1, Number(process.env.AUTOTASK_PARITY_CHUNK_HOURS || 168));
    this.parityBackfillWindowsPerRun = Math.max(1, Number(process.env.AUTOTASK_PARITY_WINDOWS_PER_RUN || 48));
    this.parityPurgeEnabled = String(process.env.AUTOTASK_PARITY_PURGE_ENABLED || 'true').toLowerCase() === 'true';
    this.parityPurgeMaxChecksPerRun = Math.max(1, Number(process.env.AUTOTASK_PARITY_PURGE_MAX_CHECKS || 25));
    this.parityQueueSnapshotEnabled = String(process.env.AUTOTASK_PARITY_QUEUE_SNAPSHOT_ENABLED || 'true').toLowerCase() === 'true';
    this.parityQueueSnapshotMaxRecords = Math.max(25, Math.min(500, Number(process.env.AUTOTASK_PARITY_QUEUE_SNAPSHOT_MAX_RECORDS || 200)));
    this.parityActiveExcludedQueueNames = new Set(
      String(process.env.AUTOTASK_PARITY_ACTIVE_EXCLUDED_QUEUES || 'complete')
        .split(',')
        .map((entry) => normalizeQueueName(entry))
        .filter(Boolean),
    );
  }

  private async getAutotaskCredentials(): Promise<{ tenantId?: string; credentials: AutotaskCreds } | null> {
    const preferredTenantId =
      process.env.AUTOTASK_POLLER_TENANT_ID ||
      process.env.P0_SYSTEM_TENANT_ID ||
      process.env.DEFAULT_TENANT_ID ||
      undefined;
    try {
      if (preferredTenantId) {
        const latest = await queryOne<{ tenant_id?: string | null; credentials: AutotaskCreds }>(
          `SELECT tenant_id, credentials
           FROM integration_credentials
           WHERE tenant_id = $1 AND service = 'autotask'
           ORDER BY updated_at DESC
           LIMIT 1`,
          [preferredTenantId]
        );
        if (latest?.credentials?.apiIntegrationCode && latest.credentials?.username && latest.credentials?.secret) {
          return {
            ...(latest.tenant_id ? { tenantId: String(latest.tenant_id) } : {}),
            credentials: latest.credentials,
          };
        }
      } else {
        const candidates = await queryOne<{ rows: Array<{ tenant_id?: string | null; credentials: AutotaskCreds }> }>(
          `SELECT json_agg(x) AS rows
           FROM (
             SELECT tenant_id, credentials
             FROM integration_credentials
             WHERE service = 'autotask' AND tenant_id IS NOT NULL
             ORDER BY updated_at DESC
             LIMIT 2
           ) x`
        );
        const rows = Array.isArray(candidates?.rows) ? candidates.rows : [];
        const uniqueTenants = Array.from(new Set(rows.map((r) => String(r.tenant_id || '').trim()).filter(Boolean)));
        if (uniqueTenants.length === 1) {
          const row = rows.find((r) => String(r.tenant_id || '').trim() === uniqueTenants[0]);
          if (row?.credentials?.apiIntegrationCode && row.credentials?.username && row.credentials?.secret) {
            return {
              ...(uniqueTenants[0] ? { tenantId: uniqueTenants[0] } : {}),
              credentials: row.credentials,
            };
          }
        }
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
    const tenantId = preferredTenantId;

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
      operationalLogger.info('adapters.autotask_polling.already_running', {
        module: 'adapters.autotask-polling',
      });
      return;
    }

    operationalLogger.info('adapters.autotask_polling.started', {
      module: 'adapters.autotask-polling',
      poll_interval_ms: this.pollIntervalMs,
      parity_active_only: this.parityActiveOnly,
    });

    this.runOnce().catch((error) => operationalLogger.error(
      'adapters.autotask_polling.initial_run_failed',
      error,
      {
        module: 'adapters.autotask-polling',
        integration: 'autotask',
        signal: 'integration_failure',
        degraded_mode: true,
      },
    ));
    this.intervalId = setInterval(() => {
      this.runOnce().catch((error) => operationalLogger.error(
        'adapters.autotask_polling.run_failed',
        error,
        {
          module: 'adapters.autotask-polling',
          integration: 'autotask',
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
      operationalLogger.info('adapters.autotask_polling.stopped', {
        module: 'adapters.autotask-polling',
      });
    }
  }

  async runOnce(): Promise<void> {
    if (this.isPolling) {
      operationalLogger.info('adapters.autotask_polling.skip_overlap', {
        module: 'adapters.autotask-polling',
      });
      return;
    }

    this.isPolling = true;
    try {
      const now = this.nowFn();
      if (this.rateLimitCooldownUntil && now < this.rateLimitCooldownUntil) {
        operationalLogger.warn('adapters.autotask_polling.rate_limit_cooldown_active', {
          module: 'adapters.autotask-polling',
          integration: 'autotask',
          signal: 'integration_failure',
          degraded_mode: true,
          cooldown_until: new Date(this.rateLimitCooldownUntil).toISOString(),
        });
        return;
      }

      const lock = await this.runWithLockFn(async () => {
        await this.processPendingSyncRetries();
        const context = await this.buildPollContextFn();
        if (!context) {
          operationalLogger.warn('adapters.autotask_polling.credentials_missing', {
            module: 'adapters.autotask-polling',
            integration: 'autotask',
            signal: 'integration_failure',
            degraded_mode: true,
          });
          return;
        }

        if (this.parityBackfillEnabled && !this.parityActiveOnly) {
          await this.runParityBackfill(context);
        }

        const queueScope = await this.resolveParityQueueScope(context);
        if (this.parityQueueSnapshotEnabled) {
          try {
            await this.runQueueParitySnapshot(context, queueScope);
          } catch (error) {
            operationalLogger.warn('adapters.autotask_polling.parity_queue_snapshot_failed', {
              module: 'adapters.autotask-polling',
              integration: 'autotask',
              signal: 'integration_failure',
              degraded_mode: true,
              reason: String((error as Error)?.message || error || 'unknown_error'),
            }, { tenant_id: context.tenantId || null });
          }
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const filter = `{"op": "gt", "field": "createDate", "value": "${oneHourAgo}"}`;
        let tickets = await context.client.searchTickets(filter, 50, 0);
        if (this.parityActiveOnly && queueScope) {
          tickets = tickets.filter((ticket) => {
            const queueId = Number((ticket as any)?.queueID);
            return !Number.isFinite(queueId) || !queueScope.excludedQueueIds.has(queueId);
          });
        }

        if (!tickets || tickets.length === 0) return;

        operationalLogger.info('adapters.autotask_polling.tickets_found', {
          module: 'adapters.autotask-polling',
          ticket_count: tickets.length,
        });
        for (const ticket of tickets) {
          const ticketIdStr = String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
          if (!ticketIdStr) continue;
          await this.ingestWorkflowSyncEvent(ticket as unknown as Record<string, unknown>, context.tenantId);
          try {
            await this.triageRunFn(String((ticket as any)?.id ?? ticketIdStr));
          } catch (err) {
            operationalLogger.error('adapters.autotask_polling.orchestration_failed', err, {
              module: 'adapters.autotask-polling',
              integration: 'autotask',
              signal: 'integration_failure',
              degraded_mode: true,
            }, { ticket_id: ticketIdStr });
          }
        }

        if (this.parityPurgeEnabled) {
          await this.purgeMissingAutotaskTickets(context);
        }
      });
      if (!lock.acquired) {
        operationalLogger.info('adapters.autotask_polling.lock_not_acquired', {
          module: 'adapters.autotask-polling',
          lock_namespace: this.advisoryLockNamespace,
          lock_key: this.advisoryLockKey,
        });
      }
    } catch (error) {
      const classified = classifyQueueError(error);
      if (classified.code === 'RATE_LIMIT') {
        this.rateLimitCooldownUntil = this.nowFn() + (15 * 60 * 1000);
        operationalLogger.warn('adapters.autotask_polling.rate_limit_cooldown_entered', {
          module: 'adapters.autotask-polling',
          integration: 'autotask',
          signal: 'integration_failure',
          degraded_mode: true,
          cooldown_until: new Date(this.rateLimitCooldownUntil).toISOString(),
        });
      }
      operationalLogger.error('adapters.autotask_polling.poll_failed', error, {
        module: 'adapters.autotask-polling',
        integration: 'autotask',
        signal: 'integration_failure',
        degraded_mode: true,
      });
    } finally {
      this.isPolling = false;
    }
  }

  private getParityState(): ParityBackfillStateFile {
    if (this.parityBackfillStateCache) return this.parityBackfillStateCache;
    const loaded = readJsonFileSafe<ParityBackfillStateFile>(this.parityBackfillStateFilePath);
    this.parityBackfillStateCache = loaded && loaded.tenants ? loaded : { tenants: {} };
    return this.parityBackfillStateCache;
  }

  private saveParityState(): void {
    writeJsonFileAtomic(this.parityBackfillStateFilePath, this.getParityState());
  }

  private getTenantBackfillState(tenantId: string): ParityBackfillTenantState {
    const state = this.getParityState();
    const existing = state.tenants[tenantId];
    if (existing) return existing;
    const created: ParityBackfillTenantState = {
      cursor_iso: this.parityBackfillStartIso,
      completed: false,
      updated_at: new Date().toISOString(),
    };
    state.tenants[tenantId] = created;
    this.saveParityState();
    return created;
  }

  private updateTenantBackfillState(tenantId: string, next: ParityBackfillTenantState): void {
    const state = this.getParityState();
    state.tenants[tenantId] = next;
    this.saveParityState();
  }

  private async fetchTicketsByCreateDateWindow(
    context: AutotaskPollContext,
    startIso: string,
    endIso: string,
    maxRecords = 200,
    depth = 0,
  ): Promise<Record<string, unknown>[]> {
    const filter = JSON.stringify({
      MaxRecords: maxRecords,
      filter: [
        { op: 'gte', field: 'createDate', value: startIso },
        { op: 'lt', field: 'createDate', value: endIso },
      ],
    });
    const rows = (await context.client.searchTickets(filter, maxRecords, 0)) as unknown as Record<string, unknown>[];
    if (rows.length < maxRecords) return rows;

    // Split dense windows to avoid truncation and guarantee reconciliation coverage.
    if (depth >= 8) return rows;
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs <= 60_000) return rows;

    const midMs = Math.floor((startMs + endMs) / 2);
    const midIso = new Date(midMs).toISOString();
    const left = await this.fetchTicketsByCreateDateWindow(context, startIso, midIso, maxRecords, depth + 1);
    const right = await this.fetchTicketsByCreateDateWindow(context, midIso, endIso, maxRecords, depth + 1);
    const dedup = new Map<string, Record<string, unknown>>();
    for (const row of [...left, ...right]) {
      const key = String((row as any).ticketNumber || (row as any).id || '').trim();
      if (!key) continue;
      dedup.set(key, row);
    }
    return Array.from(dedup.values());
  }

  private async runParityBackfill(context: AutotaskPollContext): Promise<void> {
    const tenantId = String(context.tenantId || '').trim();
    if (!tenantId) return;

    const now = this.nowFn();
    const catchupTargetMs = now - 5 * 60 * 1000;
    const tenantState = this.getTenantBackfillState(tenantId);
    if (tenantState.completed) return;

    const cursorMs = Date.parse(tenantState.cursor_iso);
    if (!Number.isFinite(cursorMs)) {
      this.updateTenantBackfillState(tenantId, {
        cursor_iso: this.parityBackfillStartIso,
        completed: false,
        updated_at: new Date().toISOString(),
      });
      return;
    }
    if (cursorMs >= catchupTargetMs) {
      this.updateTenantBackfillState(tenantId, {
        cursor_iso: tenantState.cursor_iso,
        completed: true,
        updated_at: new Date().toISOString(),
      });
      operationalLogger.info('adapters.autotask_polling.parity_backfill_completed', {
        module: 'adapters.autotask-polling',
        tenant_id: tenantId,
      }, { tenant_id: tenantId });
      return;
    }

    let currentCursorMs = cursorMs;
    let windowsProcessed = 0;
    while (currentCursorMs < catchupTargetMs && windowsProcessed < this.parityBackfillWindowsPerRun) {
      const nextMs = Math.min(currentCursorMs + this.parityBackfillChunkHours * 60 * 60 * 1000, catchupTargetMs);
      const windowStartIso = new Date(currentCursorMs).toISOString();
      const windowEndIso = new Date(nextMs).toISOString();
      const tickets = await this.fetchTicketsByCreateDateWindow(context, windowStartIso, windowEndIso);
      for (const ticket of tickets) {
        await this.ingestWorkflowSyncEvent(ticket, tenantId, 'autotask_reconcile');
      }
      this.updateTenantBackfillState(tenantId, {
        cursor_iso: windowEndIso,
        completed: nextMs >= catchupTargetMs,
        updated_at: new Date().toISOString(),
      });
      operationalLogger.info('adapters.autotask_polling.parity_backfill_window_applied', {
        module: 'adapters.autotask-polling',
        tenant_id: tenantId,
        window_start: windowStartIso,
        window_end: windowEndIso,
        ticket_count: tickets.length,
        completed: nextMs >= catchupTargetMs,
      }, { tenant_id: tenantId });
      currentCursorMs = nextMs;
      windowsProcessed += 1;
    }
  }

  private async resolveParityQueueScope(context: AutotaskPollContext): Promise<ParityQueueScope | null> {
    if (typeof (context.client as { getTicketQueues?: unknown }).getTicketQueues !== 'function') return null;

    const queues = await context.client.getTicketQueues().catch(() => []);
    if (!Array.isArray(queues)) return null;

    const excludedQueueIds = new Set<number>();
    for (const queue of queues) {
      const queueId = Number((queue as { id?: number }).id);
      const queueName = normalizeQueueName(
        (queue as { name?: string; label?: string; value?: string }).name ||
        (queue as { label?: string }).label ||
        (queue as { value?: string }).value ||
        '',
      );
      if (Number.isFinite(queueId) && queueName && this.parityActiveExcludedQueueNames.has(queueName)) {
        excludedQueueIds.add(queueId);
      }
    }

    return { queues: queues as Array<Record<string, unknown>>, excludedQueueIds };
  }

  private async runQueueParitySnapshot(context: AutotaskPollContext, scope?: ParityQueueScope | null): Promise<void> {
    const tenantId = String(context.tenantId || '').trim();
    if (!tenantId) return;
    const queues = scope?.queues || await this.resolveParityQueueScope(context).then((resolved) => resolved?.queues || []);
    if (!Array.isArray(queues) || queues.length === 0) return;
    const excludedQueueIds = scope?.excludedQueueIds || new Set<number>();

    for (const queue of queues) {
      const queueId = Number((queue as { id?: number }).id);
      if (!Number.isFinite(queueId)) continue;
      if (this.parityActiveOnly && excludedQueueIds.has(queueId)) continue;
      const search = JSON.stringify({
        MaxRecords: this.parityQueueSnapshotMaxRecords,
        filter: [{ op: 'eq', field: 'queueID', value: queueId }],
      });
      const rows = (await context.client.searchTickets(search, this.parityQueueSnapshotMaxRecords, 0)) as unknown as Record<string, unknown>[];
      for (const ticket of rows) {
        await this.ingestWorkflowSyncEvent(ticket, tenantId, 'autotask_reconcile');
      }
    }
  }

  private async purgeMissingAutotaskTickets(context: AutotaskPollContext): Promise<void> {
    const tenantId = String(context.tenantId || '').trim();
    if (!tenantId) return;

    const inbox = await workflowService.listInbox(tenantId);
    const candidates = inbox.slice(0, this.parityPurgeMaxChecksPerRun);
    for (const row of candidates) {
      const externalId = String(row.external_id || '').trim();
      const ticketNumber = String(
        row.ticket_number ||
        (row.domain_snapshots?.tickets?.ticket_number as string) ||
        '',
      ).trim();
      const ticketId = String(row.ticket_id || '').trim();

      let exists = false;
      try {
        if (externalId && looksLikeNumericId(externalId)) {
          await context.client.getTicket(Number(externalId));
          exists = true;
        } else if (ticketNumber) {
          await context.client.getTicketByTicketNumber(ticketNumber);
          exists = true;
        } else if (ticketId && looksLikeNumericId(ticketId)) {
          await context.client.getTicket(Number(ticketId));
          exists = true;
        } else if (ticketId) {
          await context.client.getTicketByTicketNumber(ticketId);
          exists = true;
        }
      } catch (error) {
        const message = String((error as Error)?.message || error || '').toLowerCase();
        if (message.includes('not found')) {
          exists = false;
        } else {
          continue;
        }
      }
      if (exists) continue;

      await workflowService.removeInboxTicket(tenantId, ticketId, {
        reason: 'autotask_ticket_not_found',
        correlation: {
          trace_id: `autotask-purge-${Date.now()}`,
          ticket_id: ticketId,
        },
        metadata: {
          external_id: externalId || undefined,
          ticket_number: ticketNumber || undefined,
        },
      });
      operationalLogger.info('adapters.autotask_polling.parity_purge_ticket_removed', {
        module: 'adapters.autotask-polling',
        tenant_id: tenantId,
        ticket_id: ticketId,
      }, {
        tenant_id: tenantId,
        ticket_id: ticketId,
      });
    }
  }

  private async ingestWorkflowSyncEvent(
    ticket: Record<string, unknown>,
    tenantId?: string,
    source: 'autotask_poller' | 'autotask_reconcile' = 'autotask_poller',
  ): Promise<void> {
    if (!tenantId) {
      operationalLogger.warn('adapters.autotask_polling.workflow_sync_skipped_missing_tenant', {
        module: 'adapters.autotask-polling',
        integration: 'autotask',
        signal: 'integration_failure',
        degraded_mode: true,
      }, { ticket_id: String(ticket.ticketNumber || ticket.id || '') || null });
      return;
    }

    const rawId = String(ticket.id ?? '').trim();
    const ticketRef = String(ticket.ticketNumber || rawId).trim();
    if (!ticketRef) return;
    const occurredAt = String(ticket.lastActivityDate || ticket.createDate || new Date().toISOString());
    const eventId = `${source}:${rawId || ticketRef}:ticket.created:${occurredAt}`;

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
        source,
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

      operationalLogger.error('adapters.autotask_polling.workflow_sync_ingestion_failed', error, {
        module: 'adapters.autotask-polling',
        integration: 'autotask',
        signal: 'integration_failure',
        source,
        classification_code: classified.code,
        classification_disposition: classified.disposition,
        degraded_mode: true,
        operation_attempts: operation.attempts,
        operation_max_attempts: operation.maxAttempts,
        operation_disposition: operation.disposition,
        ...(operation.nextRetryAt ? { operation_next_retry_at: new Date(operation.nextRetryAt).toISOString() } : {}),
      }, {
        tenant_id: event.tenant_id,
        ticket_id: ticketId || null,
        trace_id: event.correlation.trace_id || null,
      });
    }
  }
}

export const autotaskPollingService = new AutotaskPollingService({
  parityBackfillEnabled: String(process.env.AUTOTASK_PARITY_ENFORCED || 'true').toLowerCase() === 'true',
  parityActiveOnly: String(process.env.AUTOTASK_PARITY_ACTIVE_ONLY || 'true').toLowerCase() === 'true',
});
