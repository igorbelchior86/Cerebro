import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { tenantContext } from './lib/tenantContext.js';

export type RequestCorrelation = {
  requestId: string;
  traceId: string;
  ticketId?: string;
  jobId?: string;
  commandId?: string;
};

declare global {
  namespace Express {
    interface Request {
      correlation?: RequestCorrelation;
    }
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildCorrelationFromRequest(req: Request): RequestCorrelation {
  const requestId =
    firstHeaderValue(req.headers['x-request-id']) ||
    firstHeaderValue(req.headers['x-correlation-id']) ||
    randomUUID();
  const traceId = firstHeaderValue(req.headers['x-trace-id']) || requestId;
  const ticketId = firstHeaderValue(req.headers['x-ticket-id']);
  const jobId = firstHeaderValue(req.headers['x-job-id']);
  const commandId = firstHeaderValue(req.headers['x-command-id']);

  const base: RequestCorrelation = { requestId, traceId };
  if (ticketId) base.ticketId = ticketId;
  if (jobId) base.jobId = jobId;
  if (commandId) base.commandId = commandId;
  return base;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlation = buildCorrelationFromRequest(req);
  req.correlation = correlation;

  res.setHeader('x-request-id', correlation.requestId);
  res.setHeader('x-trace-id', correlation.traceId);

  tenantContext.run(
    {
      tenantId: undefined,
      bypassRLS: false,
      requestId: correlation.requestId,
      traceId: correlation.traceId,
      ticketId: correlation.ticketId,
      jobId: correlation.jobId,
      commandId: correlation.commandId,
    },
    () => next(),
  );
}

export function getRequestContextSnapshot() {
  const store = tenantContext.getStore();
  return {
    tenant_id: store?.tenantId,
    trace_id: store?.traceId,
    request_id: store?.requestId,
    ticket_id: store?.ticketId,
    job_id: store?.jobId,
    command_id: store?.commandId,
    actor_id: store?.actorId,
    actor_type: store?.actorType,
    actor_role: store?.actorRole,
  };
}
