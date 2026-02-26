import { randomUUID } from 'crypto';
import { readJsonFileSafe, writeJsonFileAtomic } from './runtime-json-file.js';
import { classifyQueueError } from '../platform/errors.js';

export type WorkflowTargetIntegration =
  | 'Autotask'
  | 'IT Glue'
  | 'Ninja'
  | 'SentinelOne'
  | 'Check Point';

export type WorkflowCommandType =
  | 'create'
  | 'update'
  | 'assign'
  | 'status'
  | 'comment'
  | 'note'
  | 'time_entry';

export type WorkflowActorKind = 'user' | 'system' | 'ai';

export type CommandExecutionStatus =
  | 'accepted'
  | 'processing'
  | 'completed'
  | 'retry_pending'
  | 'failed'
  | 'dlq'
  | 'rejected';

export type WorkflowEventType = 'ticket.created' | 'ticket.updated' | 'ticket.comment' | 'ticket.assigned' | 'ticket.status_changed';

export interface WorkflowCorrelation {
  trace_id: string;
  ticket_id?: string;
  job_id?: string;
  command_id?: string;
}

export interface WorkflowProvenance {
  source: 'cerebro_api' | 'autotask_webhook' | 'autotask_poller' | 'autotask_reconcile';
  fetched_at?: string;
  adapter_version?: string;
  sync_cursor?: string;
}

export interface WorkflowCommandEnvelope {
  command_id: string;
  tenant_id: string;
  target_integration: WorkflowTargetIntegration;
  command_type: WorkflowCommandType;
  payload: Record<string, unknown>;
  actor: {
    kind: WorkflowActorKind;
    id: string;
    origin: string;
  };
  idempotency_key: string;
  audit_metadata: Record<string, unknown>;
  correlation: WorkflowCorrelation;
  requested_at: string;
}

export interface WorkflowEventEnvelope {
  event_id: string;
  tenant_id: string;
  event_type: WorkflowEventType;
  source: 'Autotask';
  entity_type: 'ticket';
  entity_id: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  correlation: WorkflowCorrelation;
  provenance: WorkflowProvenance;
}

export interface WorkflowAuditRecord {
  audit_id: string;
  tenant_id: string;
  actor: { kind: WorkflowActorKind; id: string; origin?: string };
  action: string;
  target: { integration: WorkflowTargetIntegration | 'workflow'; entity_type: string; entity_id?: string };
  result: 'success' | 'failure' | 'rejected';
  reason?: string;
  timestamp: string;
  correlation: WorkflowCorrelation;
  metadata: Record<string, unknown>;
}

export interface WorkflowCommandAttempt {
  command: WorkflowCommandEnvelope;
  status: CommandExecutionStatus;
  attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  last_error?: string;
  result?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InboxTicketState {
  tenant_id: string;
  ticket_id: string;
  external_id?: string;
  title?: string;
  description?: string;
  status?: string;
  assigned_to?: string;
  queue_id?: number;
  queue_name?: string;
  comments: Array<{ visibility: 'internal' | 'public'; body: string; created_at: string }>;
  last_sync_at?: string;
  last_event_occurred_at?: string;
  last_event_id?: string;
  last_command_id?: string;
  source_of_truth: 'Autotask';
  updated_at: string;
}

export interface ReconciliationIssue {
  id: string;
  tenant_id: string;
  ticket_id: string;
  detected_at: string;
  severity: 'info' | 'warning' | 'error';
  reason: string;
  local_snapshot: Record<string, unknown>;
  remote_snapshot: Record<string, unknown>;
  correlation: WorkflowCorrelation;
  provenance: WorkflowProvenance;
}

export type WorkflowExecutionResult =
  | { kind: 'created'; external_ticket_id: string; external_ticket_number?: string; snapshot?: Record<string, unknown> }
  | { kind: 'updated'; snapshot?: Record<string, unknown> }
  | { kind: 'assigned'; assigned_to?: string; snapshot?: Record<string, unknown> }
  | { kind: 'status'; status?: string; snapshot?: Record<string, unknown> }
  | { kind: 'time_entry'; entry_id?: string | number; snapshot?: Record<string, unknown> };

export class WorkflowPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowPolicyError';
  }
}

export class WorkflowTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowTransientError';
  }
}

export interface TicketWorkflowGateway {
  executeCommand(command: WorkflowCommandEnvelope): Promise<WorkflowExecutionResult>;
  fetchTicketSnapshot?(tenantId: string, ticketId: string): Promise<Record<string, unknown> | null>;
}

type PendingCommandFilter = {
  nowIso: string;
  limit: number;
};

export interface TicketWorkflowRepository {
  getCommandByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<WorkflowCommandAttempt | null>;
  upsertCommandAttempt(attempt: WorkflowCommandAttempt): Promise<void>;
  getCommandById(commandId: string): Promise<WorkflowCommandAttempt | null>;
  listPendingCommands(filter: PendingCommandFilter): Promise<WorkflowCommandAttempt[]>;
  saveAudit(record: WorkflowAuditRecord): Promise<void>;
  listAuditByTicket(tenantId: string, ticketId: string): Promise<WorkflowAuditRecord[]>;
  markSyncEventProcessed(tenantId: string, eventId: string): Promise<boolean>;
  upsertInboxTicket(state: InboxTicketState): Promise<void>;
  getInboxTicket(tenantId: string, ticketId: string): Promise<InboxTicketState | null>;
  listInboxTickets(tenantId: string): Promise<InboxTicketState[]>;
  addReconciliationIssue(issue: ReconciliationIssue): Promise<void>;
  listReconciliationIssues(tenantId: string, ticketId?: string): Promise<ReconciliationIssue[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeVisibility(input: unknown): 'internal' | 'public' {
  return String(input || '').toLowerCase() === 'internal' ? 'internal' : 'public';
}

function normalizeStatusToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function statusesMatch(localStatus: unknown, remoteStatus: unknown, remoteStatusLabel?: unknown): boolean {
  const local = normalizeStatusToken(localStatus);
  const remote = normalizeStatusToken(remoteStatus);
  const remoteLabel = normalizeStatusToken(remoteStatusLabel);
  if (!local || !remote) return true;
  if (local === remote) return true;
  if (remoteLabel && local === remoteLabel) return true;
  return false;
}

function classifyError(error: unknown): 'transient' | 'terminal' {
  if (error instanceof WorkflowTransientError) return 'transient';
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (
    message.includes('timeout') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('econnreset') ||
    message.includes('network')
  ) {
    return 'transient';
  }
  return 'terminal';
}

function computeBackoffMs(attempts: number): number {
  const base = 5_000;
  const cappedExponent = Math.min(Math.max(attempts - 1, 0), 5);
  return Math.min(base * Math.pow(2, cappedExponent), 5 * 60_000);
}

function auditTarget(
  integration: WorkflowTargetIntegration | 'workflow',
  entity_type: string,
  entity_id?: string
): { integration: WorkflowTargetIntegration | 'workflow'; entity_type: string; entity_id?: string } {
  return {
    integration,
    entity_type,
    ...(entity_id ? { entity_id } : {}),
  };
}

export class InMemoryTicketWorkflowRepository implements TicketWorkflowRepository {
  private commandsById = new Map<string, WorkflowCommandAttempt>();
  private commandsByIdempotency = new Map<string, string>();
  private audits: WorkflowAuditRecord[] = [];
  private processedSyncEvents = new Set<string>();
  private inbox = new Map<string, InboxTicketState>();
  private reconciliationIssues: ReconciliationIssue[] = [];
  private readonly persistenceFilePath: string | undefined;

  constructor(input?: { persistenceFilePath?: string }) {
    this.persistenceFilePath = input?.persistenceFilePath;
    this.loadPersistedState();
  }

  private commandKey(tenantId: string, idempotencyKey: string): string {
    return `${tenantId}::${idempotencyKey}`;
  }

  private inboxKey(tenantId: string, ticketId: string): string {
    return `${tenantId}::${ticketId}`;
  }

  private loadPersistedState(): void {
    if (!this.persistenceFilePath) return;
    const snapshot = readJsonFileSafe<{
      commandsById?: Array<[string, WorkflowCommandAttempt]>;
      commandsByIdempotency?: Array<[string, string]>;
      audits?: WorkflowAuditRecord[];
      processedSyncEvents?: string[];
      inbox?: Array<[string, InboxTicketState]>;
      reconciliationIssues?: ReconciliationIssue[];
    }>(this.persistenceFilePath);
    if (!snapshot) return;
    this.commandsById = new Map(snapshot.commandsById || []);
    this.commandsByIdempotency = new Map(snapshot.commandsByIdempotency || []);
    this.audits = Array.isArray(snapshot.audits) ? snapshot.audits : [];
    this.processedSyncEvents = new Set(snapshot.processedSyncEvents || []);
    this.inbox = new Map(snapshot.inbox || []);
    this.reconciliationIssues = Array.isArray(snapshot.reconciliationIssues) ? snapshot.reconciliationIssues : [];
  }

  private persistState(): void {
    if (!this.persistenceFilePath) return;
    writeJsonFileAtomic(this.persistenceFilePath, {
      commandsById: Array.from(this.commandsById.entries()),
      commandsByIdempotency: Array.from(this.commandsByIdempotency.entries()),
      audits: this.audits,
      processedSyncEvents: Array.from(this.processedSyncEvents.values()),
      inbox: Array.from(this.inbox.entries()),
      reconciliationIssues: this.reconciliationIssues,
    });
  }

  async getCommandByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<WorkflowCommandAttempt | null> {
    const commandId = this.commandsByIdempotency.get(this.commandKey(tenantId, idempotencyKey));
    if (!commandId) return null;
    return this.commandsById.get(commandId) ?? null;
  }

  async upsertCommandAttempt(attempt: WorkflowCommandAttempt): Promise<void> {
    this.commandsById.set(attempt.command.command_id, structuredClone(attempt));
    this.commandsByIdempotency.set(
      this.commandKey(attempt.command.tenant_id, attempt.command.idempotency_key),
      attempt.command.command_id
    );
    this.persistState();
  }

  async getCommandById(commandId: string): Promise<WorkflowCommandAttempt | null> {
    return this.commandsById.get(commandId) ?? null;
  }

  async listPendingCommands(filter: PendingCommandFilter): Promise<WorkflowCommandAttempt[]> {
    const now = new Date(filter.nowIso).getTime();
    const rows = Array.from(this.commandsById.values())
      .filter((attempt) => {
        if (attempt.status !== 'accepted' && attempt.status !== 'retry_pending') return false;
        if (!attempt.next_retry_at) return true;
        return new Date(attempt.next_retry_at).getTime() <= now;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, filter.limit);
    return rows.map((row) => structuredClone(row));
  }

  async saveAudit(record: WorkflowAuditRecord): Promise<void> {
    this.audits.push(structuredClone(record));
    this.persistState();
  }

  async listAuditByTicket(tenantId: string, ticketId: string): Promise<WorkflowAuditRecord[]> {
    return this.audits.filter((r) => r.tenant_id === tenantId && r.correlation.ticket_id === ticketId).map((r) => structuredClone(r));
  }

  async markSyncEventProcessed(tenantId: string, eventId: string): Promise<boolean> {
    const key = `${tenantId}::${eventId}`;
    if (this.processedSyncEvents.has(key)) return false;
    this.processedSyncEvents.add(key);
    this.persistState();
    return true;
  }

  async upsertInboxTicket(state: InboxTicketState): Promise<void> {
    this.inbox.set(this.inboxKey(state.tenant_id, state.ticket_id), structuredClone(state));
    this.persistState();
  }

  async getInboxTicket(tenantId: string, ticketId: string): Promise<InboxTicketState | null> {
    const row = this.inbox.get(this.inboxKey(tenantId, ticketId));
    return row ? structuredClone(row) : null;
  }

  async listInboxTickets(tenantId: string): Promise<InboxTicketState[]> {
    return Array.from(this.inbox.values())
      .filter((row) => row.tenant_id === tenantId)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .map((row) => structuredClone(row));
  }

  async addReconciliationIssue(issue: ReconciliationIssue): Promise<void> {
    this.reconciliationIssues.push(structuredClone(issue));
    this.persistState();
  }

  async listReconciliationIssues(tenantId: string, ticketId?: string): Promise<ReconciliationIssue[]> {
    return this.reconciliationIssues
      .filter((r) => r.tenant_id === tenantId && (!ticketId || r.ticket_id === ticketId))
      .map((r) => structuredClone(r));
  }
}

export class TicketWorkflowCoreService {
  constructor(
    private readonly repo: TicketWorkflowRepository,
    private readonly gateway: TicketWorkflowGateway,
    private readonly options: { maxAttempts?: number } = {}
  ) {}

  private maxAttempts(): number {
    return Math.max(1, this.options.maxAttempts ?? 3);
  }

  private async writeAudit(args: Omit<WorkflowAuditRecord, 'audit_id' | 'timestamp'>): Promise<void> {
    await this.repo.saveAudit({
      audit_id: randomUUID(),
      timestamp: nowIso(),
      ...args,
    });
  }

  async submitCommand(command: WorkflowCommandEnvelope): Promise<WorkflowCommandAttempt> {
    const targetTicketId = command.correlation.ticket_id || String(command.payload.ticket_id || '');

    if (command.target_integration !== 'Autotask') {
      await this.writeAudit({
        tenant_id: command.tenant_id,
        actor: command.actor,
        action: 'workflow.command.rejected',
        target: auditTarget(command.target_integration, 'ticket', targetTicketId || undefined),
        result: 'rejected',
        reason: 'non_autotask_write_blocked',
        correlation: { ...command.correlation, command_id: command.command_id },
        metadata: {
          policy: 'launch_integration_mode_guardrail',
          idempotency_key: command.idempotency_key,
          command_type: command.command_type,
          audit_metadata: command.audit_metadata,
        },
      });
      throw new WorkflowPolicyError(`P0 command writes are allowed only for Autotask (received: ${command.target_integration})`);
    }

    const existing = await this.repo.getCommandByIdempotencyKey(command.tenant_id, command.idempotency_key);
    if (existing) {
      await this.writeAudit({
        tenant_id: command.tenant_id,
        actor: command.actor,
        action: 'workflow.command.idempotent_replay',
        target: auditTarget('Autotask', 'ticket', targetTicketId || undefined),
        result: 'success',
        correlation: { ...command.correlation, command_id: existing.command.command_id || command.command_id },
        metadata: {
          idempotency_key: command.idempotency_key,
          existing_command_id: existing.command.command_id,
          existing_status: existing.status,
        },
      });
      return existing;
    }

    const createdAt = nowIso();
    const attempt: WorkflowCommandAttempt = {
      command,
      status: 'accepted',
      attempts: 0,
      max_attempts: this.maxAttempts(),
      created_at: createdAt,
      updated_at: createdAt,
    };
    await this.repo.upsertCommandAttempt(attempt);
    await this.writeAudit({
      tenant_id: command.tenant_id,
      actor: command.actor,
      action: 'workflow.command.accepted',
      target: auditTarget('Autotask', 'ticket', targetTicketId || undefined),
      result: 'success',
      correlation: { ...command.correlation, command_id: command.command_id },
      metadata: {
        command_type: command.command_type,
        idempotency_key: command.idempotency_key,
        audit_metadata: command.audit_metadata,
      },
    });
    return attempt;
  }

  async processPendingCommands(limit = 20): Promise<{ processed: number; completed: number; retried: number; dlq: number; failed: number }> {
    const pending = await this.repo.listPendingCommands({ nowIso: nowIso(), limit });
    let completed = 0;
    let retried = 0;
    let dlq = 0;
    let failed = 0;

    for (const attempt of pending) {
      attempt.status = 'processing';
      attempt.updated_at = nowIso();
      await this.repo.upsertCommandAttempt(attempt);

      try {
        const result = await this.gateway.executeCommand(attempt.command);
        attempt.attempts += 1;
        attempt.status = 'completed';
        attempt.result = {
          ...result,
          completed_at: nowIso(),
        };
        delete attempt.last_error;
        delete attempt.next_retry_at;
        attempt.updated_at = nowIso();
        await this.repo.upsertCommandAttempt(attempt);
        completed += 1;

        await this.applyLocalProjectionFromCommandResult(attempt, result);
        await this.writeAudit({
          tenant_id: attempt.command.tenant_id,
          actor: attempt.command.actor,
          action: 'workflow.command.completed',
          target: auditTarget(
            'Autotask',
            'ticket',
            String(
              (result as any)?.external_ticket_id ||
              attempt.command.correlation.ticket_id ||
              attempt.command.payload.ticket_id ||
              ''
            ) || undefined
          ),
          result: 'success',
          correlation: { ...attempt.command.correlation, command_id: attempt.command.command_id },
          metadata: {
            command_type: attempt.command.command_type,
            attempts: attempt.attempts,
            result,
          },
        });
      } catch (error) {
        const failureClass = classifyError(error);
        attempt.attempts += 1;
        attempt.last_error = String((error as any)?.message || error || 'unknown error');
        attempt.updated_at = nowIso();

        if (failureClass === 'transient' && attempt.attempts < attempt.max_attempts) {
          attempt.status = 'retry_pending';
          attempt.next_retry_at = new Date(Date.now() + computeBackoffMs(attempt.attempts)).toISOString();
          await this.repo.upsertCommandAttempt(attempt);
          retried += 1;
        } else if (failureClass === 'transient') {
          attempt.status = 'dlq';
          delete attempt.next_retry_at;
          await this.repo.upsertCommandAttempt(attempt);
          dlq += 1;
        } else {
          attempt.status = 'failed';
          delete attempt.next_retry_at;
          await this.repo.upsertCommandAttempt(attempt);
          failed += 1;
        }

        await this.writeAudit({
          tenant_id: attempt.command.tenant_id,
          actor: attempt.command.actor,
          action: 'workflow.command.failed',
          target: auditTarget(
            'Autotask',
            'ticket',
            attempt.command.correlation.ticket_id || String(attempt.command.payload.ticket_id || '') || undefined
          ),
          result: 'failure',
          reason: attempt.last_error,
          correlation: { ...attempt.command.correlation, command_id: attempt.command.command_id },
          metadata: {
            command_type: attempt.command.command_type,
            failure_class: failureClass,
            attempts: attempt.attempts,
            status: attempt.status,
            next_retry_at: attempt.next_retry_at,
          },
        });
      }
    }

    return { processed: pending.length, completed, retried, dlq, failed };
  }

  private async applyLocalProjectionFromCommandResult(attempt: WorkflowCommandAttempt, result: WorkflowExecutionResult): Promise<void> {
    const tenantId = attempt.command.tenant_id;
    const ticketId =
      String((result as any)?.external_ticket_id || attempt.command.correlation.ticket_id || attempt.command.payload.ticket_id || '').trim();
    if (!ticketId) return;

    const existing = (await this.repo.getInboxTicket(tenantId, ticketId)) ?? {
      tenant_id: tenantId,
      ticket_id: ticketId,
      comments: [],
      source_of_truth: 'Autotask' as const,
      updated_at: nowIso(),
    };

    const patch = attempt.command.payload as any;
    const next: InboxTicketState = {
      ...existing,
      external_id: String((result as any)?.external_ticket_id || existing.external_id || ticketId),
      ...(String(patch.title ?? existing.title ?? '').trim() ? { title: String(patch.title ?? existing.title).trim() } : {}),
      ...(String(patch.description ?? existing.description ?? '').trim()
        ? { description: String(patch.description ?? existing.description).trim() }
        : {}),
      ...(String(patch.status ?? (result as any)?.status ?? existing.status ?? '').trim()
        ? { status: String(patch.status ?? (result as any)?.status ?? existing.status).trim() }
        : {}),
      ...(String(patch.assignee_resource_id ?? patch.assigned_to ?? (result as any)?.assigned_to ?? existing.assigned_to ?? '').trim()
        ? {
            assigned_to: String(
              patch.assignee_resource_id ?? patch.assigned_to ?? (result as any)?.assigned_to ?? existing.assigned_to
            ).trim(),
          }
        : {}),
      ...(Number.isFinite(Number(patch.queue_id)) ? { queue_id: Number(patch.queue_id) } : {}),
      ...(String(patch.queue_name ?? existing.queue_name ?? '').trim()
        ? { queue_name: String(patch.queue_name ?? existing.queue_name).trim() }
        : {}),
      last_command_id: attempt.command.command_id,
      updated_at: nowIso(),
    };

    const commentBody = String(patch.comment_body ?? patch.note_body ?? patch.noteText ?? '').trim();
    if (commentBody) {
      next.comments = [
        ...(existing.comments || []),
        {
          visibility: normalizeVisibility(patch.comment_visibility ?? patch.note_visibility),
          body: commentBody,
          created_at: nowIso(),
        },
      ];
    }

    if ((result as any)?.snapshot && typeof (result as any).snapshot === 'object') {
      const snapshot = (result as any).snapshot as Record<string, unknown>;
      if (snapshot.title) next.title = String(snapshot.title);
      if (snapshot.description) next.description = String(snapshot.description);
      if (snapshot.status) next.status = String(snapshot.status);
      if (snapshot.assigned_to) next.assigned_to = String(snapshot.assigned_to);
    }

    await this.repo.upsertInboxTicket(next);
  }

  async processAutotaskSyncEvent(event: WorkflowEventEnvelope): Promise<{ duplicate: boolean; applied: boolean; divergence?: boolean }> {
    const accepted = await this.repo.markSyncEventProcessed(event.tenant_id, event.event_id);
    if (!accepted) {
      return { duplicate: true, applied: false };
    }

    const ticketId = String(event.correlation.ticket_id || event.entity_id || '').trim();
    if (!ticketId) return { duplicate: false, applied: false };
    const existing = await this.repo.getInboxTicket(event.tenant_id, ticketId);

    const eventTimeMs = new Date(event.occurred_at).getTime();
    const currentTimeMs = new Date(existing?.last_event_occurred_at || 0).getTime();
    const isOutOfOrder = Boolean(existing?.last_event_occurred_at) && Number.isFinite(eventTimeMs) && Number.isFinite(currentTimeMs) && eventTimeMs < currentTimeMs;
    if (isOutOfOrder) {
      await this.writeAudit({
        tenant_id: event.tenant_id,
        actor: { kind: 'system', id: 'autotask-sync', origin: event.provenance.source },
        action: 'workflow.sync.ignored_out_of_order',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'success',
        correlation: event.correlation,
        metadata: { event_type: event.event_type, event_id: event.event_id, occurred_at: event.occurred_at },
      });
      return { duplicate: false, applied: false };
    }

    const payload = event.payload || {};
    const next: InboxTicketState = {
      tenant_id: event.tenant_id,
      ticket_id: ticketId,
      external_id: String((payload.external_id ?? existing?.external_id ?? ticketId) || ticketId),
      ...(String(payload.title ?? existing?.title ?? '').trim() ? { title: String(payload.title ?? existing?.title).trim() } : {}),
      ...(String(payload.description ?? existing?.description ?? '').trim()
        ? { description: String(payload.description ?? existing?.description).trim() }
        : {}),
      ...(String(payload.status ?? existing?.status ?? '').trim()
        ? { status: String(payload.status ?? existing?.status).trim() }
        : {}),
      ...(String(payload.assigned_to ?? existing?.assigned_to ?? '').trim()
        ? { assigned_to: String(payload.assigned_to ?? existing?.assigned_to).trim() }
        : {}),
      ...(Number.isFinite(Number(payload.queue_id)) ? { queue_id: Number(payload.queue_id) } : {}),
      ...(String(payload.queue_name ?? existing?.queue_name ?? '').trim()
        ? { queue_name: String(payload.queue_name ?? existing?.queue_name).trim() }
        : {}),
      comments: [...(existing?.comments || [])],
      last_sync_at: nowIso(),
      last_event_occurred_at: event.occurred_at,
      last_event_id: event.event_id,
      ...(existing?.last_command_id ? { last_command_id: existing.last_command_id } : {}),
      source_of_truth: 'Autotask',
      updated_at: nowIso(),
    };

    const commentBody = String(payload.comment_body || '').trim();
    if (commentBody) {
      next.comments.push({
        visibility: normalizeVisibility(payload.comment_visibility),
        body: commentBody,
        created_at: String(payload.comment_created_at || nowIso()),
      });
    }

    await this.repo.upsertInboxTicket(next);
    await this.writeAudit({
      tenant_id: event.tenant_id,
      actor: { kind: 'system', id: 'autotask-sync', origin: event.provenance.source },
      action: 'workflow.sync.applied',
      target: auditTarget('Autotask', 'ticket', ticketId),
      result: 'success',
      correlation: event.correlation,
      metadata: {
        event_type: event.event_type,
        event_id: event.event_id,
        provenance: event.provenance,
      },
    });

    const divergence = this.detectSimpleDivergence(existing, next, event);
    if (divergence) {
      await this.repo.addReconciliationIssue(divergence);
      await this.writeAudit({
        tenant_id: event.tenant_id,
        actor: { kind: 'system', id: 'autotask-sync', origin: event.provenance.source },
        action: 'workflow.reconciliation.divergence_detected',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason: divergence.reason,
        correlation: event.correlation,
        metadata: { issue_id: divergence.id, event_id: event.event_id },
      });
      return { duplicate: false, applied: true, divergence: true };
    }

    return { duplicate: false, applied: true };
  }

  private detectSimpleDivergence(
    previous: InboxTicketState | null,
    current: InboxTicketState,
    event: WorkflowEventEnvelope
  ): ReconciliationIssue | null {
    if (!previous?.last_command_id) return null;
    const payload = event.payload || {};
    const incomingStatus = String(payload.status || '').trim();
    if (incomingStatus && previous.status && previous.status !== incomingStatus && current.status === incomingStatus) {
      return {
        id: randomUUID(),
        tenant_id: event.tenant_id,
        ticket_id: current.ticket_id,
        detected_at: nowIso(),
        severity: 'warning',
        reason: 'autotask_status_differs_from_last_local_projection',
        local_snapshot: { status_before_sync: previous.status, last_command_id: previous.last_command_id },
        remote_snapshot: { status: incomingStatus, event_id: event.event_id },
        correlation: event.correlation,
        provenance: event.provenance,
      };
    }
    return null;
  }

  async reconcileTicket(tenantId: string, ticketId: string, correlation: WorkflowCorrelation): Promise<{ matched: boolean; issue?: ReconciliationIssue }> {
    const local = await this.repo.getInboxTicket(tenantId, ticketId);
    if (!this.gateway.fetchTicketSnapshot) {
      await this.writeAudit({
        tenant_id: tenantId,
        actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
        action: 'workflow.reconciliation.skipped_fetch_unavailable',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason: 'gateway_fetch_snapshot_unavailable',
        correlation,
        metadata: { degraded_mode: true },
      });
      return { matched: true };
    }
    let remote: Record<string, unknown> | null;
    try {
      remote = await this.gateway.fetchTicketSnapshot(tenantId, ticketId);
    } catch (error) {
      const classified = classifyQueueError(error);
      const upstreamMessage = error instanceof Error ? error.message : String(error);
      const reason =
        classified.code === 'RATE_LIMIT'
          ? 'autotask_snapshot_fetch_rate_limited'
          : classified.code === 'TIMEOUT'
            ? 'autotask_snapshot_fetch_timeout'
            : 'autotask_snapshot_fetch_failed';
      await this.writeAudit({
        tenant_id: tenantId,
        actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
        action: 'workflow.reconciliation.fetch_failed',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason,
        correlation,
        metadata: {
          classification: classified,
          retryable: classified.disposition === 'retry',
          degraded_mode: true,
          upstream_error: upstreamMessage,
        },
      });
      throw error;
    }
    if (!remote) {
      const issue: ReconciliationIssue = {
        id: randomUUID(),
        tenant_id: tenantId,
        ticket_id: ticketId,
        detected_at: nowIso(),
        severity: 'error',
        reason: 'autotask_snapshot_not_found',
        local_snapshot: (local || {}) as Record<string, unknown>,
        remote_snapshot: {},
        correlation,
        provenance: { source: 'autotask_reconcile', fetched_at: nowIso() },
      };
      await this.repo.addReconciliationIssue(issue);
      await this.writeAudit({
        tenant_id: tenantId,
        actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
        action: 'workflow.reconciliation.snapshot_missing',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason: issue.reason,
        correlation,
        metadata: { issue_id: issue.id },
      });
      return { matched: false, issue };
    }

    const localStatus = String(local?.status || '');
    const remoteStatus = String((remote as any).status || '');
    const remoteStatusLabel = String((remote as any).status_label || '');
    const localAssigned = String(local?.assigned_to || '');
    const remoteAssigned = String((remote as any).assigned_to || '');
    if ((!statusesMatch(localStatus, remoteStatus, remoteStatusLabel)) || (localAssigned && remoteAssigned && localAssigned !== remoteAssigned)) {
      const issue: ReconciliationIssue = {
        id: randomUUID(),
        tenant_id: tenantId,
        ticket_id: ticketId,
        detected_at: nowIso(),
        severity: 'warning',
        reason: 'autotask_snapshot_mismatch',
        local_snapshot: { status: localStatus, assigned_to: localAssigned },
        remote_snapshot: { status: remoteStatus, status_label: remoteStatusLabel, assigned_to: remoteAssigned },
        correlation,
        provenance: { source: 'autotask_reconcile', fetched_at: nowIso() },
      };
      await this.repo.addReconciliationIssue(issue);
      await this.writeAudit({
        tenant_id: tenantId,
        actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
        action: 'workflow.reconciliation.mismatch',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason: issue.reason,
        correlation,
        metadata: { issue_id: issue.id, local_snapshot: issue.local_snapshot, remote_snapshot: issue.remote_snapshot },
      });
      return { matched: false, issue };
    }

    await this.writeAudit({
      tenant_id: tenantId,
      actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
      action: 'workflow.reconciliation.match',
      target: auditTarget('Autotask', 'ticket', ticketId),
      result: 'success',
      correlation,
      metadata: { local_present: Boolean(local), remote_present: true },
    });
    return { matched: true };
  }

  async getCommand(commandId: string): Promise<WorkflowCommandAttempt | null> {
    return this.repo.getCommandById(commandId);
  }

  async listInbox(tenantId: string): Promise<InboxTicketState[]> {
    return this.repo.listInboxTickets(tenantId);
  }

  async listReconciliationIssues(tenantId: string, ticketId?: string): Promise<ReconciliationIssue[]> {
    return this.repo.listReconciliationIssues(tenantId, ticketId);
  }

  async listAuditByTicket(tenantId: string, ticketId: string): Promise<WorkflowAuditRecord[]> {
    return this.repo.listAuditByTicket(tenantId, ticketId);
  }
}

export function buildCommandEnvelope(input: {
  tenantId: string;
  targetIntegration: WorkflowTargetIntegration;
  commandType: WorkflowCommandType;
  payload: Record<string, unknown>;
  actor: { kind: WorkflowActorKind; id: string; origin: string };
  idempotencyKey: string;
  auditMetadata?: Record<string, unknown>;
  correlation?: Partial<WorkflowCorrelation>;
}): WorkflowCommandEnvelope {
  const commandId = randomUUID();
  const correlation: WorkflowCorrelation = {
    trace_id: input.correlation?.trace_id || randomUUID(),
    ...(input.correlation?.ticket_id ? { ticket_id: input.correlation.ticket_id } : {}),
    ...(input.correlation?.job_id ? { job_id: input.correlation.job_id } : {}),
    command_id: commandId,
  };

  return {
    command_id: commandId,
    tenant_id: input.tenantId,
    target_integration: input.targetIntegration,
    command_type: input.commandType,
    payload: input.payload,
    actor: input.actor,
    idempotency_key: input.idempotencyKey,
    audit_metadata: input.auditMetadata || {},
    correlation,
    requested_at: nowIso(),
  };
}
