export type WorkflowRealtimeConnectionState = 'connected' | 'degraded';

export type WorkflowRealtimeTicketChangeKind =
  | 'assigned'
  | 'status'
  | 'comment'
  | 'process_result'
  | 'sync';

export interface WorkflowRealtimeTicketChangePayload {
  tenant_id: string;
  ticket_id: string;
  trace_id?: string;
  command_id?: string;
  sync_event_id?: string;
  occurred_at: string;
  change_kind: WorkflowRealtimeTicketChangeKind;
  status?: string;
  assigned_to?: string;
  queue_id?: number;
  queue_name?: string;
  comment?: {
    visibility: 'internal' | 'public';
    body: string;
    created_at: string;
  };
  process_result?: {
    command_id: string;
    command_type: string;
    outcome: 'completed' | 'retry_pending' | 'failed' | 'dlq';
    attempts: number;
    next_retry_at?: string;
    reason?: string;
  };
}

export interface WorkflowRealtimeConnectionPayload {
  tenant_id: string;
  state: WorkflowRealtimeConnectionState;
  occurred_at: string;
  reason?: string;
  fallback?: 'polling';
}

export type WorkflowRealtimeEnvelope =
  | {
      kind: 'ticket.change';
      event_id: string;
      payload: WorkflowRealtimeTicketChangePayload;
    }
  | {
      kind: 'connection.state';
      event_id: string;
      payload: WorkflowRealtimeConnectionPayload;
    }
  | {
      kind: 'heartbeat';
      event_id: string;
      payload: {
        tenant_id: string;
        occurred_at: string;
      };
    };
