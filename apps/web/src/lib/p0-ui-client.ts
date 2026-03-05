import type {
  ManagerQueueSnapshotItem,
  ManagerVisibilitySnapshot,
  P0AuditRecord,
  RecommendedAction,
} from '@cerebro/types';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type RequestCacheOptions = {
  cacheKey?: string;
  staleTimeMs?: number;
  staleWhileRevalidateMs?: number;
  bypassCache?: boolean;
};

type CachedResponseEntry = {
  value: unknown;
  freshUntil: number;
  staleUntil: number;
};

type IntegrationCredentialEntry = {
  configured?: boolean;
  enabled?: boolean;
  active?: boolean;
};

const readResponseCache = new Map<string, CachedResponseEntry>();
const readResponseInFlight = new Map<string, Promise<unknown>>();
const READ_CACHE_STORAGE_KEY = 'cerebro.read-cache.v1';
const MAX_PERSISTED_ENTRIES = 12;
const MAX_PERSISTED_ENTRY_BYTES = 900_000;
let readCacheHydrated = false;
const integrationCapabilitiesCache = new Map<string, boolean>();
let integrationCapabilitiesLoadedAt = 0;
let integrationCapabilitiesInFlight: Promise<void> | null = null;
const INTEGRATION_CAPABILITIES_TTL_MS = 30_000;
const KNOWN_INTEGRATION_SERVICES = new Set([
  'autotask',
  'connectwise',
  'halo',
  'itglue',
  'kaseya',
  'ninjaone',
  'syncro',
]);

function shouldPersistReadCacheKey(key: string): boolean {
  return key.includes('GET:/workflow/inbox')
    || key.includes('GET:/autotask/queues')
    || key.includes('GET:/autotask/ticket-field-options');
}

function persistReadCacheToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const items = Array.from(readResponseCache.entries())
      .filter(([key, entry]) => shouldPersistReadCacheKey(key) && entry.staleUntil > now)
      .sort((a, b) => b[1].staleUntil - a[1].staleUntil)
      .slice(0, MAX_PERSISTED_ENTRIES)
      .map(([key, entry]) => ({ key, ...entry }));
    window.localStorage.setItem(READ_CACHE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort persistence only.
  }
}

function hydrateReadCacheFromStorage() {
  if (readCacheHydrated) return;
  readCacheHydrated = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(READ_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<{
      key: string;
      value: unknown;
      freshUntil: number;
      staleUntil: number;
    }>;
    const now = Date.now();
    for (const item of Array.isArray(parsed) ? parsed : []) {
      if (!item || typeof item.key !== 'string') continue;
      if (!Number.isFinite(item.freshUntil) || !Number.isFinite(item.staleUntil)) continue;
      if (item.staleUntil <= now) continue;
      const serialized = JSON.stringify(item.value);
      if (serialized.length > MAX_PERSISTED_ENTRY_BYTES) continue;
      readResponseCache.set(item.key, {
        value: item.value,
        freshUntil: item.freshUntil,
        staleUntil: item.staleUntil,
      });
    }
  } catch {
    // Ignore corrupt local cache.
  }
}

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  count?: number;
  error?: string;
  timestamp?: string;
}

export interface WorkflowInboxTicket {
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
  domain_snapshots?: Partial<Record<string, Record<string, unknown>>>;
  assigned_to?: string;
  queue_id?: number;
  queue_name?: string;
  comments: Array<{ visibility: 'internal' | 'public'; body: string; created_at: string }>;
  last_sync_at?: string;
  last_event_occurred_at?: string;
  last_event_id?: string;
  last_command_id?: string;
  trace_id?: string;
  intake_received_at?: string;
  first_seen_at?: string;
  priority_score?: number;
  priority_sla_risk?: number;
  block_consistency?: {
    core_state: 'resolving' | 'ready' | 'degraded';
    network_env_body_state: 'resolving' | 'ready' | 'degraded';
    hypothesis_checklist_state: 'resolving' | 'ready' | 'degraded';
  };
  pipeline_status?: 'queued' | 'processing' | 'retry_scheduled' | 'degraded' | 'dlq' | 'ready';
  pipeline_reason_code?: string;
  processing_lag_ms?: number;
  next_retry_at?: string;
  retry_count?: number;
  dlq_id?: string;
  last_background_processed_at?: string;
  consistent_at?: string;
  source_of_truth: 'Autotask';
  updated_at: string;
}

export interface WorkflowTicketSnapshotV1 {
  schema_version: 'v1';
  tenant_id: string;
  ticket_id: string;
  snapshot: Record<string, unknown>;
  block_consistency: {
    core_state: 'resolving' | 'ready' | 'degraded';
    network_env_body_state: 'resolving' | 'ready' | 'degraded';
    hypothesis_checklist_state: 'resolving' | 'ready' | 'degraded';
  };
  pipeline_status: 'queued' | 'processing' | 'retry_scheduled' | 'degraded' | 'dlq' | 'ready';
  pipeline_reason_code?: string;
  processing_lag_ms?: number;
  next_retry_at?: string;
  retry_count?: number;
  dlq_id?: string;
  last_background_processed_at?: string;
  consistent_at?: string;
  trace_id?: string;
}

export interface WorkflowTicketCommandV1 {
  command_id: string;
  state: 'accepted' | 'pending' | 'completed' | 'failed' | 'dlq';
  execution_status: 'accepted' | 'processing' | 'completed' | 'retry_pending' | 'failed' | 'dlq' | 'rejected';
  command_type: string;
  requested_at: string;
  updated_at: string;
  attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  last_error?: string;
  trace_id: string;
  idempotency_key: string;
}

export interface WorkflowAuditRecord {
  audit_id: string;
  tenant_id: string;
  actor: { kind: 'user' | 'system' | 'ai'; id: string; origin?: string };
  action: string;
  target: { integration: string; entity_type: string; entity_id?: string };
  result: 'success' | 'failure' | 'rejected';
  reason?: string;
  timestamp: string;
  correlation: { trace_id: string; ticket_id?: string; job_id?: string; command_id?: string };
  metadata: Record<string, unknown>;
}

export interface WorkflowReconciliationIssue {
  id: string;
  tenant_id: string;
  ticket_id: string;
  detected_at: string;
  severity: 'info' | 'warning' | 'error';
  reason: string;
  local_snapshot: Record<string, unknown>;
  remote_snapshot: Record<string, unknown>;
  correlation: { trace_id: string; ticket_id?: string; job_id?: string; command_id?: string };
  provenance: { source: string; fetched_at?: string; adapter_version?: string; sync_cursor?: string };
}

export interface RolloutPolicyView {
  tenant_id: string;
  frozen: boolean;
  launch_policy: Record<string, unknown>;
}

export interface RolloutFlagsView {
  supported_flags: string[];
  posture: Record<string, unknown>;
}

export interface ManagerOpsAIDecision {
  decision_id: string;
  tenant_id: string;
  ticket_id: string;
  decision_type: string;
  suggestion: {
    summary: string;
    suggested_only?: boolean;
    suggestion_only?: boolean;
    top_hypothesis?: string;
    recommended_actions?: RecommendedAction[];
    do_not_do?: string[];
    handoff_notes?: string[];
  };
  confidence: number;
  rationale: string;
  signals_used: Array<{ source: string; ref: string }> | string[];
  provenance_refs?: Array<{ source: string; fetched_at: string }>;
  hitl_status: 'not_required' | 'pending' | 'approved' | 'rejected';
  prompt_version: string;
  model_version: string;
  timestamp: string;
  correlation: { trace_id?: string; ticket_id?: string };
  policy_gate: { outcome: 'pass' | 'hitl_required'; reasons: string[] };
}

export interface AutotaskCompanyOption {
  id: number;
  name: string;
}

export interface AutotaskContactOption {
  id: number;
  name: string;
  companyId?: number;
  email?: string;
}

export interface AutotaskResourceOption {
  id: number;
  name: string;
  email?: string;
}

export interface AutotaskPicklistOption {
  id: number;
  label: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface AutotaskTicketFieldOptions {
  queue: AutotaskPicklistOption[];
  priority: AutotaskPicklistOption[];
  status: AutotaskPicklistOption[];
  issueType: AutotaskPicklistOption[];
  subIssueType: AutotaskPicklistOption[];
  serviceLevelAgreement: AutotaskPicklistOption[];
}

export type AutotaskTicketFieldKey = keyof AutotaskTicketFieldOptions;

export interface AutotaskTicketDraftDefaults {
  ticketCategoryId: number | null;
  queue: AutotaskPicklistOption | null;
  priority: AutotaskPicklistOption | null;
  status: AutotaskPicklistOption | null;
  issueType: AutotaskPicklistOption | null;
  subIssueType: AutotaskPicklistOption | null;
  serviceLevelAgreement: AutotaskPicklistOption | null;
}

export interface AutotaskTicketContextUpdateResult {
  ticketId: string;
  companyId: number | null;
  companyName: string | null;
  contactId: number | null;
  contactName: string | null;
  contactEmail: string | null;
  priorityId?: number | null;
  priorityLabel?: string | null;
  issueTypeId?: number | null;
  issueTypeLabel?: string | null;
  subIssueTypeId?: number | null;
  subIssueTypeLabel?: string | null;
  serviceLevelAgreementId?: number | null;
  serviceLevelAgreementLabel?: string | null;
}

export interface TicketAttachmentUploadInput {
  fileName: string;
  contentType: string;
  dataBase64: string;
  title?: string;
}

export interface TicketAttachmentUploadResult {
  ticketId: string;
  uploadedCount: number;
  failedCount: number;
  results: Array<{
    fileName: string;
    uploaded: boolean;
    attachmentId?: string;
    error?: string;
  }>;
}

export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export type WorkflowCommandTypeUi =
  | 'create'
  | 'ticket_create'
  | 'assign'
  | 'update_assign'
  | 'status'
  | 'status_update'
  | 'update_status'
  | 'time_entry'
  | 'comment_note'
  | 'create_comment_note';

export interface WorkflowCommandSubmission {
  command_id: string;
  tenant_id: string;
  target_integration: string;
  command_type: string;
  payload: Record<string, unknown>;
  actor: { kind: string; id: string; origin?: string };
  idempotency_key: string;
  audit_metadata: Record<string, unknown>;
  correlation: { trace_id: string; ticket_id?: string; job_id?: string; command_id?: string };
  requested_at: string;
}

export interface WorkflowCommandStatus {
  command: WorkflowCommandSubmission;
  status: 'accepted' | 'processing' | 'completed' | 'retry_pending' | 'failed' | 'dlq' | 'rejected';
  attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  last_error?: string;
  result?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCommandSubmitInput {
  command_type: WorkflowCommandTypeUi;
  ticket_id?: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  auto_process?: boolean;
}

export type WorkflowActionUxState = 'pending' | 'retrying' | 'failed' | 'succeeded';

export function mapCommandStatusToUxState(status?: string): WorkflowActionUxState {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed') return 'succeeded';
  if (normalized === 'retry_pending') return 'retrying';
  if (normalized === 'failed' || normalized === 'dlq' || normalized === 'rejected') return 'failed';
  return 'pending';
}

export function isRetryableCommandStatus(status?: string): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'retry_pending' || normalized === 'failed';
}

export interface FrontendErrorState {
  status: number | null;
  code: 'auth' | 'forbidden' | 'rate_limit' | 'server' | 'network' | 'unknown';
  retryable: boolean;
  summary: string;
  detail: string;
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  const direct = obj.message ?? obj.error;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return null;
}

export function mapHttpErrorToFrontendState(error: unknown, fallbackSummary = 'Request failed'): FrontendErrorState {
  if (error instanceof HttpError) {
    const detail = extractErrorMessage(error.body) || error.message || fallbackSummary;
    if (error.status === 401) {
      return {
        status: 401,
        code: 'auth',
        retryable: false,
        summary: 'Authentication required',
        detail,
      };
    }
    if (error.status === 403) {
      return {
        status: 403,
        code: 'forbidden',
        retryable: false,
        summary: 'Operation not allowed by policy',
        detail,
      };
    }
    if (error.status === 429) {
      return {
        status: 429,
        code: 'rate_limit',
        retryable: true,
        summary: 'Rate limit reached',
        detail,
      };
    }
    if (error.status >= 500) {
      return {
        status: error.status,
        code: 'server',
        retryable: true,
        summary: 'Temporary backend failure',
        detail,
      };
    }
    return {
      status: error.status,
      code: 'unknown',
      retryable: false,
      summary: fallbackSummary,
      detail,
    };
  }

  if (error instanceof Error) {
    return {
      status: null,
      code: 'network',
      retryable: true,
      summary: 'Network or client error',
      detail: error.message || fallbackSummary,
    };
  }

  return {
    status: null,
    code: 'unknown',
    retryable: false,
    summary: fallbackSummary,
    detail: fallbackSummary,
  };
}

async function executeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> | Record<string, unknown>;

  if (!response.ok) {
    const message = typeof (body as { error?: unknown }).error === 'string'
      ? String((body as { error?: string }).error)
      : `HTTP ${response.status}`;
    throw new HttpError(response.status, message, body);
  }

  if ('data' in (body as Record<string, unknown>)) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

function parseServiceFromPath(path: string): string | null {
  if (!path.startsWith('/')) return null;
  const segment = path.slice(1).split('/')[0]?.trim().toLowerCase();
  if (!segment) return null;
  if (segment === 'workflow' || segment === 'manager-ops' || segment === 'integrations') return null;
  return segment;
}

function resolveIntegrationEntryActive(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const row = value as IntegrationCredentialEntry;
  if (typeof row.configured === 'boolean') return row.configured;
  if (typeof row.enabled === 'boolean') return row.enabled;
  if (typeof row.active === 'boolean') return row.active;
  return false;
}

async function ensureIntegrationCapabilities(forceRefresh = false): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const fresh = integrationCapabilitiesLoadedAt > 0 && (now - integrationCapabilitiesLoadedAt) < INTEGRATION_CAPABILITIES_TTL_MS;
  if (!forceRefresh && fresh) return;
  if (integrationCapabilitiesInFlight) return integrationCapabilitiesInFlight;

  integrationCapabilitiesInFlight = (async () => {
    try {
      const payload = await executeRequest<Record<string, unknown>>('/integrations/credentials');
      integrationCapabilitiesCache.clear();
      for (const [service, entry] of Object.entries(payload || {})) {
        integrationCapabilitiesCache.set(service.toLowerCase(), resolveIntegrationEntryActive(entry));
      }
      integrationCapabilitiesLoadedAt = Date.now();
    } catch {
      // Keep previous snapshot; if none exists, integration checks are treated as unknown.
      if (integrationCapabilitiesLoadedAt === 0) integrationCapabilitiesLoadedAt = Date.now();
    } finally {
      integrationCapabilitiesInFlight = null;
    }
  })();

  return integrationCapabilitiesInFlight;
}

async function ensureServiceActiveForPath(path: string): Promise<void> {
  const service = parseServiceFromPath(path);
  if (!service || typeof window === 'undefined') return;
  await ensureIntegrationCapabilities(false);
  const known = KNOWN_INTEGRATION_SERVICES.has(service) || integrationCapabilitiesCache.has(service);
  if (!known) return;
  const active = integrationCapabilitiesCache.get(service) === true;
  if (!active) {
    throw new HttpError(503, `${service} connector is not active for this tenant`, {
      error: `${service} connector is not active for this tenant`,
      service,
      code: 'connector_inactive',
    });
  }
}

function buildReadCacheKey(path: string, init?: RequestInit, explicitKey?: string): string {
  if (explicitKey) return explicitKey;
  const method = String(init?.method || 'GET').toUpperCase();
  return `${method}:${path}`;
}

async function request<T>(path: string, init?: RequestInit, cacheOptions?: RequestCacheOptions): Promise<T> {
  await ensureServiceActiveForPath(path);
  hydrateReadCacheFromStorage();
  const method = String(init?.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const staleTimeMs = Math.max(0, Number(cacheOptions?.staleTimeMs || 0));
  const staleWhileRevalidateMs = Math.max(0, Number(cacheOptions?.staleWhileRevalidateMs || 0));
  const useReadCache = isGet && !cacheOptions?.bypassCache;
  if (!useReadCache) {
    return executeRequest<T>(path, init);
  }

  const cacheKey = buildReadCacheKey(path, init, cacheOptions?.cacheKey);
  const now = Date.now();
  const cached = readResponseCache.get(cacheKey);
  if (cached) {
    if (cached.freshUntil > now) {
      return cached.value as T;
    }
    if (cached.staleUntil > now) {
      if (!readResponseInFlight.has(cacheKey)) {
        const background = executeRequest<T>(path, init)
          .then((nextValue) => {
            if (staleTimeMs > 0 || staleWhileRevalidateMs > 0) {
              const ts = Date.now();
              readResponseCache.set(cacheKey, {
                value: nextValue,
                freshUntil: ts + staleTimeMs,
                staleUntil: ts + staleTimeMs + staleWhileRevalidateMs,
              });
              persistReadCacheToStorage();
            } else {
              readResponseCache.delete(cacheKey);
              persistReadCacheToStorage();
            }
            return nextValue;
          })
          .catch(() => cached.value as T)
          .finally(() => {
            readResponseInFlight.delete(cacheKey);
          });
        readResponseInFlight.set(cacheKey, background as Promise<unknown>);
      }
      return cached.value as T;
    }
    readResponseCache.delete(cacheKey);
    persistReadCacheToStorage();
  }

  const inFlight = readResponseInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const pending = executeRequest<T>(path, init)
    .then((value) => {
      if (staleTimeMs > 0 || staleWhileRevalidateMs > 0) {
        const ts = Date.now();
        readResponseCache.set(cacheKey, {
          value,
          freshUntil: ts + staleTimeMs,
          staleUntil: ts + staleTimeMs + staleWhileRevalidateMs,
        });
        persistReadCacheToStorage();
      } else {
        readResponseCache.delete(cacheKey);
        persistReadCacheToStorage();
      }
      return value;
    })
    .finally(() => {
      readResponseInFlight.delete(cacheKey);
    });

  readResponseInFlight.set(cacheKey, pending as Promise<unknown>);
  return pending;
}

export function listWorkflowInbox() {
  return request<WorkflowInboxTicket[]>('/workflow/inbox', undefined, {
    staleTimeMs: 12_000,
    staleWhileRevalidateMs: 2 * 60_000,
  });
}

export function getWorkflowTicketSnapshot(ticketId: string) {
  return request<WorkflowTicketSnapshotV1>(`/workflow/tickets/${encodeURIComponent(ticketId)}`, undefined, {
    staleTimeMs: 6_000,
    staleWhileRevalidateMs: 30_000,
  });
}

export function listWorkflowTicketCommands(ticketId: string) {
  return request<WorkflowTicketCommandV1[]>(`/workflow/tickets/${encodeURIComponent(ticketId)}/commands`, undefined, {
    staleTimeMs: 4_000,
    staleWhileRevalidateMs: 20_000,
  });
}

export function listConnectorCredentials() {
  return request<Record<string, unknown>>('/integrations/credentials', undefined, {
    staleTimeMs: 15_000,
    staleWhileRevalidateMs: 45_000,
  });
}

export function listAutotaskQueues() {
  return request<AutotaskPicklistOption[]>('/autotask/queues', undefined, {
    staleTimeMs: 10 * 60_000,
    staleWhileRevalidateMs: 6 * 60 * 60_000,
  });
}

export function searchAutotaskCompanies(query: string, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<AutotaskCompanyOption[]>(`/autotask/companies/search?${search.toString()}`, undefined, {
    staleTimeMs: 60_000,
    staleWhileRevalidateMs: 9 * 60_000,
  });
}

export function searchAutotaskContacts(query: string, companyId: number, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    companyId: String(companyId),
    limit: String(limit),
  });
  return request<AutotaskContactOption[]>(`/autotask/contacts/search?${search.toString()}`, undefined, {
    staleTimeMs: 60_000,
    staleWhileRevalidateMs: 9 * 60_000,
  });
}

export function searchAutotaskResources(query: string, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<AutotaskResourceOption[]>(`/autotask/resources/search?${search.toString()}`, undefined, {
    staleTimeMs: 60_000,
    staleWhileRevalidateMs: 9 * 60_000,
  });
}

export function listAutotaskTicketFieldOptions() {
  return request<AutotaskTicketFieldOptions>('/autotask/ticket-field-options', undefined, {
    staleTimeMs: 10 * 60_000,
    staleWhileRevalidateMs: 6 * 60 * 60_000,
  });
}

export function listAutotaskTicketFieldOptionsByField(field: AutotaskTicketFieldKey) {
  const search = new URLSearchParams({ field });
  return request<AutotaskPicklistOption[]>(`/autotask/ticket-field-options?${search.toString()}`, undefined, {
    staleTimeMs: 10 * 60_000,
    staleWhileRevalidateMs: 6 * 60 * 60_000,
  });
}

export function getAutotaskTicketDraftDefaults() {
  return request<AutotaskTicketDraftDefaults>('/autotask/ticket-draft-defaults', undefined, {
    staleTimeMs: 10 * 60_000,
    staleWhileRevalidateMs: 2 * 60 * 60_000,
  });
}

export function updateAutotaskTicketContext(
  ticketId: string,
  input: {
    companyId?: number;
    contactId?: number;
    priorityId?: number;
    issueTypeId?: number;
    subIssueTypeId?: number;
    serviceLevelAgreementId?: number;
  }
) {
  return request<AutotaskTicketContextUpdateResult>(`/autotask/ticket/${encodeURIComponent(ticketId)}/context`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(typeof input.companyId === 'number' ? { companyId: input.companyId } : {}),
      ...(typeof input.contactId === 'number' ? { contactId: input.contactId } : {}),
      ...(typeof input.priorityId === 'number' ? { priorityId: input.priorityId } : {}),
      ...(typeof input.issueTypeId === 'number' ? { issueTypeId: input.issueTypeId } : {}),
      ...(typeof input.subIssueTypeId === 'number' ? { subIssueTypeId: input.subIssueTypeId } : {}),
      ...(typeof input.serviceLevelAgreementId === 'number' ? { serviceLevelAgreementId: input.serviceLevelAgreementId } : {}),
    }),
  });
}

export function uploadAutotaskTicketAttachments(ticketId: string, files: TicketAttachmentUploadInput[]) {
  return request<TicketAttachmentUploadResult>(`/autotask/ticket/${encodeURIComponent(ticketId)}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}

export function listWorkflowAudit(ticketId: string) {
  return request<WorkflowAuditRecord[]>(`/workflow/audit/${encodeURIComponent(ticketId)}`);
}

export function listWorkflowReconciliationIssues(ticketId?: string) {
  const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : '';
  return request<WorkflowReconciliationIssue[]>(`/workflow/reconciliation-issues${query}`);
}

export function processWorkflowCommands(limit = 20) {
  return request<Record<string, unknown>>('/workflow/commands/process', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export function submitWorkflowCommand(input: WorkflowCommandSubmitInput) {
  return request<{ command_id: string; status: string }>(
    '/workflow/commands',
    {
      method: 'POST',
      body: JSON.stringify({
        command_type: input.command_type,
        target_integration: 'Autotask',
        idempotency_key: input.idempotency_key,
        payload: {
          ...input.payload,
          ...(input.ticket_id ? { ticket_id: input.ticket_id } : {}),
        },
        auto_process: input.auto_process ?? true,
      }),
    }
  );
}

export function getWorkflowCommandStatus(commandId: string) {
  return request<WorkflowCommandStatus>(`/workflow/commands/${encodeURIComponent(commandId)}`);
}

export function reconcileWorkflowTicket(ticketId: string) {
  return request<Record<string, unknown>>(`/workflow/reconcile/${encodeURIComponent(ticketId)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listManagerOpsAiDecisions(limit = 100) {
  return request<ManagerOpsAIDecision[]>(`/manager-ops/p0/ai-decisions?limit=${limit}`);
}

export function listManagerOpsAudit(limit = 200) {
  return request<P0AuditRecord[]>(`/manager-ops/p0/audit?limit=${limit}`);
}

export function buildManagerVisibilitySnapshot(queueItems: ManagerQueueSnapshotItem[], sampleSize = 10) {
  return request<ManagerVisibilitySnapshot>('/manager-ops/p0/visibility', {
    method: 'POST',
    body: JSON.stringify({ queue_items: queueItems, sample_size: sampleSize }),
  });
}

export function getRolloutPolicy() {
  return request<RolloutPolicyView>('/manager-ops/p0/rollout/policy');
}

export function getRolloutFlags() {
  return request<RolloutFlagsView>('/manager-ops/p0/rollout/flags');
}

export function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function relativeMinutesFromNow(value?: string | null): number | undefined {
  const d = safeDate(value);
  if (!d) return undefined;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

export function mapInboxToQueueSnapshot(items: WorkflowInboxTicket[]): ManagerQueueSnapshotItem[] {
  return items.map((item) => {
    const age = relativeMinutesFromNow(item.updated_at || item.last_event_occurred_at || item.last_sync_at);
    let sla_status: ManagerQueueSnapshotItem['sla_status'] = 'unknown';
    if (typeof age === 'number') {
      if (age >= 120) sla_status = 'breached';
      else if (age >= 45) sla_status = 'at_risk';
      else sla_status = 'healthy';
    }

    return {
      ticket_id: item.ticket_id,
      queue: item.queue_name || 'Unassigned',
      sla_status,
      ...(typeof age === 'number' ? { age_minutes: age } : {}),
    };
  });
}
