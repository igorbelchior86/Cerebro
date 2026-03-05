export type BlockResolutionStateV1 = 'resolving' | 'ready' | 'degraded';

export interface BlockConsistencyStateV1 {
  core_state: BlockResolutionStateV1;
  network_env_body_state: BlockResolutionStateV1;
  hypothesis_checklist_state: BlockResolutionStateV1;
}

export type PipelineStatusV1 =
  | 'queued'
  | 'processing'
  | 'retry_scheduled'
  | 'degraded'
  | 'dlq'
  | 'ready';

export type ConnectorCommandStateV1 =
  | 'accepted'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'dlq';

export interface CanonicalEventV1 {
  schema_version: 'v1';
  tenant_id: string;
  source: 'autotask' | 'psa';
  event_id: string;
  idempotency_key?: string;
  ticket_id: string;
  occurred_at: string;
  received_at: string;
  trace_id: string;
  raw_payload_ref?: string;
  canonical_payload: Record<string, unknown>;
}

export interface CanonicalTicketSnapshotV1 {
  schema_version: 'v1';
  tenant_id: string;
  ticket_id: string;
  snapshot: Record<string, unknown>;
  block_consistency: BlockConsistencyStateV1;
  pipeline_status: PipelineStatusV1;
  pipeline_reason_code?: string;
  processing_lag_ms?: number;
  next_retry_at?: string;
  retry_count?: number;
  dlq_id?: string;
  last_background_processed_at?: string;
  consistent_at?: string;
  trace_id?: string;
}
