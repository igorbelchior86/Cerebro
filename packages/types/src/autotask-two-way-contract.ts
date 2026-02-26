export type AutotaskTwoWayCommandType = 'assign' | 'status_update' | 'comment_note';

export type CommandResultType = 'success' | 'retry_pending' | 'terminal_failure' | 'policy_rejected';

export interface AutotaskTwoWayCommandEnvelope {
  command_id: string;
  tenant_id: string;
  ticket_id: string;
  trace_id: string;
  command_type: AutotaskTwoWayCommandType;
  idempotency_key: string;
  payload: AssignCommandPayload | StatusUpdateCommandPayload | CommentNoteCommandPayload;
}

export interface AssignCommandPayload {
  assigned_resource_id: number;
  queue_id?: number;
}

export interface StatusUpdateCommandPayload {
  status: number | string;
}

export interface CommentNoteCommandPayload {
  body: string;
  note_type: number;
  publish: number;
  title?: string;
}

export interface RetryPolicyContract {
  strategy: 'exponential_backoff_with_jitter';
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
}

export interface EndpointMappingContract {
  command: AutotaskTwoWayCommandType;
  endpoint: string;
  method: 'PATCH' | 'POST';
  required_fields: string[];
  idempotency_strategy: string;
  retry_policy: RetryPolicyContract;
  error_classification: {
    retryable: string[];
    terminal: string[];
  };
}

export const AUTOTASK_PHASE1_RETRY_POLICY: RetryPolicyContract = {
  strategy: 'exponential_backoff_with_jitter',
  max_attempts: 5,
  initial_delay_ms: 1000,
  max_delay_ms: 60000,
};

export const AUTOTASK_PHASE1_ENDPOINT_MAP: EndpointMappingContract[] = [
  {
    command: 'assign',
    endpoint: '/tickets',
    method: 'PATCH',
    required_fields: ['id', 'assignedResourceID'],
    idempotency_strategy: 'stable idempotency_key per logical assignment mutation and payload hash guard',
    retry_policy: AUTOTASK_PHASE1_RETRY_POLICY,
    error_classification: {
      retryable: ['429', '5xx', 'network_timeout', 'connection_reset'],
      terminal: ['400_validation', '401_auth', '403_forbidden', '404_not_found'],
    },
  },
  {
    command: 'status_update',
    endpoint: '/tickets',
    method: 'PATCH',
    required_fields: ['id', 'status'],
    idempotency_strategy: 'stable idempotency_key per logical status transition and payload hash guard',
    retry_policy: AUTOTASK_PHASE1_RETRY_POLICY,
    error_classification: {
      retryable: ['429', '5xx', 'network_timeout', 'connection_reset'],
      terminal: ['400_validation', '401_auth', '403_forbidden', '404_not_found'],
    },
  },
  {
    command: 'comment_note',
    endpoint: '/tickets/{id}/notes',
    method: 'POST',
    required_fields: ['title', 'description', 'noteType', 'publish'],
    idempotency_strategy: 'stable idempotency_key per normalized note body and target ticket',
    retry_policy: AUTOTASK_PHASE1_RETRY_POLICY,
    error_classification: {
      retryable: ['429', '5xx', 'network_timeout', 'connection_reset'],
      terminal: ['400_validation', '401_auth', '403_forbidden', '404_not_found'],
    },
  },
];

export interface AutotaskReconciliationModel {
  compared_fields: string[];
  mismatch_classes: Array<'missing_in_autotask' | 'missing_in_cerebro' | 'value_mismatch' | 'stale_sync' | 'duplicate_command_effect'>;
  remediation_actions: string[];
}

export const AUTOTASK_PHASE1_RECONCILIATION_MODEL: AutotaskReconciliationModel = {
  compared_fields: ['assigned_resource_id', 'status', 'last_note_fingerprint', 'updated_at'],
  mismatch_classes: [
    'missing_in_autotask',
    'missing_in_cerebro',
    'value_mismatch',
    'stale_sync',
    'duplicate_command_effect',
  ],
  remediation_actions: [
    'retry_sync_then_reconcile',
    'enqueue_compensating_command_if_policy_allows',
    'open_manual_review_hitl',
    'raise_operational_alert_with_trace_links',
  ],
};

export interface AutotaskAuditWriteRecord {
  tenant_id: string;
  ticket_id: string;
  command_id: string;
  trace_id: string;
  result: CommandResultType;
  reason: string;
}

export const AUTOTASK_PHASE1_SAFE_WRITE_SCOPE = {
  allowed_commands: ['assign', 'status_update', 'comment_note'],
  blocked_commands: ['create', 'delete', 'time_entry', 'queue_reparent', 'priority_change', 'contact_change'],
  policy: 'Autotask is the only two-way integration in Phase 1; all others remain read_only',
} as const;
