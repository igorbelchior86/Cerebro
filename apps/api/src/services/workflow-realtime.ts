import { randomUUID } from 'crypto';
import type { Response } from 'express';

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

type WorkflowRealtimeClient = {
  id: string;
  tenant_id: string;
  res: Response;
};

const HEARTBEAT_INTERVAL_MS = Math.max(5_000, Number(process.env.WORKFLOW_REALTIME_HEARTBEAT_MS || 15_000));

function toSseChunk(input: { event?: string; id?: string; retryMs?: number; data: unknown }): string {
  const lines: string[] = [];
  if (input.id) lines.push(`id: ${input.id}`);
  if (input.event) lines.push(`event: ${input.event}`);
  if (typeof input.retryMs === 'number' && Number.isFinite(input.retryMs)) lines.push(`retry: ${Math.max(500, Math.floor(input.retryMs))}`);
  const raw = JSON.stringify(input.data);
  for (const line of raw.split('\n')) {
    lines.push(`data: ${line}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export class WorkflowRealtimeHub {
  private readonly clients = new Map<string, WorkflowRealtimeClient>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      this.emitHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  close(): void {
    clearInterval(this.heartbeatTimer);
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        // no-op
      }
    }
    this.clients.clear();
  }

  subscribe(tenantId: string, res: Response): { clientId: string; close: () => void } {
    const clientId = randomUUID();
    const client: WorkflowRealtimeClient = { id: clientId, tenant_id: tenantId, res };
    this.clients.set(clientId, client);
    return {
      clientId,
      close: () => this.unsubscribe(clientId),
    };
  }

  unsubscribe(clientId: string): void {
    this.clients.delete(clientId);
  }

  clientCount(tenantId?: string): number {
    if (!tenantId) return this.clients.size;
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.tenant_id === tenantId) count += 1;
    }
    return count;
  }

  publishConnection(payload: WorkflowRealtimeConnectionPayload): number {
    return this.publish(payload.tenant_id, {
      kind: 'connection.state',
      event_id: randomUUID(),
      payload,
    });
  }

  publishTicketChange(payload: WorkflowRealtimeTicketChangePayload): number {
    return this.publish(payload.tenant_id, {
      kind: 'ticket.change',
      event_id: randomUUID(),
      payload,
    });
  }

  publish(tenantId: string, envelope: WorkflowRealtimeEnvelope): number {
    const chunk = toSseChunk({
      id: envelope.event_id,
      event: envelope.kind,
      data: envelope,
    });
    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.tenant_id !== tenantId) continue;
      const ok = this.write(client, chunk);
      if (ok) sent += 1;
    }
    return sent;
  }

  private emitHeartbeat(): void {
    const groupedTenants = new Set<string>();
    for (const client of this.clients.values()) {
      groupedTenants.add(client.tenant_id);
    }
    for (const tenantId of groupedTenants) {
      const envelope: WorkflowRealtimeEnvelope = {
        kind: 'heartbeat',
        event_id: randomUUID(),
        payload: {
          tenant_id: tenantId,
          occurred_at: new Date().toISOString(),
        },
      };
      void this.publish(tenantId, envelope);
    }
  }

  private write(client: WorkflowRealtimeClient, chunk: string): boolean {
    try {
      client.res.write(chunk);
      return true;
    } catch {
      this.unsubscribe(client.id);
      return false;
    }
  }
}

export { toSseChunk, HEARTBEAT_INTERVAL_MS };
