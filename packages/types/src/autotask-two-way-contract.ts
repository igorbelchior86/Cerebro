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
  allowed_commands: [
    'create',
    'assign',
    'status_update',
    'comment_note',
    'update_priority',
    'delete',
    'update_note',
    'checklist_create',
    'checklist_update',
    'checklist_delete',
    'time_entry',
    'time_entry_update',
    'time_entry_delete',
    'contact_create',
    'contact_update',
    'company_create',
    'company_update',
  ],
  blocked_commands: ['queue_reparent'],
  policy: 'Autotask remains the only two-way integration in Phase 1; all others remain read_only',
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
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per logical priority mutation',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'priority mutation must be auditable and replay-safe',
    },
  },
  {
    domain: 'tickets',
    operation: 'delete',
    status: 'implemented',
    requirement: {
      idempotency: 'hard_idempotency_token_required',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'deletion requires explicit approval token and terminal audit outcome',
    },
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
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + note_id + payload hash guard',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'updated note content must stay reconcile-auditable',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'list_by_ticket',
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.checklist_items'],
      sync_reconcile_expectation: 'checklist snapshot can be queried for context/reconcile extensions',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'create',
    status: 'implemented',
    requirement: {
      idempotency: 'checklist_item_idempotency_key_required',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'checklist create must be auditable and replay-safe',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'update',
    status: 'implemented',
    requirement: {
      idempotency: 'checklist_item_idempotency_key_required',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'checklist update must be auditable and replay-safe',
    },
  },
  {
    domain: 'ticket_checklist_items',
    operation: 'delete',
    status: 'implemented',
    requirement: {
      idempotency: 'hard_idempotency_token_required',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'checklist delete requires explicit approval token and audit trail',
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
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per time-entry update',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'time-entry update must be auditable and replay-safe',
    },
  },
  {
    domain: 'time_entries',
    operation: 'delete',
    status: 'implemented',
    requirement: {
      idempotency: 'hard_idempotency_token_required',
      retry_class: 'non_retryable_terminal',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'time-entry delete requires explicit approval token and audit trail',
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
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.contact_query'],
      sync_reconcile_expectation: 'query supports contact search workflows',
    },
  },
  {
    domain: 'contacts',
    operation: 'create',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per contact create',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'contact creation must be auditable and replay-safe',
    },
  },
  {
    domain: 'contacts',
    operation: 'update',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per contact update',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'contact update must be auditable and replay-safe',
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
    status: 'implemented',
    requirement: {
      idempotency: 'not_applicable_read',
      retry_class: 'read_retryable',
      audit_events: ['autotask.read.company_query'],
      sync_reconcile_expectation: 'query supports company search workflows',
    },
  },
  {
    domain: 'companies',
    operation: 'create',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per company create',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'company creation must be auditable and replay-safe',
    },
  },
  {
    domain: 'companies',
    operation: 'update',
    status: 'implemented',
    requirement: {
      idempotency: 'stable idempotency_key + payload hash guard per company update',
      retry_class: 'write_retryable',
      audit_events: ['autotask.command.submitted', 'autotask.command.result'],
      sync_reconcile_expectation: 'company update must be auditable and replay-safe',
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

export type AutotaskPhase1ExpansionActionKind = 'command' | 'query';

export interface AutotaskPhase1SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  aliases?: string[];
}

export interface AutotaskPhase1EndpointSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
}

export interface AutotaskPhase1ImplementationContract {
  key: string;
  domain: AutotaskPhase1Domain;
  operation: string;
  source_status: Extract<AutotaskPhase1CapabilityStatus, 'excluded_by_permission' | 'excluded_by_api_limitation'>;
  action_kind: AutotaskPhase1ExpansionActionKind;
  endpoints: ReadonlyArray<AutotaskPhase1EndpointSpec>;
  payload_schema: ReadonlyArray<AutotaskPhase1SchemaField>;
  validation_rules: ReadonlyArray<string>;
  target_modules: ReadonlyArray<string>;
  test_required: string;
}

export const AUTOTASK_PHASE1_EXCLUSION_IMPLEMENTATION_CONTRACTS: ReadonlyArray<AutotaskPhase1ImplementationContract> = [
  {
    key: 'tickets:update_priority',
    domain: 'tickets',
    operation: 'update_priority',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/tickets' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'priority', type: 'number', required: true, aliases: ['priorityID'] },
    ],
    validation_rules: ['ticket_id must resolve to numeric Autotask entity id', 'priority must be a valid ticket picklist option'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'workflow priority command schema + payload mapping test',
  },
  {
    key: 'tickets:delete',
    domain: 'tickets',
    operation: 'delete',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'DELETE', path: '/tickets/{id}' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'destructive_approval_token', type: 'string', required: true },
    ],
    validation_rules: ['destructive operation requires explicit approval token', 'command must be blocked when launch policy denies destructive writes'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/routes/workflow.ts'],
    test_required: 'policy gate + destructive audit event coverage',
  },
  {
    key: 'ticket_notes:update',
    domain: 'ticket_notes',
    operation: 'update',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/tickets/{id}/notes' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'note_id', type: 'number', required: true },
      { name: 'description', type: 'string', required: false, aliases: ['noteText', 'body'] },
      { name: 'title', type: 'string', required: false },
      { name: 'publish', type: 'number', required: false },
      { name: 'note_type', type: 'number', required: false, aliases: ['noteType'] },
    ],
    validation_rules: ['at least one mutable note field must be provided', 'note_id must be a positive integer'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'note update schema + idempotency replay test',
  },
  {
    key: 'ticket_checklist_items:list_by_ticket',
    domain: 'ticket_checklist_items',
    operation: 'list_by_ticket',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'query',
    endpoints: [{ method: 'GET', path: '/tickets/{id}/checklistItems' }],
    payload_schema: [{ name: 'ticket_id', type: 'string', required: true, aliases: ['id'] }],
    validation_rules: ['ticket_id must resolve to numeric Autotask entity id'],
    target_modules: ['apps/api/src/clients/autotask.ts', 'apps/api/src/services/prepare-context.ts'],
    test_required: 'checklist list query request/response contract test',
  },
  {
    key: 'ticket_checklist_items:create',
    domain: 'ticket_checklist_items',
    operation: 'create',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'command',
    endpoints: [{ method: 'POST', path: '/tickets/{id}/checklistItems' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'title', type: 'string', required: true, aliases: ['name'] },
      { name: 'is_completed', type: 'boolean', required: false, aliases: ['isComplete'] },
    ],
    validation_rules: ['title must be non-empty', 'idempotency key is required at command envelope boundary'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'checklist create command schema test',
  },
  {
    key: 'ticket_checklist_items:update',
    domain: 'ticket_checklist_items',
    operation: 'update',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/tickets/{id}/checklistItems' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'checklist_item_id', type: 'number', required: true, aliases: ['checklistItemID'] },
      { name: 'title', type: 'string', required: false, aliases: ['name'] },
      { name: 'is_completed', type: 'boolean', required: false, aliases: ['isComplete'] },
    ],
    validation_rules: ['checklist_item_id must be positive', 'at least one mutable checklist field must be provided'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'checklist update command schema test',
  },
  {
    key: 'ticket_checklist_items:delete',
    domain: 'ticket_checklist_items',
    operation: 'delete',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'command',
    endpoints: [{ method: 'DELETE', path: '/tickets/{id}/checklistItems/{checklistItemId}' }],
    payload_schema: [
      { name: 'ticket_id', type: 'string', required: true, aliases: ['id'] },
      { name: 'checklist_item_id', type: 'number', required: true, aliases: ['checklistItemId'] },
      { name: 'destructive_approval_token', type: 'string', required: true },
    ],
    validation_rules: ['destructive operation requires explicit approval token'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/routes/workflow.ts'],
    test_required: 'checklist delete policy and audit coverage test',
  },
  {
    key: 'time_entries:update',
    domain: 'time_entries',
    operation: 'update',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/timeEntries' }],
    payload_schema: [
      { name: 'time_entry_id', type: 'number', required: true, aliases: ['id'] },
      { name: 'hours_worked', type: 'number', required: false, aliases: ['hoursWorked'] },
      { name: 'summary_notes', type: 'string', required: false, aliases: ['summaryNotes'] },
    ],
    validation_rules: ['time_entry_id must be positive', 'hours_worked must be >= 0 when provided'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'time entry update command schema test',
  },
  {
    key: 'time_entries:delete',
    domain: 'time_entries',
    operation: 'delete',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'DELETE', path: '/timeEntries/{id}' }],
    payload_schema: [
      { name: 'time_entry_id', type: 'number', required: true, aliases: ['id'] },
      { name: 'destructive_approval_token', type: 'string', required: true },
    ],
    validation_rules: ['destructive operation requires explicit approval token'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/routes/workflow.ts'],
    test_required: 'time entry delete policy and audit coverage test',
  },
  {
    key: 'contacts:query_search',
    domain: 'contacts',
    operation: 'query_search',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'query',
    endpoints: [{ method: 'GET', path: '/contacts/query' }],
    payload_schema: [
      { name: 'search', type: 'object', required: true, aliases: ['filter'] },
      { name: 'page_size', type: 'number', required: false, aliases: ['MaxRecords'] },
    ],
    validation_rules: ['search must include allowed op/field/value clauses', 'page_size must stay within adapter limit'],
    target_modules: ['apps/api/src/clients/autotask.ts', 'apps/api/src/services/prepare-context.ts'],
    test_required: 'contact query request/response schema test',
  },
  {
    key: 'contacts:create',
    domain: 'contacts',
    operation: 'create',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'POST', path: '/contacts' }],
    payload_schema: [
      { name: 'company_id', type: 'number', required: true, aliases: ['companyID'] },
      { name: 'first_name', type: 'string', required: true, aliases: ['firstName'] },
      { name: 'last_name', type: 'string', required: true, aliases: ['lastName'] },
      { name: 'email_address', type: 'string', required: false, aliases: ['emailAddress'] },
    ],
    validation_rules: ['company_id must be positive', 'at least one contact method should be present'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'contact create command schema test',
  },
  {
    key: 'contacts:update',
    domain: 'contacts',
    operation: 'update',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/contacts' }],
    payload_schema: [
      { name: 'contact_id', type: 'number', required: true, aliases: ['id'] },
      { name: 'first_name', type: 'string', required: false, aliases: ['firstName'] },
      { name: 'last_name', type: 'string', required: false, aliases: ['lastName'] },
      { name: 'email_address', type: 'string', required: false, aliases: ['emailAddress'] },
    ],
    validation_rules: ['contact_id must be positive', 'at least one mutable field must be provided'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'contact update command schema test',
  },
  {
    key: 'companies:query_search',
    domain: 'companies',
    operation: 'query_search',
    source_status: 'excluded_by_api_limitation',
    action_kind: 'query',
    endpoints: [{ method: 'GET', path: '/companies/query' }],
    payload_schema: [
      { name: 'search', type: 'object', required: true, aliases: ['filter'] },
      { name: 'page_size', type: 'number', required: false, aliases: ['MaxRecords'] },
    ],
    validation_rules: ['search must include allowed op/field/value clauses', 'page_size must stay within adapter limit'],
    target_modules: ['apps/api/src/clients/autotask.ts', 'apps/api/src/services/prepare-context.ts'],
    test_required: 'company query request/response schema test',
  },
  {
    key: 'companies:create',
    domain: 'companies',
    operation: 'create',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'POST', path: '/companies' }],
    payload_schema: [
      { name: 'company_name', type: 'string', required: true, aliases: ['companyName'] },
      { name: 'is_active', type: 'boolean', required: false, aliases: ['isActive'] },
      { name: 'web_address', type: 'string', required: false, aliases: ['webAddress'] },
    ],
    validation_rules: ['company_name must be non-empty'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'company create command schema test',
  },
  {
    key: 'companies:update',
    domain: 'companies',
    operation: 'update',
    source_status: 'excluded_by_permission',
    action_kind: 'command',
    endpoints: [{ method: 'PATCH', path: '/companies' }],
    payload_schema: [
      { name: 'company_id', type: 'number', required: true, aliases: ['id'] },
      { name: 'company_name', type: 'string', required: false, aliases: ['companyName'] },
      { name: 'is_active', type: 'boolean', required: false, aliases: ['isActive'] },
      { name: 'web_address', type: 'string', required: false, aliases: ['webAddress'] },
    ],
    validation_rules: ['company_id must be positive', 'at least one mutable field must be provided'],
    target_modules: ['apps/api/src/services/ticket-workflow-core.ts', 'apps/api/src/clients/autotask.ts'],
    test_required: 'company update command schema test',
  },
] as const;
