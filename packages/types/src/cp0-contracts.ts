export type CP0LaunchIntegrationId =
  | 'autotask'
  | 'itglue'
  | 'ninja'
  | 'sentinelone'
  | 'checkpoint';

export type CP0IntegrationMode = 'two_way' | 'read_only';

export type CP0CorrelationIds = {
  trace_id: string;
  request_id?: string;
  ticket_id?: string;
  job_id?: string;
  command_id?: string;
};

export type CP0RbacRole = 'admin' | 'manager' | 'tech' | 'viewer';

export interface CP0ActorRef {
  type: 'user' | 'system' | 'ai';
  id: string;
  role?: CP0RbacRole | string;
  origin: 'api' | 'worker' | 'integration' | 'scheduler' | 'ai';
}

export interface ExternalRef {
  source: CP0LaunchIntegrationId | string;
  entity_type: string;
  entity_id: string;
  fetched_at: string;
  metadata?: Record<string, unknown>;
}

export interface CP0CanonicalTicketModel {
  ticket_id: string;
  tenant_id: string;
  external_refs: ExternalRef[];
  status: string;
  priority: string | number;
  assignment: {
    user_id?: string;
    team_id?: string;
    display_name?: string;
  };
  source_channel: 'chat' | 'email';
  requester: {
    contact_id?: string;
    name?: string;
    email?: string;
  };
  timestamps: {
    created_at: string;
    updated_at: string;
  };
}

export interface ContextCardP0 {
  card_id: string;
  source: CP0LaunchIntegrationId | string;
  card_type: string;
  title: string;
  summary?: string;
  data: Record<string, unknown>;
}

export interface ContextEvidenceP0 {
  evidence_id: string;
  source: CP0LaunchIntegrationId | string;
  evidence_type: string;
  observed_at: string;
  summary: string;
  data?: Record<string, unknown>;
}

export interface CP0TicketContextEnvelope {
  ticket_id: string;
  tenant_id: string;
  cards: ContextCardP0[];
  evidence: ContextEvidenceP0[];
  provenance: {
    source: CP0LaunchIntegrationId | string;
    fetched_at: string;
    adapter_version?: string;
  };
  policy: {
    mode: CP0IntegrationMode;
    enforced_by: string;
    decision_reason?: string;
  };
  correlation: CP0CorrelationIds;
}

export type AutotaskCommandTypeP0 =
  | 'create'
  | 'update'
  | 'assign'
  | 'status'
  | 'time_entry';

export interface CP0CommandEnvelope {
  command_id: string;
  tenant_id: string;
  target_integration: CP0LaunchIntegrationId;
  command_type: AutotaskCommandTypeP0 | string;
  payload: Record<string, unknown>;
  actor: CP0ActorRef;
  idempotency_key: string;
  audit_metadata: Record<string, unknown>;
  correlation: CP0CorrelationIds;
  requested_at: string;
}

export interface CP0EventEnvelope {
  event_id: string;
  tenant_id: string;
  event_type: string;
  source: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  correlation: CP0CorrelationIds;
  provenance: {
    integration?: CP0LaunchIntegrationId | string;
    adapter_version?: string;
    ingested_at?: string;
  };
}

export type AuditResult = 'success' | 'failure' | 'rejected';

export interface CP0AuditRecord {
  audit_id: string;
  tenant_id: string;
  actor: CP0ActorRef;
  action: string;
  target: {
    type: string;
    id?: string;
    integration?: CP0LaunchIntegrationId | string;
  };
  result: AuditResult;
  reason?: string;
  timestamp: string;
  correlation: CP0CorrelationIds;
  metadata: Record<string, unknown>;
}

export type AiDecisionTypeP0 =
  | 'triage'
  | 'priority'
  | 'routing'
  | 'summary'
  | 'handoff';

export type HitlStatusP0 = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface CP0AiDecisionRecord {
  decision_id: string;
  tenant_id: string;
  ticket_id: string;
  decision_type: AiDecisionTypeP0 | string;
  suggestion: Record<string, unknown> | string;
  confidence: number;
  rationale: string;
  signals_used: Array<{ source: string; ref: string }>;
  hitl_status: HitlStatusP0;
  prompt_version: string;
  model_version: string;
  timestamp: string;
  correlation: CP0CorrelationIds;
}

export interface CP0IntegrationCredentialRef {
  credential_id: string;
  tenant_id: string;
  integration: CP0LaunchIntegrationId;
  label: string;
  secret_ref: string;
  scopes?: string[];
  created_at: string;
  updated_at: string;
}

export interface CP0FeatureFlagEvaluation {
  tenant_id: string;
  flag_key: string;
  enabled: boolean;
  evaluated_at: string;
  reason?: string;
}

export type QueueDeliveryAttemptP0 = {
  attempt: number;
  error_code?: string;
  at: string;
};

export interface CP0QueueJobEnvelope<TPayload = Record<string, unknown>> {
  job_id: string;
  tenant_id: string;
  job_type: string;
  payload: TPayload;
  idempotency_key?: string;
  max_attempts: number;
  attempts: QueueDeliveryAttemptP0[];
  created_at: string;
  available_at: string;
  correlation: CP0CorrelationIds;
}

export type CP0QueueDisposition = 'ack' | 'retry' | 'dlq';

export type QueueErrorClassificationCode =
  | 'TRANSIENT'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'DEPENDENCY'
  | 'VALIDATION'
  | 'POLICY_REJECTED'
  | 'AUTH'
  | 'CONFLICT'
  | 'UNKNOWN';

export interface CP0QueueErrorClassification {
  code: QueueErrorClassificationCode;
  disposition: CP0QueueDisposition;
  reason: string;
}

export interface CP0IntegrationMutationRequest {
  tenant_id: string;
  integration: CP0LaunchIntegrationId;
  actor: CP0ActorRef;
  action: string;
  correlation: CP0CorrelationIds;
}

export interface CP0IntegrationAdapterContract {
  integration: CP0LaunchIntegrationId;
  mode: CP0IntegrationMode;
  healthCheck(input: {
    tenant_id: string;
    correlation: CP0CorrelationIds;
  }): Promise<{ ok: boolean; details?: Record<string, unknown> }>;
  fetchContext?(input: {
    ticket_id: string;
    tenant_id: string;
    correlation: CP0CorrelationIds;
  }): Promise<CP0TicketContextEnvelope>;
  emitCanonicalEvent?(input: {
    tenant_id: string;
    correlation: CP0CorrelationIds;
    payload: Record<string, unknown>;
  }): Promise<CP0EventEnvelope>;
  mutate?(
    request: CP0IntegrationMutationRequest & {
      payload: Record<string, unknown>;
      idempotency_key: string;
    }
  ): Promise<unknown>;
}
