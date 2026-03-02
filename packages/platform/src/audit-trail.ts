import { randomUUID } from 'crypto';
import type { CP0ActorRef, CP0AuditRecord } from '@cerebro/types';
import { getRequestContextSnapshot } from './request-context.js';

export interface AuditSink {
  write(record: CP0AuditRecord): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  public readonly records: CP0AuditRecord[] = [];
  async write(record: CP0AuditRecord): Promise<void> {
    this.records.push(record);
  }
}

export class AuditTrailService {
  constructor(private readonly sink: AuditSink) {}

  async emit(input: {
    tenant_id: string;
    actor: CP0ActorRef;
    action: string;
    target: CP0AuditRecord['target'];
    result: CP0AuditRecord['result'];
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CP0AuditRecord> {
    const ctx = getRequestContextSnapshot();
    const correlation: CP0AuditRecord['correlation'] = {
      trace_id: ctx.trace_id || ctx.request_id || randomUUID(),
    };
    if (ctx.request_id) correlation.request_id = ctx.request_id;
    if (ctx.ticket_id) correlation.ticket_id = ctx.ticket_id;
    if (ctx.job_id) correlation.job_id = ctx.job_id;
    if (ctx.command_id) correlation.command_id = ctx.command_id;

    const record: CP0AuditRecord = {
      audit_id: randomUUID(),
      tenant_id: input.tenant_id,
      actor: input.actor,
      action: input.action,
      target: input.target,
      result: input.result,
      timestamp: new Date().toISOString(),
      correlation,
      metadata: input.metadata || {},
    };
    if (input.reason) {
      record.reason = input.reason;
    }
    await this.sink.write(record);
    return record;
  }
}
