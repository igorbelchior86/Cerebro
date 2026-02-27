import type {
  ManagerQueueSnapshotItem,
  ManagerVisibilitySnapshot,
  P0AuditRecord,
  RecommendedAction,
} from '@playbook-brain/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export interface AutotaskTicketContextUpdateResult {
  ticketId: string;
  companyId: number | null;
  companyName: string | null;
  contactId: number | null;
  contactName: string | null;
  contactEmail: string | null;
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
  | 'assign'
  | 'update_assign'
  | 'status'
  | 'status_update'
  | 'update_status'
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
  ticket_id: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export function listWorkflowInbox() {
  return request<WorkflowInboxTicket[]>('/workflow/inbox');
}

export function searchAutotaskCompanies(query: string, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<AutotaskCompanyOption[]>(`/autotask/companies/search?${search.toString()}`);
}

export function searchAutotaskContacts(query: string, companyId: number, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    companyId: String(companyId),
    limit: String(limit),
  });
  return request<AutotaskContactOption[]>(`/autotask/contacts/search?${search.toString()}`);
}

export function searchAutotaskResources(query: string, limit = 25) {
  const search = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<AutotaskResourceOption[]>(`/autotask/resources/search?${search.toString()}`);
}

export function updateAutotaskTicketContext(
  ticketId: string,
  input: { companyId?: number; contactId?: number }
) {
  return request<AutotaskTicketContextUpdateResult>(`/autotask/ticket/${encodeURIComponent(ticketId)}/context`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(typeof input.companyId === 'number' ? { companyId: input.companyId } : {}),
      ...(typeof input.contactId === 'number' ? { contactId: input.contactId } : {}),
    }),
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
          ticket_id: input.ticket_id,
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
