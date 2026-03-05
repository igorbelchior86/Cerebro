import { createHash } from 'node:crypto';
import { AutotaskClient } from '../../clients/autotask.js';
import { queryOne, withTryAdvisoryLock } from '../../db/index.js';
import type { InboxTicketState, WorkflowEventEnvelope } from '../orchestration/ticket-workflow-core.js';
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

type CanonicalIdentityLookup = {
  companyNameById: Map<number, string>;
  requesterNameByContactId: Map<number, string>;
  contactEmailByContactId: Map<number, string>;
};

type IdentityLookupPriority = 'newest-first' | 'oldest-first';

type CanonicalPicklistLabelMaps = {
  statusById: Map<number, string>;
  priorityById: Map<number, string>;
  issueTypeById: Map<number, string>;
  subIssueTypeById: Map<number, string>;
  slaById: Map<number, string>;
  queueById: Map<number, string>;
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

function normalizeStatusLabel(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isTerminalStatusLabel(value: unknown): boolean {
  const label = normalizeStatusLabel(value);
  if (!label) return false;
  return /(complete|completed|closed|resolved|done)/.test(label);
}

function resolveTicketReference(ticket: Record<string, unknown>): string {
  return String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
}

function getTicketRecencyMs(ticket: Record<string, unknown>): number {
  const raw = String(
    (ticket as any)?.lastActivityDate ||
    (ticket as any)?.createDateTime ||
    (ticket as any)?.createDate ||
    ''
  ).trim();
  const timestamp = Date.parse(raw);
  if (Number.isFinite(timestamp)) return timestamp;
  return Number.NEGATIVE_INFINITY;
}

function getTicketCreationMs(ticket: Record<string, unknown>): number {
  const raw = String(
    (ticket as any)?.createDateTime ||
    (ticket as any)?.createDate ||
    (ticket as any)?.lastActivityDate ||
    ''
  ).trim();
  const timestamp = Date.parse(raw);
  if (Number.isFinite(timestamp)) return timestamp;
  return Number.NEGATIVE_INFINITY;
}

function sortTicketsByRecencyDesc(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const delta = getTicketRecencyMs(b) - getTicketRecencyMs(a);
  if (delta !== 0) return delta;
  return resolveTicketReference(b).localeCompare(resolveTicketReference(a));
}

function buildCanonicalPayloadFingerprint(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
}

function hasMeaningfulIdentityValue(value: unknown, placeholders: string[]): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  return !placeholders.includes(raw.toLowerCase());
}

function inboxRowHasCanonicalIdentity(row?: InboxTicketState | null): boolean {
  if (!row) return false;
  const company = row.company || row.domain_snapshots?.tickets?.company_name || row.domain_snapshots?.tickets?.company;
  const requester = row.requester || row.domain_snapshots?.tickets?.contact_name || row.domain_snapshots?.tickets?.requester_name;
  return (
    hasMeaningfulIdentityValue(company, ['unknown org', 'unknown organization', 'unknown company', 'organization', 'company']) &&
    hasMeaningfulIdentityValue(requester, ['unknown requester', 'unknown user', 'requester', 'user', 'contact'])
  );
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  for (let index = 0; index < items.length; index += safeConcurrency) {
    const batch = items.slice(index, index + safeConcurrency);
    await Promise.all(batch.map(async (item) => worker(item)));
  }
}

export class AutotaskPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private rateLimitCooldownUntil: number | null = null;
  private authFailureCooldownUntil: number | null = null;
  private pollIntervalMs = 60 * 1000;
  private readonly advisoryLockNamespace = 41023;
  private readonly advisoryLockKey = 1;
  private readonly buildPollContextFn: () => Promise<AutotaskPollContext | null>;
  private readonly workflowSyncFn: (event: WorkflowEventEnvelope) => Promise<unknown>;
  private readonly triageRunFn: (ticketId: string, tenantId?: string) => Promise<void>;
  private readonly runWithLockFn: (fn: () => Promise<void>) => Promise<PollLockResult>;
  private readonly nowFn: () => number;
  private readonly retryBackoffMsFn: (attempt: number) => number;
  private readonly authFailureCooldownMs: number;
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
  private readonly parityRecentWindowHours: number;
  private readonly recentTicketLookbackHours: number;
  private readonly recentTicketMaxRecords: number;
  private readonly triageDispatchConcurrency: number;
  private readonly parityActiveExcludedQueueNames: Set<string>;
  private readonly identityLookupConcurrency: number;
  private readonly identityLookupPerCallTimeoutMs: number;
  private readonly identityLookupBudgetMs: number;
  private readonly identityLookupMaxCompaniesPerRun: number;
  private readonly identityLookupMaxContactsPerRun: number;
  private readonly backlogIdentityCatchupEnabled: boolean;
  private readonly backlogIdentityCatchupBatchSize: number;
  private readonly backlogIdentityCatchupRemoteBatchSize: number;
  private parityBackfillStateCache: ParityBackfillStateFile | null = null;

  constructor(input?: {
    pollIntervalMs?: number;
    buildPollContext?: () => Promise<AutotaskPollContext | null>;
    workflowSync?: (event: WorkflowEventEnvelope) => Promise<unknown>;
    triageRun?: (ticketId: string, tenantId?: string) => Promise<void>;
    runWithLock?: (fn: () => Promise<void>) => Promise<PollLockResult>;
    now?: () => number;
    retryBackoffMs?: (attempt: number) => number;
    syncRetryMaxAttempts?: number;
    parityBackfillEnabled?: boolean;
    parityActiveOnly?: boolean;
    identityLookupConcurrency?: number;
    identityLookupPerCallTimeoutMs?: number;
    identityLookupBudgetMs?: number;
    identityLookupMaxCompaniesPerRun?: number;
    identityLookupMaxContactsPerRun?: number;
  }) {
    if (Number.isFinite(Number(input?.pollIntervalMs))) {
      this.pollIntervalMs = Math.max(5_000, Number(input?.pollIntervalMs));
    }
    this.buildPollContextFn = input?.buildPollContext || (() => this.buildPollContext());
    this.workflowSyncFn = input?.workflowSync || ((event) => workflowService.processAutotaskSyncEvent(event));
    this.triageRunFn = input?.triageRun || ((ticketId, tenantId) => triageOrchestrator.runPipeline(ticketId, undefined, 'autotask', tenantId));
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
    this.authFailureCooldownMs = Math.max(
      60_000,
      Number(process.env.AUTOTASK_POLLER_AUTH_FAILURE_COOLDOWN_MS || 30 * 60 * 1000),
    );
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
    this.parityRecentWindowHours = Math.max(1, Number(process.env.AUTOTASK_PARITY_RECENT_WINDOW_HOURS || 72));
    this.recentTicketLookbackHours = Math.max(1, Number(process.env.AUTOTASK_POLLER_RECENT_LOOKBACK_HOURS || 24));
    this.recentTicketMaxRecords = Math.max(25, Math.min(500, Number(process.env.AUTOTASK_POLLER_RECENT_MAX_RECORDS || 200)));
    this.triageDispatchConcurrency = Math.max(1, Number(process.env.AUTOTASK_POLLER_TRIAGE_CONCURRENCY || 3));
    this.identityLookupConcurrency = Math.max(
      1,
      Number(input?.identityLookupConcurrency ?? process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_CONCURRENCY ?? 2),
    );
    this.identityLookupPerCallTimeoutMs = Math.max(
      100,
      Number(input?.identityLookupPerCallTimeoutMs ?? process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS ?? 2500),
    );
    this.identityLookupBudgetMs = Math.max(
      200,
      Number(input?.identityLookupBudgetMs ?? process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS ?? 8000),
    );
    this.identityLookupMaxCompaniesPerRun = Math.max(
      0,
      Number(input?.identityLookupMaxCompaniesPerRun ?? process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES ?? 10),
    );
    this.identityLookupMaxContactsPerRun = Math.max(
      0,
      Number(input?.identityLookupMaxContactsPerRun ?? process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS ?? 10),
    );
    this.backlogIdentityCatchupEnabled = String(
      process.env.AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_ENABLED || 'true'
    ).toLowerCase() === 'true';
    this.backlogIdentityCatchupBatchSize = Math.max(
      0,
      Number(process.env.AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_BATCH_SIZE || 100),
    );
    this.backlogIdentityCatchupRemoteBatchSize = Math.max(
      0,
      Number(process.env.AUTOTASK_POLLER_BACKLOG_IDENTITY_CATCHUP_REMOTE_BATCH_SIZE || 50),
    );
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
      // Fail closed: never use global env credentials in tenant poller runtime.
      return null;
    }

    return null;
  }

  private isAuthenticationFailure(error: unknown): boolean {
    const classifiedReason = String(classifyQueueError(error).reason || '').toLowerCase();
    const message = String((error as Error)?.message || error || '').toLowerCase();
    const combined = `${classifiedReason} ${message}`;
    return (
      combined.includes('401') ||
      combined.includes('403') ||
      combined.includes('unauthorized') ||
      combined.includes('authentication') ||
      combined.includes('invalid credentials') ||
      combined.includes('locked')
    );
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
      if (this.authFailureCooldownUntil && now < this.authFailureCooldownUntil) {
        operationalLogger.warn('adapters.autotask_polling.auth_cooldown_active', {
          module: 'adapters.autotask-polling',
          integration: 'autotask',
          signal: 'integration_failure',
          degraded_mode: true,
          cooldown_until: new Date(this.authFailureCooldownUntil).toISOString(),
        });
        return;
      }
      if (this.authFailureCooldownUntil && now >= this.authFailureCooldownUntil) {
        this.authFailureCooldownUntil = null;
      }
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

        const [terminalStatusIds, picklistLabels] = await Promise.all([
          this.resolveTerminalStatusIds(context),
          this.resolvePicklistLabelMaps(context),
        ]);
        const queueScope = await this.resolveParityQueueScope(context);

        const recentThresholdIso = new Date(Date.now() - this.recentTicketLookbackHours * 60 * 60 * 1000).toISOString();
        const recentFilter = `{"op": "gt", "field": "createDate", "value": "${recentThresholdIso}"}`;
        let tickets = await context.client.searchTickets(recentFilter, this.recentTicketMaxRecords, 0);
        tickets = tickets
          .filter((ticket) => this.isNonCompleteTicket(ticket as unknown as Record<string, unknown>, terminalStatusIds))
          .slice()
          .sort((a, b) => sortTicketsByRecencyDesc(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>));
        if (this.parityActiveOnly && queueScope) {
          tickets = tickets.filter((ticket) => {
            const queueId = Number((ticket as any)?.queueID);
            return !Number.isFinite(queueId) || !queueScope.excludedQueueIds.has(queueId);
          });
        }
        const recentlyIngested = new Set<string>();

        const identityLookup = await this.resolveCanonicalIdentityBatch(
          context,
          tickets as unknown as Array<Record<string, unknown>>,
        );

        operationalLogger.info('adapters.autotask_polling.tickets_found', {
          module: 'adapters.autotask-polling',
          ticket_count: tickets.length,
        });
        const triageTargets: string[] = [];
        for (const ticket of tickets) {
          const ticketIdStr = String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
          if (!ticketIdStr) continue;
          recentlyIngested.add(ticketIdStr);
          await this.ingestWorkflowSyncEvent(
            ticket as unknown as Record<string, unknown>,
            context.tenantId,
            'autotask_poller',
            identityLookup,
            picklistLabels,
          );
          triageTargets.push(String((ticket as any)?.id ?? ticketIdStr));
        }

        if (this.parityQueueSnapshotEnabled) {
          try {
            await this.runQueueParitySnapshot(context, terminalStatusIds, queueScope, recentlyIngested);
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

        await runWithConcurrencyLimit(triageTargets, this.triageDispatchConcurrency, async (targetId) => {
          try {
            await this.triageRunFn(targetId, context.tenantId);
          } catch (err) {
            operationalLogger.error('adapters.autotask_polling.orchestration_failed', err, {
              module: 'adapters.autotask-polling',
              integration: 'autotask',
              signal: 'integration_failure',
              degraded_mode: true,
            }, { ticket_id: targetId });
          }
        });

        if (triageTargets.length > 0) {
          operationalLogger.info('adapters.autotask_polling.triage_dispatch_completed', {
            module: 'adapters.autotask-polling',
            ticket_count: triageTargets.length,
            concurrency: this.triageDispatchConcurrency,
          });
        }

        if (
          this.backlogIdentityCatchupEnabled &&
          context.tenantId &&
          this.backlogIdentityCatchupBatchSize > 0 &&
          this.backlogIdentityCatchupRemoteBatchSize > 0
        ) {
          try {
            await workflowService.runInboxHydrationSweep(context.tenantId, {
              batchSize: this.backlogIdentityCatchupBatchSize,
              remoteBatchSize: this.backlogIdentityCatchupRemoteBatchSize,
              strategy: 'oldest-first',
            });
          } catch (error) {
            operationalLogger.warn('adapters.autotask_polling.backlog_identity_catchup_failed', {
              module: 'adapters.autotask-polling',
              integration: 'autotask',
              signal: 'integration_failure',
              degraded_mode: true,
              reason: String((error as Error)?.message || error || 'unknown_error'),
            }, {
              tenant_id: context.tenantId,
            });
          }
        }

        if (this.parityPurgeEnabled) {
          await this.purgeMissingAutotaskTickets(context, terminalStatusIds);
        }

      });
      this.authFailureCooldownUntil = null;
      if (!lock.acquired) {
        operationalLogger.info('adapters.autotask_polling.lock_not_acquired', {
          module: 'adapters.autotask-polling',
          lock_namespace: this.advisoryLockNamespace,
          lock_key: this.advisoryLockKey,
        });
      }
    } catch (error) {
      const classified = classifyQueueError(error);
      if (this.isAuthenticationFailure(error)) {
        this.authFailureCooldownUntil = this.nowFn() + this.authFailureCooldownMs;
        operationalLogger.warn('adapters.autotask_polling.auth_cooldown_entered', {
          module: 'adapters.autotask-polling',
          integration: 'autotask',
          signal: 'integration_failure',
          degraded_mode: true,
          cooldown_until: new Date(this.authFailureCooldownUntil).toISOString(),
        });
      } else if (classified.code === 'RATE_LIMIT') {
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

  private async runQueueParitySnapshot(
    context: AutotaskPollContext,
    terminalStatusIds: Set<number>,
    scope?: ParityQueueScope | null,
    recentlyIngested?: Set<string>,
  ): Promise<void> {
    const tenantId = String(context.tenantId || '').trim();
    if (!tenantId) return;
    const queues = scope?.queues || await this.resolveParityQueueScope(context).then((resolved) => resolved?.queues || []);
    if (!Array.isArray(queues) || queues.length === 0) return;
    const excludedQueueIds = scope?.excludedQueueIds || new Set<number>();
    const recentWindowStartIso = new Date(Date.now() - this.parityRecentWindowHours * 60 * 60 * 1000).toISOString();
    const merged = new Map<string, Record<string, unknown>>();

    for (const queue of queues) {
      const queueId = Number((queue as { id?: number }).id);
      if (!Number.isFinite(queueId)) continue;
      if (this.parityActiveOnly && excludedQueueIds.has(queueId)) continue;
      const activeStatusFilters = Array.from(terminalStatusIds)
        .sort((a, b) => a - b)
        .map((statusId) => ({ op: 'noteq', field: 'status', value: String(statusId) }));
      const recentSearch = JSON.stringify({
        MaxRecords: this.parityQueueSnapshotMaxRecords,
        filter: [
          { op: 'eq', field: 'queueID', value: queueId },
          ...activeStatusFilters,
          { op: 'gt', field: 'createDate', value: recentWindowStartIso },
        ],
      });
      const backlogSearch = JSON.stringify({
        MaxRecords: this.parityQueueSnapshotMaxRecords,
        filter: [
          { op: 'eq', field: 'queueID', value: queueId },
          ...activeStatusFilters,
        ],
      });
      const [recentRows, backlogRows] = await Promise.all([
        context.client.searchTickets(recentSearch, this.parityQueueSnapshotMaxRecords, 0).catch(() => []),
        context.client.searchTickets(backlogSearch, this.parityQueueSnapshotMaxRecords, 0).catch(() => []),
      ]);
      for (const row of [...recentRows, ...backlogRows] as unknown as Record<string, unknown>[]) {
        const key = resolveTicketReference(row);
        if (!key) continue;
        if (recentlyIngested?.has(key)) continue;
        if (!this.isNonCompleteTicket(row, terminalStatusIds)) continue;
        if (!merged.has(key)) merged.set(key, row);
      }
    }

    const rows = Array.from(merged.values()).sort(sortTicketsByRecencyDesc);
    if (rows.length === 0) return;

    const [reconcilePicklistLabels, inboxRows] = await Promise.all([
      this.resolvePicklistLabelMaps(context),
      workflowService.listInbox(tenantId),
    ]);
    const inboxByTicketId = new Map<string, InboxTicketState>();
    for (const row of inboxRows) {
      const key = String(row.ticket_id || row.ticket_number || '').trim();
      if (!key) continue;
      inboxByTicketId.set(key, row);
    }
    const identityCandidates = rows.filter((ticket) => {
      const key = resolveTicketReference(ticket);
      if (!key) return false;
      return !inboxRowHasCanonicalIdentity(inboxByTicketId.get(key));
    });
    const identityLookup = identityCandidates.length > 0
      ? await this.resolveCanonicalIdentityBatch(context, identityCandidates, { priority: 'oldest-first' })
      : undefined;

    operationalLogger.info('adapters.autotask_polling.parity_queue_snapshot_applied', {
      module: 'adapters.autotask-polling',
      queue_count: queues.length,
      ticket_count: rows.length,
      identity_candidates: identityCandidates.length,
    }, {
      tenant_id: tenantId,
    });

    for (const ticket of rows) {
      await this.ingestWorkflowSyncEvent(ticket, tenantId, 'autotask_reconcile', identityLookup, reconcilePicklistLabels);
    }
  }

  private async resolveTerminalStatusIds(context: AutotaskPollContext): Promise<Set<number>> {
    const out = new Set<number>();
    const getStatusOptionsFn = (context.client as any)?.getTicketStatusOptions;
    if (typeof getStatusOptionsFn !== 'function') return out;
    try {
      const options = await getStatusOptionsFn.call(context.client);
      for (const option of Array.isArray(options) ? options : []) {
        const id = Number((option as any)?.id);
        const label = String((option as any)?.label || '').trim();
        if (!Number.isFinite(id)) continue;
        if (isTerminalStatusLabel(label)) out.add(id);
      }
    } catch {
      // Best effort only.
    }
    return out;
  }

  private async resolvePicklistLabelMaps(context: AutotaskPollContext): Promise<CanonicalPicklistLabelMaps> {
    const statusById = new Map<number, string>();
    const priorityById = new Map<number, string>();
    const issueTypeById = new Map<number, string>();
    const subIssueTypeById = new Map<number, string>();
    const slaById = new Map<number, string>();
    const queueById = new Map<number, string>();

    const buildMap = (options: unknown[]): Map<number, string> => {
      const map = new Map<number, string>();
      for (const option of Array.isArray(options) ? options : []) {
        const id = Number((option as any)?.id);
        const label = String((option as any)?.label || '').trim();
        if (Number.isFinite(id) && label) map.set(id, label);
      }
      return map;
    };

    try {
      const client = context.client as any;
      const [statusOpts, priorityOpts, issueTypeOpts, subIssueTypeOpts, slaOpts, queueOpts] = await Promise.all([
        typeof client.getTicketStatusOptions === 'function' ? client.getTicketStatusOptions().catch(() => []) : [],
        typeof client.getTicketPriorityOptions === 'function' ? client.getTicketPriorityOptions().catch(() => []) : [],
        typeof client.getTicketIssueTypeOptions === 'function' ? client.getTicketIssueTypeOptions().catch(() => []) : [],
        typeof client.getTicketSubIssueTypeOptions === 'function' ? client.getTicketSubIssueTypeOptions().catch(() => []) : [],
        typeof client.getTicketServiceLevelAgreementOptions === 'function' ? client.getTicketServiceLevelAgreementOptions().catch(() => []) : [],
        typeof client.getTicketQueues === 'function' ? client.getTicketQueues().catch(() => []) : [],
      ]);

      for (const [id, label] of buildMap(statusOpts)) statusById.set(id, label);
      for (const [id, label] of buildMap(priorityOpts)) priorityById.set(id, label);
      for (const [id, label] of buildMap(issueTypeOpts)) issueTypeById.set(id, label);
      for (const [id, label] of buildMap(subIssueTypeOpts)) subIssueTypeById.set(id, label);
      for (const [id, label] of buildMap(slaOpts)) slaById.set(id, label);
      for (const [id, label] of buildMap(queueOpts)) queueById.set(id, label);
    } catch {
      // Best effort only — labels degrade gracefully to numeric IDs.
    }

    return { statusById, priorityById, issueTypeById, subIssueTypeById, slaById, queueById };
  }

  private isNonCompleteTicket(ticket: Record<string, unknown>, terminalStatusIds: Set<number>): boolean {
    const statusValue = (ticket as any)?.status;
    const numericStatus = Number(statusValue);
    if (Number.isFinite(numericStatus) && terminalStatusIds.has(numericStatus)) return false;
    if (isTerminalStatusLabel(statusValue)) return false;
    const statusLabel = (ticket as any)?.statusLabel || (ticket as any)?.status_name || (ticket as any)?.ticketStatus;
    if (isTerminalStatusLabel(statusLabel)) return false;
    return true;
  }

  private async resolveCanonicalIdentityBatch(
    context: AutotaskPollContext,
    tickets: Array<Record<string, unknown>>,
    options?: { priority?: IdentityLookupPriority },
  ): Promise<CanonicalIdentityLookup> {
    const companyNameById = new Map<number, string>();
    const requesterNameByContactId = new Map<number, string>();
    const contactEmailByContactId = new Map<number, string>();
    const companyIds = new Set<number>();
    const contactIds = new Set<number>();
    const priority = options?.priority || 'newest-first';
    const prioritizedTickets = tickets
      .slice()
      .sort((a, b) => {
        const delta = priority === 'oldest-first'
          ? getTicketCreationMs(a) - getTicketCreationMs(b)
          : getTicketCreationMs(b) - getTicketCreationMs(a);
        if (delta !== 0) return delta;
        return priority === 'oldest-first'
          ? sortTicketsByRecencyDesc(b, a)
          : sortTicketsByRecencyDesc(a, b);
      });

    for (const raw of prioritizedTickets) {
      const companyName = String((raw as any)?.companyName || (raw as any)?.company || '').trim();
      const requesterName = String((raw as any)?.contactName || (raw as any)?.requesterName || '').trim();
      const companyId = Number((raw as any)?.companyID);
      const contactId = Number((raw as any)?.contactID);
      if (!companyName && Number.isFinite(companyId) && companyId > 0) companyIds.add(companyId);
      if (!requesterName && Number.isFinite(contactId) && contactId > 0) contactIds.add(contactId);
    }
    const lookupStartedAt = this.nowFn();
    const deadline = lookupStartedAt + this.identityLookupBudgetMs;
    const prioritizedCompanyIds = Array.from(companyIds).slice(0, this.identityLookupMaxCompaniesPerRun);
    const prioritizedContactIds = Array.from(contactIds).slice(0, this.identityLookupMaxContactsPerRun);
    let budgetExhausted = false;

    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
      let timer: NodeJS.Timeout | null = null;
      try {
        return await Promise.race([
          promise,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), timeoutMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const getCompanyFn = (context.client as any)?.getCompany;
    if (typeof getCompanyFn === 'function') {
      await runWithConcurrencyLimit(prioritizedCompanyIds, this.identityLookupConcurrency, async (id) => {
        const remainingBudget = deadline - this.nowFn();
        if (remainingBudget <= 0) {
          budgetExhausted = true;
          return;
        }
        const timeoutMs = Math.min(this.identityLookupPerCallTimeoutMs, remainingBudget);
        if (timeoutMs <= 0) return;
        try {
          const row = await withTimeout(getCompanyFn.call(context.client, id), timeoutMs);
          const name = String((row as any)?.companyName || (row as any)?.name || '').trim();
          if (name) companyNameById.set(id, name);
        } catch {
          // Best effort only.
        }
      });
    }

    const getContactFn = (context.client as any)?.getContact;
    if (typeof getContactFn === 'function') {
      await runWithConcurrencyLimit(prioritizedContactIds, this.identityLookupConcurrency, async (id) => {
        const remainingBudget = deadline - this.nowFn();
        if (remainingBudget <= 0) {
          budgetExhausted = true;
          return;
        }
        const timeoutMs = Math.min(this.identityLookupPerCallTimeoutMs, remainingBudget);
        if (timeoutMs <= 0) return;
        try {
          const row = await withTimeout(getContactFn.call(context.client, id), timeoutMs);
          const firstName = String((row as any)?.firstName || '').trim();
          const lastName = String((row as any)?.lastName || '').trim();
          const fullName = `${firstName} ${lastName}`.trim();
          const name = fullName || String((row as any)?.name || (row as any)?.contactName || '').trim();
          const email = String((row as any)?.emailAddress || (row as any)?.email || '').trim();
          if (name) requesterNameByContactId.set(id, name);
          if (email) contactEmailByContactId.set(id, email);
        } catch {
          // Best effort only.
        }
      });
    }

    const truncatedCompanyIds = Math.max(0, companyIds.size - prioritizedCompanyIds.length);
    const truncatedContactIds = Math.max(0, contactIds.size - prioritizedContactIds.length);
    if (budgetExhausted || truncatedCompanyIds > 0 || truncatedContactIds > 0) {
      operationalLogger.warn('adapters.autotask_polling.identity_lookup_degraded', {
        module: 'adapters.autotask-polling',
        integration: 'autotask',
        signal: 'integration_failure',
        degraded_mode: true,
        budget_exhausted: budgetExhausted,
        lookup_budget_ms: this.identityLookupBudgetMs,
        lookup_timeout_ms: this.identityLookupPerCallTimeoutMs,
        lookup_concurrency: this.identityLookupConcurrency,
        company_candidates: companyIds.size,
        company_capped: prioritizedCompanyIds.length,
        company_truncated: truncatedCompanyIds,
        company_resolved: companyNameById.size,
        contact_candidates: contactIds.size,
        contact_capped: prioritizedContactIds.length,
        contact_truncated: truncatedContactIds,
        contact_resolved: requesterNameByContactId.size,
        duration_ms: this.nowFn() - lookupStartedAt,
      }, {
        tenant_id: context.tenantId || null,
      });
    }

    return { companyNameById, requesterNameByContactId, contactEmailByContactId };
  }

  private async purgeMissingAutotaskTickets(
    context: AutotaskPollContext,
    terminalStatusIds: Set<number>,
  ): Promise<void> {
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

      let remoteTicket: Record<string, unknown> | null = null;
      try {
        if (externalId && looksLikeNumericId(externalId)) {
          remoteTicket = await context.client.getTicket(Number(externalId)) as unknown as Record<string, unknown>;
        } else if (ticketNumber) {
          remoteTicket = await context.client.getTicketByTicketNumber(ticketNumber) as unknown as Record<string, unknown>;
        } else if (ticketId && looksLikeNumericId(ticketId)) {
          remoteTicket = await context.client.getTicket(Number(ticketId)) as unknown as Record<string, unknown>;
        } else if (ticketId) {
          remoteTicket = await context.client.getTicketByTicketNumber(ticketId) as unknown as Record<string, unknown>;
        }
      } catch (error) {
        const message = String((error as Error)?.message || error || '').toLowerCase();
        if (message.includes('not found')) {
          remoteTicket = null;
        } else {
          continue;
        }
      }
      if (remoteTicket && this.isNonCompleteTicket(remoteTicket, terminalStatusIds)) continue;

      await workflowService.removeInboxTicket(tenantId, ticketId, {
        reason: remoteTicket ? 'autotask_ticket_terminal' : 'autotask_ticket_not_found',
        correlation: {
          trace_id: `autotask-purge-${Date.now()}`,
          ticket_id: ticketId,
        },
        metadata: {
          external_id: externalId || undefined,
          ticket_number: ticketNumber || undefined,
          remote_status: remoteTicket ? String((remoteTicket as any).statusLabel || (remoteTicket as any).status || '').trim() || undefined : undefined,
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
    identityLookup?: CanonicalIdentityLookup,
    picklistLabels?: CanonicalPicklistLabelMaps,
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
    const occurredAt = String(
      ticket.lastActivityDate ||
      ticket.createDateTime ||
      ticket.createDate ||
      new Date().toISOString()
    );
    const companyId = Number((ticket as any).companyID);
    const contactId = Number((ticket as any).contactID);
    const companyName = String(
      (ticket as any).companyName ||
      (ticket as any).company ||
      (Number.isFinite(companyId) ? identityLookup?.companyNameById.get(companyId) : '') ||
      ''
    ).trim();
    const requesterName = String(
      (ticket as any).contactName ||
      (ticket as any).requesterName ||
      (Number.isFinite(contactId) ? identityLookup?.requesterNameByContactId.get(contactId) : '') ||
      ''
    ).trim();
    const contactEmail = String(
      (ticket as any).contactEmail ||
      (ticket as any).requesterEmail ||
      (Number.isFinite(contactId) ? identityLookup?.contactEmailByContactId.get(contactId) : '') ||
      ''
    ).trim();
    const payload = {
      external_id: rawId || ticketRef,
      ticket_number: String(ticket.ticketNumber || '').trim() || undefined,
      created_at: String((ticket as any).createDateTime || ticket.createDate || '').trim() || undefined,
      createDateTime: String((ticket as any).createDateTime || '').trim() || undefined,
      createDate: String(ticket.createDate || '').trim() || undefined,
      title: ticket.title,
      description: ticket.description,
      company_name: companyName || undefined,
      requester: requesterName || undefined,
      contact_name: requesterName || undefined,
      contact_email: contactEmail || undefined,
      company_id: Number.isFinite(companyId) ? companyId : undefined,
      contact_id: Number.isFinite(contactId) ? contactId : undefined,
      status: ticket.status,
      status_label: String(
        (ticket as any).statusLabel ??
        (ticket as any).status_label ??
        (ticket as any).status_name ??
        (Number.isFinite(Number(ticket.status)) ? picklistLabels?.statusById?.get(Number(ticket.status)) : '') ??
        ''
      ).trim() || undefined,
      assigned_to: ticket.assignedResourceID,
      queue_id: ticket.queueID,
      queue_name: String(
        (ticket as any).queueName ??
        (ticket as any).queue_name ??
        (Number.isFinite(Number(ticket.queueID)) ? picklistLabels?.queueById?.get(Number(ticket.queueID)) : '') ??
        ''
      ).trim() || undefined,
      // Canonical Autotask picklist IDs/labels are resolved from picklist options fetched per-run.
      priority: (ticket as any).priority !== undefined && (ticket as any).priority !== null
        ? (ticket as any).priority
        : undefined,
      priority_label: String(
        (ticket as any).priorityLabel ??
        (ticket as any).priority_label ??
        (ticket as any).priorityName ??
        (Number.isFinite(Number((ticket as any).priority)) ? picklistLabels?.priorityById?.get(Number((ticket as any).priority)) : '') ??
        ''
      ).trim() || undefined,
      issue_type: (ticket as any).issueType !== undefined && (ticket as any).issueType !== null
        ? (ticket as any).issueType
        : undefined,
      issue_type_label: String(
        (ticket as any).issueTypeLabel ??
        (ticket as any).issueType_label ??
        (ticket as any).issueTypeName ??
        (Number.isFinite(Number((ticket as any).issueType)) ? picklistLabels?.issueTypeById?.get(Number((ticket as any).issueType)) : '') ??
        ''
      ).trim() || undefined,
      sub_issue_type: (ticket as any).subIssueType !== undefined && (ticket as any).subIssueType !== null
        ? (ticket as any).subIssueType
        : undefined,
      sub_issue_type_label: String(
        (ticket as any).subIssueTypeLabel ??
        (ticket as any).subIssueType_label ??
        (ticket as any).subIssueTypeName ??
        (Number.isFinite(Number((ticket as any).subIssueType)) ? picklistLabels?.subIssueTypeById?.get(Number((ticket as any).subIssueType)) : '') ??
        ''
      ).trim() || undefined,
      sla_id: (ticket as any).serviceLevelAgreementID !== undefined && (ticket as any).serviceLevelAgreementID !== null
        ? (ticket as any).serviceLevelAgreementID
        : undefined,
      sla_label: String(
        (ticket as any).serviceLevelAgreementLabel ??
        (ticket as any).serviceLevelAgreement_label ??
        (ticket as any).serviceLevelAgreementName ??
        (Number.isFinite(Number((ticket as any).serviceLevelAgreementID)) ? picklistLabels?.slaById?.get(Number((ticket as any).serviceLevelAgreementID)) : '') ??
        ''
      ).trim() || undefined,
    };
    const eventId = `${source}:${rawId || ticketRef}:ticket.created:${occurredAt}:${buildCanonicalPayloadFingerprint(payload)}`;

    const event: WorkflowEventEnvelope = {
      event_id: eventId,
      tenant_id: tenantId,
      event_type: 'ticket.created',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: ticketRef,
      payload,
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
