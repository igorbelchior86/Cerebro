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

export type AutotaskPhase1CapabilityStatus =
  | 'implemented'
  | 'excluded_by_permission'
  | 'excluded_by_api_limitation';

export type AutotaskPhase1Domain =
  | 'tickets'
  | 'ticket_notes'
  | 'ticket_checklist_items'
  | 'time_entries'
  | 'contacts'
  | 'companies'
  | 'correlates.resources'
  | 'correlates.ticket_metadata'
  | 'correlates.ticket_note_metadata';

export type AutotaskPhase1RetryClass =
  | 'read_retryable'
  | 'write_retryable'
  | 'non_retryable_terminal';

export interface AutotaskPhase1OperationRequirement {
  idempotency: string;
  retry_class: AutotaskPhase1RetryClass;
  audit_events: string[];
  sync_reconcile_expectation: string;
}

export interface AutotaskPhase1CapabilityEntry {
  domain: AutotaskPhase1Domain;
  operation: string;
  status: AutotaskPhase1CapabilityStatus;
  requirement: AutotaskPhase1OperationRequirement;
  notes?: string;
}

export const AUTOTASK_PHASE1_FULL_API_CAPABILITY_MATRIX: ReadonlyArray<AutotaskPhase1CapabilityEntry> = [
  {
    domain: 'tickets',
    operation: 'get_by_id',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket'],
      sync_reconcile_expectation: 'hydrates canonical ticket snapshot',
    },
  },
  {
    domain: 'tickets',
    operation: 'get_by_ticket_number',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket'],
      sync_reconcile_expectation: 'must resolve entity id for all write commands',
    },
  },
  {
    domain: 'tickets',
    operation: 'query_search',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket_query'],
      sync_reconcile_expectation: 'supports polling and intake discovery',
    },
  },
  {
    domain: 'tickets',
    operation: 'create',
    status: 'implemented',
    requirement: {
      idempotency: 'idempotency_key_required_at_workflow_boundary',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'sync must ingest resulting created ticket state',
    },
  },
  {
    domain: 'tickets',
    operation: 'update_assign',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per logical assignment mutation',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'reconcile compares assigned_resource_id',
    },
  },
  {
    domain: 'tickets',
    operation: 'update_status',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per logical status mutation',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'reconcile compares status code/label equivalence',
    },
  },
  {
    domain: 'tickets',
    operation: 'update_priority',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'outside current reconcile target set',
    },
    notes: 'Out of Phase 1 safe-write scope',
  },
  {
    domain: 'tickets',
    operation: 'delete',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'hard_idempotency_token_required_if_enabled',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'no fail-open deletion allowed',
    },
    notes: 'Explicitly blocked in Phase 1',
  },
  {
    domain: 'ticket_notes',
    operation: 'list_by_ticket',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket_notes'],
      sync_reconcile_expectation: 'supports note fingerprint compare in reconcile',
    },
  },
  {
    domain: 'ticket_notes',
    operation: 'create_comment_note',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key per normalized note body + target ticket',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'updates last_note_fingerprint expectation',
    },
  },
  {
    domain: 'ticket_notes',
    operation: 'update',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'versioned_note_token_required_if_supported',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'no frozen update contract in current model',
    },
    notes: 'No stable in-repo endpoint/contract usage for note update',
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'list_by_ticket',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.checklist_items.skipped'],
      sync_reconcile_expectation: 'not represented in reconcile model',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'create',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'checklist_item_idempotency_key_required_if_supported',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'not represented in reconcile model',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'update',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'checklist_item_idempotency_key_required_if_supported',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'not represented in reconcile model',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'delete',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'hard_idempotency_token_required_if_supported',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'not represented in reconcile model',
    },
  },
  {
    domain: 'time_entries',
    operation: 'create',
    status: 'implemented',
    requirement: {
      idempotency: 'idempotency_key_required_at_workflow_boundary',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'must produce auditable link between command and external entry',
    },
  },
  {
    domain: 'time_entries',
    operation: 'update',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'not represented in current reconcile model',
    },
  },
  {
    domain: 'time_entries',
    operation: 'delete',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'hard_idempotency_token_required_if_enabled',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'not represented in current reconcile model',
    },
  },
  {
    domain: 'contacts',
    operation: 'get_by_id',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.contact'],
      sync_reconcile_expectation: 'read-only enrichment for requester resolution',
    },
  },
  {
    domain: 'contacts',
    operation: 'query_search',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.contact_query.skipped'],
      sync_reconcile_expectation: 'not required by current reconcile scope',
    },
  },
  {
    domain: 'contacts',
    operation: 'create',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'contact writes excluded in current phase',
    },
  },
  {
    domain: 'contacts',
    operation: 'update',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'contact writes excluded in current phase',
    },
  },
  {
    domain: 'companies',
    operation: 'get_by_id',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.company'],
      sync_reconcile_expectation: 'read-only enrichment for customer resolution',
    },
  },
  {
    domain: 'companies',
    operation: 'query_search',
    status: 'excluded_by_api_limitation',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.company_query.skipped'],
      sync_reconcile_expectation: 'not required by current reconcile scope',
    },
  },
  {
    domain: 'companies',
    operation: 'create',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'company writes excluded in current phase',
    },
  },
  {
    domain: 'companies',
    operation: 'update',
    status: 'excluded_by_permission',
    requirement: {
      idempotency: 'stable idempotency_key_required_if_enabled',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.policy_rejected'],
      sync_reconcile_expectation: 'company writes excluded in current phase',
    },
  },
  {
    domain: 'correlates.resources',
    operation: 'get_by_id',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.resource'],
      sync_reconcile_expectation: 'supports assignment/context joins',
    },
  },
  {
    domain: 'correlates.ticket_metadata',
    operation: 'list_queue_options',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket_metadata'],
      sync_reconcile_expectation: 'supports command payload normalization',
    },
  },
  {
    domain: 'correlates.ticket_metadata',
    operation: 'list_status_options',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket_metadata'],
      sync_reconcile_expectation: 'supports status normalization for reconcile',
    },
  },
  {
    domain: 'correlates.ticket_note_metadata',
    operation: 'list_note_type_options',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.ticket_note_metadata'],
      sync_reconcile_expectation: 'supports note payload normalization',
    },
  },
] as const;

export const AUTOTASK_PHASE1_EXCLUSION_NOTES = {
  excluded_by_permission:
    'Operation intentionally blocked by current Phase 1 safe-write policy to limit blast radius.',
  excluded_by_api_limitation:
    'Operation has no frozen endpoint/contract in this repository at this time.',
} as const;
