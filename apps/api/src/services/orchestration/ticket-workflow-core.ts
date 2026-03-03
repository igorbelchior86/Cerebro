import { randomUUID } from 'crypto';
import { readJsonFileSafe, writeJsonFileAtomic } from '../read-models/runtime-json-file.js';
import { classifyQueueError } from '../../platform/errors.js';
import { resolveAutotaskOperation } from '../adapters/autotask-operation-registry.js';
import type { WorkflowRealtimeTicketChangePayload } from './workflow-realtime.js';
import { operationalLogger } from '../../lib/operational-logger.js';

export type WorkflowTargetIntegration =
  | 'Autotask'
  | 'IT Glue'
  | 'Ninja'
  | 'SentinelOne'
  | 'Check Point';

export type WorkflowCommandType =
  | 'create'
  | 'update'
  | 'update_priority'
  | 'delete'
  | 'ticket_delete'
  | 'assign'
  | 'update_assign'
  | 'status'
  | 'status_update'
  | 'update_status'
  | 'comment'
  | 'note'
  | 'comment_note'
  | 'create_comment_note'
  | 'update_note'
  | 'checklist_list_by_ticket'
  | 'checklist_create'
  | 'checklist_update'
  | 'checklist_delete'
  | 'time_entry'
  | 'time_entry_update'
  | 'time_entry_delete'
  | 'contacts_query_search'
  | 'contact_create'
  | 'contact_update'
  | 'companies_query_search'
  | 'company_create'
  | 'company_update';

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
  ticket_number?: string;
  created_at?: string;
  title?: string;
  description?: string;
  company?: string;
  requester?: string;
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
  domain_snapshots?: Partial<Record<ReconciliationDomain, Record<string, unknown>>>;
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

export type ReconciliationClassification =
  | 'match'
  | 'mismatch'
  | 'missing_snapshot'
  | 'fetch_failed'
  | 'skipped';

export type ReconciliationDomain =
  | 'tickets'
  | 'ticket_notes'
  | 'correlates.resources'
  | 'correlates.ticket_metadata'
  | 'correlates.ticket_note_metadata';

export interface ReconciliationDomainResult {
  domain: ReconciliationDomain;
  classification: ReconciliationClassification;
  reason?: string;
  local_present: boolean;
  remote_present: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationResult {
  matched: boolean;
  classification: ReconciliationClassification;
  domains: ReconciliationDomainResult[];
  issue?: ReconciliationIssue;
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

export class WorkflowReconcileFetchError extends Error {
  constructor(
    message: string,
    public readonly info: {
      reason: string;
      retryable: boolean;
      statusCode: number;
      classification: ReturnType<typeof classifyQueueError>;
      operation: {
        operation: 'reconcile.fetch';
        attempts: number;
        max_attempts: number;
        disposition: 'retry_pending' | 'dlq';
        next_retry_at?: string;
      };
    }
  ) {
    super(message);
    this.name = 'WorkflowReconcileFetchError';
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
  deleteInboxTicket(tenantId: string, ticketId: string): Promise<void>;
  getInboxTicket(tenantId: string, ticketId: string): Promise<InboxTicketState | null>;
  listInboxTickets(tenantId: string): Promise<InboxTicketState[]>;
  addReconciliationIssue(issue: ReconciliationIssue): Promise<void>;
  listReconciliationIssues(tenantId: string, ticketId?: string): Promise<ReconciliationIssue[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function normalizeVisibility(input: unknown): 'internal' | 'public' {
  return String(input || '').toLowerCase() === 'internal' ? 'internal' : 'public';
}

function extractCommentBodyForProjection(payload: Record<string, unknown>): string {
  return String(
    payload.comment_body_rich ??
    payload.note_body_rich ??
    payload.noteText_rich ??
    payload.comment_body ??
    payload.note_body ??
    payload.noteText ??
    ''
  ).trim();
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

function normalizeFreeText(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 2_000);
}

function fingerprintText(input: unknown): string {
  const normalized = normalizeFreeText(input);
  if (!normalized) return '';
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16)}`;
}

function normalizeEventDomainSnapshots(payload: Record<string, unknown>) {
  const ticketId = String(payload.external_id ?? payload.ticket_id ?? '').trim();
  const ticketNumber = String(payload.ticket_number ?? '').trim();
  const createdAt = String(payload.created_at ?? '').trim();
  const companyName = String(payload.company_name ?? payload.company ?? '').trim();
  const requesterName = String(payload.requester ?? payload.contact_name ?? '').trim();
  const status = String(payload.status ?? '').trim();
  const statusLabel = String(payload.status_label ?? '').trim();
  const assignedTo = String(payload.assigned_to ?? '').trim();
  const queueIdRaw = payload.queue_id ?? payload.queueID;
  const queueId = Number(queueIdRaw);
  const companyId = Number(payload.company_id ?? payload.companyID);
  const contactId = Number(payload.contact_id ?? payload.contactID);
  const queueName = String(payload.queue_name ?? '').trim();
  const commentBody = extractCommentBodyForProjection(payload);
  const commentVisibility = String(payload.comment_visibility ?? '').trim().toLowerCase();
  const noteFingerprint = fingerprintText(commentBody);
  const commentCreatedAt = String(payload.comment_created_at ?? '').trim();
  return {
    tickets: {
      ...(ticketId ? { external_id: ticketId } : {}),
      ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(companyName ? { company_name: companyName } : {}),
      ...(Number.isFinite(companyId) ? { company_id: companyId } : {}),
      ...(requesterName ? { requester_name: requesterName } : {}),
      ...(Number.isFinite(contactId) ? { contact_id: contactId } : {}),
      ...(status ? { status } : {}),
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
      ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
      ...(queueName ? { queue_name: queueName } : {}),
    },
    ticket_notes: {
      ...(commentBody ? { latest_note_fingerprint: noteFingerprint } : {}),
    },
    'correlates.resources': {
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
    },
    'correlates.ticket_metadata': {
      ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(companyName ? { company_name: companyName } : {}),
      ...(Number.isFinite(companyId) ? { company_id: companyId } : {}),
      ...(requesterName ? { requester_name: requesterName } : {}),
      ...(Number.isFinite(contactId) ? { contact_id: contactId } : {}),
      ...(status ? { status } : {}),
      ...(statusLabel ? { status_label: statusLabel } : {}),
      ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
    },
    'correlates.ticket_note_metadata': {
      ...(commentBody ? { latest_note_fingerprint: noteFingerprint } : {}),
      ...(commentVisibility ? { latest_note_visibility: commentVisibility } : {}),
      ...(commentCreatedAt ? { latest_note_created_at: commentCreatedAt } : {}),
    },
  } satisfies Partial<Record<ReconciliationDomain, Record<string, unknown>>>;
}

function isTicketNumberLike(value: unknown): boolean {
  const v = String(value ?? '').trim();
  return /^T[0-9]{8}\.[0-9]{4}$/i.test(v);
}

function ticketNumberToIsoDate(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  const match = /^T(\d{4})(\d{2})(\d{2})\.\d{4}$/i.exec(raw);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return utc.toISOString();
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function inferCreatedAt(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const fromIso = normalizeIsoTimestamp(candidate);
    if (fromIso) return fromIso;
    const fromTicketNumber = ticketNumberToIsoDate(candidate);
    if (fromTicketNumber) return fromTicketNumber;
  }
  return undefined;
}

function aggregateReconciliationClassification(rows: ReconciliationDomainResult[]): ReconciliationClassification {
  if (rows.some((r) => r.classification === 'fetch_failed')) return 'fetch_failed';
  if (rows.some((r) => r.classification === 'mismatch')) return 'mismatch';
  if (rows.some((r) => r.classification === 'missing_snapshot')) return 'missing_snapshot';
  if (rows.length > 0 && rows.every((r) => r.classification === 'skipped')) return 'skipped';
  return 'match';
}

function selectFirstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return undefined;
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
  private readonly persistDebounceMs =
    process.env.NODE_ENV === 'test'
      ? 0
      : readNonNegativeInt(process.env.P0_WORKFLOW_PERSIST_DEBOUNCE_MS, 2_000);
  private readonly maxAuditEntries = readPositiveInt(process.env.P0_WORKFLOW_MAX_AUDIT_ENTRIES, 5_000);
  private readonly maxReconciliationIssues = readPositiveInt(process.env.P0_WORKFLOW_MAX_RECON_ISSUES, 2_000);
  private readonly maxProcessedSyncEvents = readPositiveInt(process.env.P0_WORKFLOW_MAX_PROCESSED_EVENTS, 20_000);
  private readonly maxCommentsPerTicket = readPositiveInt(process.env.P0_WORKFLOW_MAX_COMMENTS_PER_TICKET, 25);
  private persistTimer: NodeJS.Timeout | null = null;

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
    this.inbox = new Map((snapshot.inbox || []).map(([key, value]) => {
      const comments = Array.isArray(value?.comments) ? value.comments.slice(-this.maxCommentsPerTicket) : [];
      return [key, { ...value, comments } as InboxTicketState];
    }));
    this.reconciliationIssues = Array.isArray(snapshot.reconciliationIssues) ? snapshot.reconciliationIssues : [];
    this.trimAudits();
    this.trimProcessedSyncEvents();
    this.trimReconciliationIssues();
  }

  private persistState(): void {
    if (!this.persistenceFilePath) return;
    const startedAt = Date.now();
    writeJsonFileAtomic(this.persistenceFilePath, {
      commandsById: Array.from(this.commandsById.entries()),
      commandsByIdempotency: Array.from(this.commandsByIdempotency.entries()),
      audits: this.audits,
      processedSyncEvents: Array.from(this.processedSyncEvents.values()),
      inbox: Array.from(this.inbox.entries()),
      reconciliationIssues: this.reconciliationIssues,
    });
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1_000) {
      operationalLogger.warn('workflow.runtime.persistence_slow_write', {
        module: 'orchestration.ticket-workflow-core',
        persistence_file_path: this.persistenceFilePath,
        duration_ms: durationMs,
        command_count: this.commandsById.size,
        inbox_count: this.inbox.size,
        audit_count: this.audits.length,
      });
    }
  }

  private requestPersistState(): void {
    if (!this.persistenceFilePath) return;
    if (this.persistDebounceMs <= 0) {
      this.persistState();
      return;
    }
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, this.persistDebounceMs);
    this.persistTimer.unref();
  }

  private trimAudits(): void {
    if (this.audits.length <= this.maxAuditEntries) return;
    this.audits = this.audits.slice(this.audits.length - this.maxAuditEntries);
  }

  private trimReconciliationIssues(): void {
    if (this.reconciliationIssues.length <= this.maxReconciliationIssues) return;
    this.reconciliationIssues = this.reconciliationIssues.slice(this.reconciliationIssues.length - this.maxReconciliationIssues);
  }

  private trimProcessedSyncEvents(): void {
    while (this.processedSyncEvents.size > this.maxProcessedSyncEvents) {
      const oldest = this.processedSyncEvents.values().next().value;
      if (!oldest) break;
      this.processedSyncEvents.delete(oldest);
    }
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
    this.requestPersistState();
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
    this.trimAudits();
    this.requestPersistState();
  }

  async listAuditByTicket(tenantId: string, ticketId: string): Promise<WorkflowAuditRecord[]> {
    return this.audits.filter((r) => r.tenant_id === tenantId && r.correlation.ticket_id === ticketId).map((r) => structuredClone(r));
  }

  async markSyncEventProcessed(tenantId: string, eventId: string): Promise<boolean> {
    const key = `${tenantId}::${eventId}`;
    if (this.processedSyncEvents.has(key)) return false;
    this.processedSyncEvents.add(key);
    this.trimProcessedSyncEvents();
    this.requestPersistState();
    return true;
  }

  async upsertInboxTicket(state: InboxTicketState): Promise<void> {
    const normalizedState: InboxTicketState = {
      ...state,
      comments: Array.isArray(state.comments) ? state.comments.slice(-this.maxCommentsPerTicket) : [],
    };
    this.inbox.set(this.inboxKey(state.tenant_id, state.ticket_id), structuredClone(normalizedState));
    this.requestPersistState();
  }

  async deleteInboxTicket(tenantId: string, ticketId: string): Promise<void> {
    this.inbox.delete(this.inboxKey(tenantId, ticketId));
    this.requestPersistState();
  }

  async getInboxTicket(tenantId: string, ticketId: string): Promise<InboxTicketState | null> {
    const row = this.inbox.get(this.inboxKey(tenantId, ticketId));
    return row ? structuredClone(row) : null;
  }

  async listInboxTickets(tenantId: string): Promise<InboxTicketState[]> {
    return Array.from(this.inbox.values())
      .filter((row) => row.tenant_id === tenantId)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .map((row) => ({
        ...row,
        comments: Array.isArray(row.comments) ? row.comments.slice(-this.maxCommentsPerTicket) : [],
      }));
  }

  async addReconciliationIssue(issue: ReconciliationIssue): Promise<void> {
    this.reconciliationIssues.push(structuredClone(issue));
    this.trimReconciliationIssues();
    this.requestPersistState();
  }

  async listReconciliationIssues(tenantId: string, ticketId?: string): Promise<ReconciliationIssue[]> {
    return this.reconciliationIssues
      .filter((r) => r.tenant_id === tenantId && (!ticketId || r.ticket_id === ticketId))
      .map((r) => structuredClone(r));
  }
}

export class TicketWorkflowCoreService {
  private readonly reconcileFailureState = new Map<
    string,
    { attempts: number; max_attempts: number; disposition: 'retry_pending' | 'dlq'; next_retry_at?: string }
  >();
  private readonly maxCommentsPerTicket = readPositiveInt(process.env.P0_WORKFLOW_MAX_COMMENTS_PER_TICKET, 25);

  constructor(
    private readonly repo: TicketWorkflowRepository,
    private readonly gateway: TicketWorkflowGateway,
    private readonly options: { maxAttempts?: number; realtimePublisher?: (payload: WorkflowRealtimeTicketChangePayload) => void } = {}
  ) { }

  private publishRealtime(payload: WorkflowRealtimeTicketChangePayload): void {
    operationalLogger.info('workflow.realtime.publish', {
      module: 'orchestration.ticket-workflow-core',
      change_kind: payload.change_kind,
      command_id: payload.command_id,
      sync_event_id: payload.sync_event_id,
    }, {
      tenant_id: payload.tenant_id,
      ticket_id: payload.ticket_id,
      trace_id: payload.trace_id || null,
    });
    this.options.realtimePublisher?.(payload);
  }

  private maxAttempts(): number {
    return Math.max(1, this.options.maxAttempts ?? 3);
  }

  private reconcileMaxAttempts(): number {
    return Math.max(2, Number(process.env.P0_RECONCILE_MAX_ATTEMPTS || 3));
  }

  private reconcileFailureKey(tenantId: string, ticketId: string): string {
    return `${tenantId}::${ticketId}::reconcile.fetch`;
  }

  private registerReconcileFetchFailure(tenantId: string, ticketId: string, retryable: boolean) {
    const key = this.reconcileFailureKey(tenantId, ticketId);
    const previous = this.reconcileFailureState.get(key);
    const attempts = (previous?.attempts ?? 0) + 1;
    const maxAttempts = previous?.max_attempts ?? this.reconcileMaxAttempts();
    if (!retryable || attempts >= maxAttempts) {
      const result = { attempts, max_attempts: maxAttempts, disposition: 'dlq' as const };
      this.reconcileFailureState.set(key, result);
      return result;
    }
    const delayMs = computeBackoffMs(attempts);
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    const result = {
      attempts,
      max_attempts: maxAttempts,
      disposition: 'retry_pending' as const,
      next_retry_at: nextRetryAt,
    };
    this.reconcileFailureState.set(key, result);
    return result;
  }

  private clearReconcileFetchFailure(tenantId: string, ticketId: string): void {
    this.reconcileFailureState.delete(this.reconcileFailureKey(tenantId, ticketId));
  }

  private async writeAudit(args: Omit<WorkflowAuditRecord, 'audit_id' | 'timestamp'>): Promise<void> {
    await this.repo.saveAudit({
      audit_id: randomUUID(),
      timestamp: nowIso(),
      ...args,
    });
  }

  private async resolveCanonicalInboxIdentity(
    tenantId: string,
    eventTicketId: string,
    payload: Record<string, unknown>,
  ): Promise<{ canonicalTicketId: string; aliasesToDelete: string[]; existing: InboxTicketState | null }> {
    const incomingExternalId = String(payload.external_id ?? '').trim();
    const incomingTicketNumber = String(payload.ticket_number ?? '').trim();
    const rows = await this.repo.listInboxTickets(tenantId);
    const matching = rows.filter((row) => {
      if (incomingExternalId && (String(row.external_id || '').trim() === incomingExternalId || row.ticket_id === incomingExternalId)) return true;
      if (incomingTicketNumber && (String(row.ticket_number || '').trim() === incomingTicketNumber || row.ticket_id === incomingTicketNumber)) return true;
      return row.ticket_id === eventTicketId;
    });
    if (matching.length === 0) {
      const existing = await this.repo.getInboxTicket(tenantId, eventTicketId);
      return { canonicalTicketId: eventTicketId, aliasesToDelete: [], existing };
    }

    const preferred = matching
      .slice()
      .sort((a, b) => {
        const aScore =
          (incomingTicketNumber && String(a.ticket_number || '').trim() === incomingTicketNumber ? 100 : 0) +
          (incomingExternalId && String(a.external_id || '').trim() === incomingExternalId ? 50 : 0) +
          (isTicketNumberLike(a.ticket_id) ? 20 : 0);
        const bScore =
          (incomingTicketNumber && String(b.ticket_number || '').trim() === incomingTicketNumber ? 100 : 0) +
          (incomingExternalId && String(b.external_id || '').trim() === incomingExternalId ? 50 : 0) +
          (isTicketNumberLike(b.ticket_id) ? 20 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
      })[0];
    const canonicalTicketId = preferred?.ticket_id || eventTicketId;
    const aliasesToDelete = matching
      .map((row) => row.ticket_id)
      .filter((id) => id !== canonicalTicketId);
    const existing = (await this.repo.getInboxTicket(tenantId, canonicalTicketId)) || preferred || null;
    return { canonicalTicketId, aliasesToDelete, existing };
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

    const operation = resolveAutotaskOperation(command.command_type, command.payload || {});
    if (operation.rejected) {
      await this.writeAudit({
        tenant_id: command.tenant_id,
        actor: command.actor,
        action: 'workflow.command.rejected',
        target: auditTarget('Autotask', 'ticket', targetTicketId || undefined),
        result: 'rejected',
        reason: operation.reason,
        correlation: { ...command.correlation, command_id: command.command_id },
        metadata: {
          policy: 'autotask_phase1_frozen_operation_matrix',
          idempotency_key: command.idempotency_key,
          command_type: command.command_type,
          audit_metadata: command.audit_metadata,
        },
      });
      throw new WorkflowPolicyError(`Command type is outside approved Autotask Phase 1 matrix: ${command.command_type}`);
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
        autotask_operation: operation.operation.canonical_operation,
        autotask_handler: operation.operation.handler,
        autotask_audit_action: operation.operation.audit_action,
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
      const operation = resolveAutotaskOperation(attempt.command.command_type, attempt.command.payload || {});
      if (operation.rejected) {
        attempt.attempts += 1;
        attempt.status = 'failed';
        attempt.last_error = `command rejected by frozen matrix: ${operation.reason}`;
        delete attempt.next_retry_at;
        attempt.updated_at = nowIso();
        await this.repo.upsertCommandAttempt(attempt);
        failed += 1;
        await this.writeAudit({
          tenant_id: attempt.command.tenant_id,
          actor: attempt.command.actor,
          action: 'workflow.command.rejected',
          target: auditTarget(
            'Autotask',
            'ticket',
            attempt.command.correlation.ticket_id || String(attempt.command.payload.ticket_id || '') || undefined
          ),
          result: 'rejected',
          reason: operation.reason,
          correlation: { ...attempt.command.correlation, command_id: attempt.command.command_id },
          metadata: {
            policy: 'autotask_phase1_frozen_operation_matrix',
            command_type: attempt.command.command_type,
          },
        });
        continue;
      }

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
        this.publishRealtime({
          tenant_id: attempt.command.tenant_id,
          ticket_id: String(
            (result as any)?.external_ticket_number ||
            (result as any)?.external_ticket_id ||
            attempt.command.correlation.ticket_id ||
            attempt.command.payload.ticket_id ||
            ''
          ),
          trace_id: attempt.command.correlation.trace_id,
          command_id: attempt.command.command_id,
          occurred_at: nowIso(),
          change_kind: 'process_result',
          process_result: {
            command_id: attempt.command.command_id,
            command_type: attempt.command.command_type,
            outcome: 'completed',
            attempts: attempt.attempts,
          },
        });
        await this.writeAudit({
          tenant_id: attempt.command.tenant_id,
          actor: attempt.command.actor,
          action: 'workflow.command.completed',
          target: auditTarget(
            'Autotask',
            'ticket',
            String(
              (result as any)?.external_ticket_number ||
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
            autotask_operation: operation.operation.canonical_operation,
            autotask_handler: operation.operation.handler,
            autotask_audit_action: operation.operation.audit_action,
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
            autotask_operation: operation.operation.canonical_operation,
            autotask_handler: operation.operation.handler,
            autotask_audit_action: operation.operation.audit_action,
            failure_class: failureClass,
            attempts: attempt.attempts,
            status: attempt.status,
            next_retry_at: attempt.next_retry_at,
          },
        });

        this.publishRealtime({
          tenant_id: attempt.command.tenant_id,
          ticket_id: String(attempt.command.correlation.ticket_id || attempt.command.payload.ticket_id || ''),
          trace_id: attempt.command.correlation.trace_id,
          command_id: attempt.command.command_id,
          occurred_at: nowIso(),
          change_kind: 'process_result',
          process_result: {
            command_id: attempt.command.command_id,
            command_type: attempt.command.command_type,
            outcome: attempt.status === 'retry_pending' ? 'retry_pending' : attempt.status === 'dlq' ? 'dlq' : 'failed',
            attempts: attempt.attempts,
            ...(attempt.next_retry_at ? { next_retry_at: attempt.next_retry_at } : {}),
            ...(attempt.last_error ? { reason: attempt.last_error } : {}),
          },
        });
      }
    }

    return { processed: pending.length, completed, retried, dlq, failed };
  }

  private async applyLocalProjectionFromCommandResult(attempt: WorkflowCommandAttempt, result: WorkflowExecutionResult): Promise<void> {
    const tenantId = attempt.command.tenant_id;
    const ticketId =
      String((result as any)?.external_ticket_number || (result as any)?.external_ticket_id || attempt.command.correlation.ticket_id || attempt.command.payload.ticket_id || '').trim();
    if (!ticketId) return;

    const existing = (await this.repo.getInboxTicket(tenantId, ticketId)) ?? {
      tenant_id: tenantId,
      ticket_id: ticketId,
      comments: [],
      source_of_truth: 'Autotask' as const,
      updated_at: nowIso(),
    };
    const resolvedCreatedAt = inferCreatedAt(
      existing.created_at,
      (result as any)?.snapshot?.created_at,
      (attempt.command.payload as any)?.created_at,
      (result as any)?.external_ticket_number,
      (result as any)?.snapshot?.ticket_number,
      existing.ticket_number,
      ticketId
    );

    const patch = attempt.command.payload as any;
    const next: InboxTicketState = {
      ...existing,
      external_id: String((result as any)?.external_ticket_id || existing.external_id || ticketId),
      ...(String((result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number || '').trim()
        ? {
          ticket_number: String(
            (result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number
          ).trim(),
        }
        : {}),
      ...(String(patch.title ?? existing.title ?? '').trim() ? { title: String(patch.title ?? existing.title).trim() } : {}),
      ...(String(patch.description ?? existing.description ?? '').trim()
        ? { description: String(patch.description ?? existing.description).trim() }
        : {}),
      ...(resolvedCreatedAt ? { created_at: resolvedCreatedAt } : {}),
      ...(String((result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company ?? '').trim()
        ? {
          company: String(
            (result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company
          ).trim(),
        }
        : {}),
      ...(String((result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? existing.requester ?? '').trim()
        ? {
          requester: String(
            (result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? existing.requester
          ).trim(),
        }
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
      domain_snapshots: {
        ...(existing.domain_snapshots || {}),
        tickets: {
          ...(existing.domain_snapshots?.tickets || {}),
          ...(String((result as any)?.external_ticket_id || existing.external_id || ticketId).trim()
            ? { external_id: String((result as any)?.external_ticket_id || existing.external_id || ticketId).trim() }
            : {}),
          ...(String((result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number || '').trim()
            ? {
              ticket_number: String(
                (result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number
              ).trim(),
            }
            : {}),
          ...(String((result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company ?? '').trim()
            ? {
              company_name: String(
                (result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company
              ).trim(),
            }
            : {}),
          ...(resolvedCreatedAt ? { created_at: resolvedCreatedAt } : {}),
          ...(String((result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? patch.requester ?? existing.requester ?? '').trim()
            ? {
              requester_name: String(
                (result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? patch.requester ?? existing.requester
              ).trim(),
            }
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
        },
        'correlates.resources': {
          ...(existing.domain_snapshots?.['correlates.resources'] || {}),
          ...(String(patch.assignee_resource_id ?? patch.assigned_to ?? (result as any)?.assigned_to ?? existing.assigned_to ?? '').trim()
            ? {
              assigned_to: String(
                patch.assignee_resource_id ?? patch.assigned_to ?? (result as any)?.assigned_to ?? existing.assigned_to
              ).trim(),
            }
            : {}),
        },
        'correlates.ticket_metadata': {
          ...(existing.domain_snapshots?.['correlates.ticket_metadata'] || {}),
          ...(String((result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number || '').trim()
            ? {
              ticket_number: String(
                (result as any)?.external_ticket_number || (result as any)?.snapshot?.ticket_number || existing.ticket_number
              ).trim(),
            }
            : {}),
          ...(String((result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company ?? '').trim()
            ? {
              company_name: String(
                (result as any)?.snapshot?.company_name ?? (result as any)?.snapshot?.company ?? patch.company_name ?? patch.company ?? existing.company
              ).trim(),
            }
            : {}),
          ...(resolvedCreatedAt ? { created_at: resolvedCreatedAt } : {}),
          ...(String((result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? patch.requester ?? existing.requester ?? '').trim()
            ? {
              requester_name: String(
                (result as any)?.snapshot?.contact_name ?? (result as any)?.snapshot?.requester ?? patch.requester ?? existing.requester
              ).trim(),
            }
            : {}),
          ...(String(patch.status ?? (result as any)?.status ?? existing.status ?? '').trim()
            ? { status: String(patch.status ?? (result as any)?.status ?? existing.status).trim() }
            : {}),
          ...(Number.isFinite(Number(patch.queue_id)) ? { queue_id: Number(patch.queue_id) } : {}),
        },
      },
      last_command_id: attempt.command.command_id,
      updated_at: nowIso(),
    };

    const commentBody = extractCommentBodyForProjection(patch as Record<string, unknown>);
    if (commentBody) {
      next.comments = [
        ...(existing.comments || []),
        {
          visibility: normalizeVisibility(patch.comment_visibility ?? patch.note_visibility),
          body: commentBody,
          created_at: nowIso(),
        },
      ].slice(-this.maxCommentsPerTicket);
      next.domain_snapshots = {
        ...(next.domain_snapshots || {}),
        ticket_notes: {
          ...(next.domain_snapshots?.ticket_notes || {}),
          latest_note_fingerprint: fingerprintText(commentBody),
        },
        'correlates.ticket_note_metadata': {
          ...(next.domain_snapshots?.['correlates.ticket_note_metadata'] || {}),
          latest_note_fingerprint: fingerprintText(commentBody),
          latest_note_visibility: normalizeVisibility(patch.comment_visibility ?? patch.note_visibility),
          latest_note_created_at: nowIso(),
        },
      };
    }

    if ((result as any)?.snapshot && typeof (result as any).snapshot === 'object') {
      const snapshot = (result as any).snapshot as Record<string, unknown>;
      if (snapshot.title) next.title = String(snapshot.title);
      if (snapshot.description) next.description = String(snapshot.description);
      if (snapshot.company_name || snapshot.company) {
        next.company = String(snapshot.company_name ?? snapshot.company);
      }
      if (snapshot.status) next.status = String(snapshot.status);
      if (snapshot.assigned_to) next.assigned_to = String(snapshot.assigned_to);
      if (snapshot.ticket_number) next.ticket_number = String(snapshot.ticket_number);
      if (!next.created_at && snapshot.created_at) {
        const snapshotCreatedAt = inferCreatedAt(snapshot.created_at);
        if (snapshotCreatedAt) next.created_at = snapshotCreatedAt;
      }
      if (snapshot.contact_name || snapshot.requester) {
        next.requester = String(snapshot.contact_name ?? snapshot.requester);
      }
    }

    await this.repo.upsertInboxTicket(next);
    const traceId = attempt.command.correlation.trace_id;
    const comment = next.comments[next.comments.length - 1];
    const changeKind: WorkflowRealtimeTicketChangePayload['change_kind'] =
      commentBody
        ? 'comment'
        : String(patch.assignee_resource_id ?? patch.assigned_to ?? (result as any)?.assigned_to ?? '').trim()
          ? 'assigned'
          : String(patch.status ?? (result as any)?.status ?? '').trim()
            ? 'status'
            : 'sync';
    this.publishRealtime({
      tenant_id: tenantId,
      ticket_id: ticketId,
      trace_id: traceId,
      command_id: attempt.command.command_id,
      occurred_at: nowIso(),
      change_kind: changeKind,
      ...(next.status ? { status: next.status } : {}),
      ...(next.assigned_to ? { assigned_to: next.assigned_to } : {}),
      ...(Number.isFinite(Number(next.queue_id)) ? { queue_id: Number(next.queue_id) } : {}),
      ...(next.queue_name ? { queue_name: next.queue_name } : {}),
      ...(comment && commentBody
        ? {
          comment: {
            visibility: comment.visibility,
            body: comment.body,
            created_at: comment.created_at,
          },
        }
        : {}),
    });
  }

  async processAutotaskSyncEvent(event: WorkflowEventEnvelope): Promise<{ duplicate: boolean; applied: boolean; divergence?: boolean }> {
    const accepted = await this.repo.markSyncEventProcessed(event.tenant_id, event.event_id);
    if (!accepted) {
      return { duplicate: true, applied: false };
    }

    const eventTicketId = String(event.correlation.ticket_id || event.entity_id || '').trim();
    const payload = event.payload || {};
    const {
      canonicalTicketId: ticketId,
      aliasesToDelete,
      existing,
    } = await this.resolveCanonicalInboxIdentity(event.tenant_id, eventTicketId, payload);
    if (!ticketId) return { duplicate: false, applied: false };

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

    const domainSnapshots = normalizeEventDomainSnapshots(payload);
    const resolvedCreatedAt = inferCreatedAt(
      existing?.created_at,
      payload.created_at,
      (domainSnapshots.tickets as any)?.created_at,
      payload.ticket_number,
      existing?.ticket_number,
      ticketId
    );
    const next: InboxTicketState = {
      tenant_id: event.tenant_id,
      ticket_id: ticketId,
      external_id: String((payload.external_id ?? existing?.external_id ?? ticketId) || ticketId),
      ...(String(payload.ticket_number ?? existing?.ticket_number ?? '').trim()
        ? { ticket_number: String(payload.ticket_number ?? existing?.ticket_number).trim() }
        : {}),
      ...(resolvedCreatedAt ? { created_at: resolvedCreatedAt } : {}),
      ...(String(payload.title ?? existing?.title ?? '').trim() ? { title: String(payload.title ?? existing?.title).trim() } : {}),
      ...(String(payload.description ?? existing?.description ?? '').trim()
        ? { description: String(payload.description ?? existing?.description).trim() }
        : {}),
      ...(String(payload.company_name ?? payload.company ?? existing?.company ?? '').trim()
        ? { company: String(payload.company_name ?? payload.company ?? existing?.company).trim() }
        : {}),
      ...(String(payload.requester ?? payload.contact_name ?? existing?.requester ?? '').trim()
        ? { requester: String(payload.requester ?? payload.contact_name ?? existing?.requester).trim() }
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
      domain_snapshots: {
        ...(existing?.domain_snapshots || {}),
        ...domainSnapshots,
      },
      updated_at: nowIso(),
    };

    const commentBody = extractCommentBodyForProjection(payload);
    if (commentBody) {
      next.comments.push({
        visibility: normalizeVisibility(payload.comment_visibility),
        body: commentBody,
        created_at: String(payload.comment_created_at || nowIso()),
      });
      next.comments = next.comments.slice(-this.maxCommentsPerTicket);
    }

    await this.repo.upsertInboxTicket(next);
    for (const aliasId of aliasesToDelete) {
      await this.repo.deleteInboxTicket(event.tenant_id, aliasId);
    }
    const syncedComment = commentBody
      ? {
        visibility: normalizeVisibility(payload.comment_visibility),
        body: commentBody,
        created_at: String(payload.comment_created_at || nowIso()),
      }
      : undefined;
    this.publishRealtime({
      tenant_id: event.tenant_id,
      ticket_id: ticketId,
      trace_id: event.correlation.trace_id,
      sync_event_id: event.event_id,
      occurred_at: nowIso(),
      change_kind: commentBody ? 'comment' : 'sync',
      ...(next.status ? { status: next.status } : {}),
      ...(next.assigned_to ? { assigned_to: next.assigned_to } : {}),
      ...(Number.isFinite(Number(next.queue_id)) ? { queue_id: Number(next.queue_id) } : {}),
      ...(next.queue_name ? { queue_name: next.queue_name } : {}),
      ...(syncedComment ? { comment: syncedComment } : {}),
    });
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
        domains: Object.keys(domainSnapshots),
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

  async reconcileTicket(tenantId: string, ticketId: string, correlation: WorkflowCorrelation): Promise<ReconciliationResult> {
    const local = await this.repo.getInboxTicket(tenantId, ticketId);
    const skippedDomains: ReconciliationDomainResult[] = [
      { domain: 'tickets', classification: 'skipped', reason: 'gateway_fetch_snapshot_unavailable', local_present: Boolean(local), remote_present: false },
      { domain: 'ticket_notes', classification: 'skipped', reason: 'gateway_fetch_snapshot_unavailable', local_present: Boolean(local?.domain_snapshots?.ticket_notes), remote_present: false },
      { domain: 'correlates.resources', classification: 'skipped', reason: 'gateway_fetch_snapshot_unavailable', local_present: Boolean(local?.domain_snapshots?.['correlates.resources']), remote_present: false },
      { domain: 'correlates.ticket_metadata', classification: 'skipped', reason: 'gateway_fetch_snapshot_unavailable', local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_metadata']), remote_present: false },
      { domain: 'correlates.ticket_note_metadata', classification: 'skipped', reason: 'gateway_fetch_snapshot_unavailable', local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_note_metadata']), remote_present: false },
    ];

    if (!this.gateway.fetchTicketSnapshot) {
      await this.writeAudit({
        tenant_id: tenantId,
        actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
        action: 'workflow.reconciliation.skipped_fetch_unavailable',
        target: auditTarget('Autotask', 'ticket', ticketId),
        result: 'failure',
        reason: 'gateway_fetch_snapshot_unavailable',
        correlation,
        metadata: { degraded_mode: true, domains: skippedDomains },
      });
      return { matched: true, classification: 'skipped', domains: skippedDomains };
    }

    let remote: Record<string, unknown> | null;
    try {
      remote = await this.gateway.fetchTicketSnapshot(tenantId, ticketId);
      this.clearReconcileFetchFailure(tenantId, ticketId);
    } catch (error) {
      const classified = classifyQueueError(error);
      const upstreamMessage = error instanceof Error ? error.message : String(error);
      const retryable = classified.disposition === 'retry';
      const operation = this.registerReconcileFetchFailure(tenantId, ticketId, retryable);
      const reason =
        classified.code === 'RATE_LIMIT'
          ? 'autotask_snapshot_fetch_rate_limited'
          : classified.code === 'TIMEOUT'
            ? 'autotask_snapshot_fetch_timeout'
            : 'autotask_snapshot_fetch_failed';
      const domains: ReconciliationDomainResult[] = [
        { domain: 'tickets', classification: 'fetch_failed', reason, local_present: Boolean(local), remote_present: false },
        { domain: 'ticket_notes', classification: 'fetch_failed', reason, local_present: Boolean(local?.domain_snapshots?.ticket_notes), remote_present: false },
        { domain: 'correlates.resources', classification: 'fetch_failed', reason, local_present: Boolean(local?.domain_snapshots?.['correlates.resources']), remote_present: false },
        { domain: 'correlates.ticket_metadata', classification: 'fetch_failed', reason, local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_metadata']), remote_present: false },
        { domain: 'correlates.ticket_note_metadata', classification: 'fetch_failed', reason, local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_note_metadata']), remote_present: false },
      ];

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
          retryable,
          degraded_mode: true,
          upstream_error: upstreamMessage,
          operation,
          domains,
        },
      });

      throw new WorkflowReconcileFetchError('Autotask reconcile snapshot fetch failed; retry later', {
        reason,
        retryable: retryable && operation.disposition === 'retry_pending',
        statusCode: classified.code === 'RATE_LIMIT' ? 429 : classified.code === 'TIMEOUT' ? 504 : 503,
        classification: classified,
        operation: {
          operation: 'reconcile.fetch',
          attempts: operation.attempts,
          max_attempts: operation.max_attempts,
          disposition: operation.disposition,
          ...('next_retry_at' in operation && operation.next_retry_at ? { next_retry_at: operation.next_retry_at } : {}),
        },
      });
    }

    if (!remote) {
      const domains: ReconciliationDomainResult[] = [
        { domain: 'tickets', classification: 'missing_snapshot', reason: 'autotask_snapshot_not_found', local_present: Boolean(local), remote_present: false },
        { domain: 'ticket_notes', classification: 'missing_snapshot', reason: 'autotask_snapshot_not_found', local_present: Boolean(local?.domain_snapshots?.ticket_notes), remote_present: false },
        { domain: 'correlates.resources', classification: 'missing_snapshot', reason: 'autotask_snapshot_not_found', local_present: Boolean(local?.domain_snapshots?.['correlates.resources']), remote_present: false },
        { domain: 'correlates.ticket_metadata', classification: 'missing_snapshot', reason: 'autotask_snapshot_not_found', local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_metadata']), remote_present: false },
        { domain: 'correlates.ticket_note_metadata', classification: 'missing_snapshot', reason: 'autotask_snapshot_not_found', local_present: Boolean(local?.domain_snapshots?.['correlates.ticket_note_metadata']), remote_present: false },
      ];
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
        metadata: { issue_id: issue.id, domains },
      });
      return { matched: false, classification: 'missing_snapshot', domains, issue };
    }

    const localTicket = {
      status: String(local?.status || ''),
      assigned_to: String(local?.assigned_to || ''),
      queue_id: local?.queue_id,
      ticket_number: String((local?.domain_snapshots?.tickets?.ticket_number ?? local?.ticket_id ?? '') || ''),
    };
    const remoteTicket = {
      status: String((remote as any).status || ''),
      status_label: String((remote as any).status_label || ''),
      assigned_to: String((remote as any).assigned_to || ''),
      queue_id: Number((remote as any).queue_id),
      ticket_number: String((remote as any).ticket_number || ''),
    };
    const localLastComment = local?.comments && local.comments.length > 0 ? local.comments[local.comments.length - 1] : undefined;
    const localNoteFingerprint =
      String((local?.domain_snapshots?.ticket_notes?.latest_note_fingerprint as string) || '').trim() ||
      fingerprintText(localLastComment?.body || '');
    const remoteNoteFingerprint =
      String((remote as any)?.latest_note_fingerprint || '').trim() ||
      fingerprintText((remote as any)?.latest_note_text || '');

    const domains: ReconciliationDomainResult[] = [];
    const ticketMismatch =
      (!statusesMatch(localTicket.status, remoteTicket.status, remoteTicket.status_label)) ||
      (localTicket.assigned_to && remoteTicket.assigned_to && localTicket.assigned_to !== remoteTicket.assigned_to) ||
      (Number.isFinite(Number(localTicket.queue_id)) && Number.isFinite(remoteTicket.queue_id) && Number(localTicket.queue_id) !== remoteTicket.queue_id);
    domains.push({
      domain: 'tickets',
      classification: ticketMismatch ? 'mismatch' : 'match',
      ...(ticketMismatch ? { reason: 'ticket_core_fields_mismatch' } : {}),
      local_present: Boolean(local),
      remote_present: true,
      metadata: {
        local: localTicket,
        remote: remoteTicket,
      },
    });
    domains.push({
      domain: 'correlates.resources',
      classification:
        localTicket.assigned_to && remoteTicket.assigned_to && localTicket.assigned_to !== remoteTicket.assigned_to
          ? 'mismatch'
          : localTicket.assigned_to || remoteTicket.assigned_to
            ? 'match'
            : 'skipped',
      ...(localTicket.assigned_to && remoteTicket.assigned_to && localTicket.assigned_to !== remoteTicket.assigned_to
        ? { reason: 'assigned_resource_mismatch' }
        : {}),
      local_present: Boolean(localTicket.assigned_to),
      remote_present: Boolean(remoteTicket.assigned_to),
    });
    domains.push({
      domain: 'correlates.ticket_metadata',
      classification:
        (!statusesMatch(localTicket.status, remoteTicket.status, remoteTicket.status_label)) ||
          (localTicket.ticket_number && remoteTicket.ticket_number && localTicket.ticket_number !== remoteTicket.ticket_number)
          ? 'mismatch'
          : localTicket.status || localTicket.ticket_number || remoteTicket.status || remoteTicket.ticket_number
            ? 'match'
            : 'skipped',
      ...((!statusesMatch(localTicket.status, remoteTicket.status, remoteTicket.status_label)) ||
        (localTicket.ticket_number && remoteTicket.ticket_number && localTicket.ticket_number !== remoteTicket.ticket_number)
        ? { reason: 'ticket_metadata_mismatch' }
        : {}),
      local_present: Boolean(localTicket.status || localTicket.ticket_number),
      remote_present: Boolean(remoteTicket.status || remoteTicket.ticket_number),
    });
    domains.push({
      domain: 'ticket_notes',
      classification:
        localNoteFingerprint && remoteNoteFingerprint
          ? localNoteFingerprint === remoteNoteFingerprint ? 'match' : 'mismatch'
          : localNoteFingerprint
            ? 'missing_snapshot'
            : 'skipped',
      ...(localNoteFingerprint && remoteNoteFingerprint && localNoteFingerprint !== remoteNoteFingerprint
        ? { reason: 'latest_note_fingerprint_mismatch' }
        : {}),
      local_present: Boolean(localNoteFingerprint),
      remote_present: Boolean(remoteNoteFingerprint),
      metadata: {
        local_note_fingerprint: localNoteFingerprint || undefined,
        remote_note_fingerprint: remoteNoteFingerprint || undefined,
      },
    });
    domains.push({
      domain: 'correlates.ticket_note_metadata',
      classification:
        localNoteFingerprint && remoteNoteFingerprint
          ? localNoteFingerprint === remoteNoteFingerprint ? 'match' : 'mismatch'
          : 'skipped',
      ...(localNoteFingerprint && remoteNoteFingerprint && localNoteFingerprint !== remoteNoteFingerprint
        ? { reason: 'ticket_note_metadata_mismatch' }
        : {}),
      local_present: Boolean(localNoteFingerprint),
      remote_present: Boolean(remoteNoteFingerprint),
    });

    const classification = aggregateReconciliationClassification(domains);
    if (classification === 'mismatch') {
      const issue: ReconciliationIssue = {
        id: randomUUID(),
        tenant_id: tenantId,
        ticket_id: ticketId,
        detected_at: nowIso(),
        severity: 'warning',
        reason: 'autotask_snapshot_mismatch',
        local_snapshot: { status: localTicket.status, assigned_to: localTicket.assigned_to, domains },
        remote_snapshot: { status: remoteTicket.status, status_label: remoteTicket.status_label, assigned_to: remoteTicket.assigned_to, domains },
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
        metadata: { issue_id: issue.id, domains },
      });
      return { matched: false, classification, domains, issue };
    }

    if (classification === 'missing_snapshot') {
      const issue: ReconciliationIssue = {
        id: randomUUID(),
        tenant_id: tenantId,
        ticket_id: ticketId,
        detected_at: nowIso(),
        severity: 'warning',
        reason: 'autotask_snapshot_missing_domain',
        local_snapshot: { status: localTicket.status, assigned_to: localTicket.assigned_to, domains },
        remote_snapshot: { status: remoteTicket.status, status_label: remoteTicket.status_label, assigned_to: remoteTicket.assigned_to, domains },
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
        metadata: { issue_id: issue.id, domains },
      });
      return { matched: false, classification, domains, issue };
    }

    const action = classification === 'skipped' ? 'workflow.reconciliation.skipped' : 'workflow.reconciliation.match';
    await this.writeAudit({
      tenant_id: tenantId,
      actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
      action,
      target: auditTarget('Autotask', 'ticket', ticketId),
      result: 'success',
      correlation,
      metadata: { local_present: Boolean(local), remote_present: true, classification, domains },
    });
    return { matched: classification === 'match' || classification === 'skipped', classification, domains };
  }

  async getCommand(commandId: string): Promise<WorkflowCommandAttempt | null> {
    return this.repo.getCommandById(commandId);
  }

  async listInbox(tenantId: string): Promise<InboxTicketState[]> {
    const rows = await this.repo.listInboxTickets(tenantId);
    const hydratedRows = await this.hydrateMissingOrgRequester(rows);
    const grouped = new Map<string, InboxTicketState[]>();
    for (const row of hydratedRows) {
      const key =
        String(row.external_id || '').trim()
          ? `ext:${String(row.external_id).trim()}`
          : String(row.ticket_number || '').trim()
            ? `num:${String(row.ticket_number).trim()}`
            : isTicketNumberLike(row.ticket_id)
              ? `num:${row.ticket_id}`
              : `id:${row.ticket_id}`;
      const current = grouped.get(key) || [];
      current.push(row);
      grouped.set(key, current);
    }

    const deduped: InboxTicketState[] = [];
    for (const entries of grouped.values()) {
      const preferred = entries
        .slice()
        .sort((a, b) => {
          const aScore = (isTicketNumberLike(a.ticket_id) ? 10 : 0) + (a.ticket_number ? 5 : 0) + (a.external_id ? 2 : 0);
          const bScore = (isTicketNumberLike(b.ticket_id) ? 10 : 0) + (b.ticket_number ? 5 : 0) + (b.external_id ? 2 : 0);
          if (aScore !== bScore) return bScore - aScore;
          return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
        })[0];
      if (!preferred) continue;
      const merged = entries.reduce((acc, item) => ({
        ...acc,
        ...(acc.external_id ? {} : item.external_id ? { external_id: item.external_id } : {}),
        ...(acc.ticket_number ? {} : item.ticket_number ? { ticket_number: item.ticket_number } : {}),
        ...(acc.title ? {} : item.title ? { title: item.title } : {}),
        ...(acc.description ? {} : item.description ? { description: item.description } : {}),
        ...(acc.company ? {} : item.company ? { company: item.company } : {}),
        ...(acc.requester ? {} : item.requester ? { requester: item.requester } : {}),
      }), preferred);
      deduped.push(merged);

    }
    return deduped.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }

  private async hydrateMissingOrgRequester(rows: InboxTicketState[]): Promise<InboxTicketState[]> {
    if (!this.gateway.fetchTicketSnapshot || rows.length === 0) return rows;

    const candidates = rows
      .filter((row) => {
        const company = String(row.company || '').trim();
        const requester = String(row.requester || '').trim();
        return !company || !requester;
      })
      .slice(0, 25);
    if (candidates.length === 0) return rows;

    const updates = await Promise.allSettled(
      candidates.map(async (row) => {
        const ticketRef =
          selectFirstNonEmpty(row.ticket_number, row.external_id, row.ticket_id);
        if (!ticketRef) return null;
        const snapshot = await this.gateway.fetchTicketSnapshot?.(row.tenant_id, ticketRef);
        if (!snapshot) return null;

        const companyName = selectFirstNonEmpty(
          row.company,
          (snapshot as any).company_name,
          (snapshot as any).company,
        );
        const requesterName = selectFirstNonEmpty(
          row.requester,
          (snapshot as any).contact_name,
          (snapshot as any).requester,
        );
        if (!companyName && !requesterName) return null;

        const next: InboxTicketState = {
          ...row,
          ...(companyName ? { company: companyName } : {}),
          ...(requesterName ? { requester: requesterName } : {}),
          domain_snapshots: {
            ...(row.domain_snapshots || {}),
            tickets: {
              ...(row.domain_snapshots?.tickets || {}),
              ...(companyName ? { company_name: companyName } : {}),
              ...(requesterName ? { requester_name: requesterName } : {}),
            },
            'correlates.ticket_metadata': {
              ...(row.domain_snapshots?.['correlates.ticket_metadata'] || {}),
              ...(companyName ? { company_name: companyName } : {}),
              ...(requesterName ? { requester_name: requesterName } : {}),
            },
          },
          updated_at: nowIso(),
        };
        await this.repo.upsertInboxTicket(next);
        return next;
      })
    );

    if (updates.length === 0) return rows;
    const hydratedByTicketId = new Map<string, InboxTicketState>();
    for (const result of updates) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      hydratedByTicketId.set(result.value.ticket_id, result.value);
    }
    if (hydratedByTicketId.size === 0) return rows;

    return rows.map((row) => hydratedByTicketId.get(row.ticket_id) || row);
  }

  async removeInboxTicket(
    tenantId: string,
    ticketId: string,
    input: { reason: string; correlation?: WorkflowCorrelation; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await this.repo.deleteInboxTicket(tenantId, ticketId);
    await this.writeAudit({
      tenant_id: tenantId,
      actor: { kind: 'system', id: 'autotask-reconcile', origin: 'autotask_reconcile' },
      action: 'workflow.sync.ticket_removed',
      target: auditTarget('Autotask', 'ticket', ticketId),
      result: 'success',
      reason: input.reason,
      correlation: input.correlation || { trace_id: randomUUID(), ticket_id: ticketId },
      metadata: input.metadata || {},
    });
    this.publishRealtime({
      tenant_id: tenantId,
      ticket_id: ticketId,
      trace_id: input.correlation?.trace_id || randomUUID(),
      occurred_at: nowIso(),
      change_kind: 'sync',
    });
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
