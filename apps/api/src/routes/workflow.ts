import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { classifyQueueError } from '../platform/errors.js';
import {
  WorkflowPolicyError,
  WorkflowReconcileFetchError,
  buildCommandEnvelope,
  type WorkflowEventEnvelope,
} from '../services/ticket-workflow-core.js';
import { workflowRealtimeHub, workflowService } from '../services/workflow-runtime.js';
import { toSseChunk } from '../services/workflow-realtime.js';

const router: ExpressRouter = Router();

function requireTenant(req: Request, res: Response): string | null {
  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return null;
  }
  return tenantId;
}

function correlationFromRequest(req: Request, fallbackTicketId?: string) {
  const headerTraceId = String(req.header('x-correlation-id') || req.header('x-trace-id') || '').trim();
  const headerJobId = String(req.header('x-job-id') || '').trim();
  return {
    ...(headerTraceId ? { trace_id: headerTraceId } : {}),
    ...(headerJobId ? { job_id: headerJobId } : {}),
    ...(fallbackTicketId ? { ticket_id: fallbackTicketId } : {}),
  };
}

router.get('/inbox', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const rows = await workflowService.listInbox(tenantId);
    res.json({ success: true, data: rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/realtime', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  const traceId = String(req.header('x-correlation-id') || req.header('x-trace-id') || '').trim() || `realtime-${Date.now()}`;
  const ticketId = String(req.query.ticketId || '').trim();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const { clientId, close } = workflowRealtimeHub.subscribe(tenantId, res);
  res.write(
    toSseChunk({
      event: 'connection.state',
      id: `${Date.now()}-connected`,
      retryMs: 2_000,
      data: {
        kind: 'connection.state',
        event_id: `${Date.now()}-connected`,
        payload: {
          tenant_id: tenantId,
          state: 'connected',
          occurred_at: new Date().toISOString(),
          reason: 'sse_stream_ready',
        },
      },
    })
  );

  console.info('[workflow.realtime.connected]', {
    tenant_id: tenantId,
    ticket_id: ticketId || undefined,
    trace_id: traceId,
    client_id: clientId,
    clients_for_tenant: workflowRealtimeHub.clientCount(tenantId),
  });

  req.on('close', () => {
    close();
    console.info('[workflow.realtime.disconnected]', {
      tenant_id: tenantId,
      ticket_id: ticketId || undefined,
      trace_id: traceId,
      client_id: clientId,
      clients_for_tenant: workflowRealtimeHub.clientCount(tenantId),
    });
  });
});

router.post('/commands', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const body = (req.body || {}) as Record<string, any>;

    const commandType = String(body.command_type || '').trim();
    const targetIntegration = String(body.target_integration || '').trim() || 'Autotask';
    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (!commandType || !idempotencyKey) {
      res.status(400).json({ error: 'command_type and idempotency_key are required' });
      return;
    }

    const payload = typeof body.payload === 'object' && body.payload ? body.payload : {};
    const ticketId = String(payload.ticket_id || body.ticket_id || '').trim() || undefined;

    const envelope = buildCommandEnvelope({
      tenantId,
      targetIntegration: targetIntegration as any,
      commandType: commandType as any,
      payload,
      actor: {
        kind: 'user',
        id: String(req.auth?.sub || 'unknown'),
        origin: 'api',
      },
      idempotencyKey,
      auditMetadata: typeof body.audit_metadata === 'object' && body.audit_metadata ? body.audit_metadata : {},
      correlation: correlationFromRequest(req, ticketId),
    });

    const accepted = await workflowService.submitCommand(envelope);
    const autoProcess = body.auto_process !== false;
    let processResult: Record<string, unknown> | undefined;
    if (autoProcess) {
      processResult = await workflowService.processPendingCommands(10);
    }

    res.status(202).json({
      success: true,
      data: accepted,
      ...(processResult ? { worker: processResult } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof WorkflowPolicyError) {
      res.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post('/commands/process', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    void tenantId;
    const limit = Number.isFinite(Number(req.body?.limit)) ? Math.max(1, Math.min(100, Number(req.body.limit))) : 20;
    const result = await workflowService.processPendingCommands(limit);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/commands/:commandId', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const row = await workflowService.getCommand(String(req.params.commandId || '').trim());
    if (!row || row.command.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }
    res.json({ success: true, data: row, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/sync/autotask', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const body = (req.body || {}) as Partial<WorkflowEventEnvelope>;
    const ticketId = String(body?.correlation?.ticket_id || body.entity_id || '').trim();
    if (!body.event_id || !body.event_type || !ticketId) {
      res.status(400).json({ error: 'event_id, event_type, and ticket identifier are required' });
      return;
    }

    const event: WorkflowEventEnvelope = {
      event_id: String(body.event_id),
      tenant_id: tenantId,
      event_type: body.event_type as any,
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: ticketId,
      payload: (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<string, unknown>,
      occurred_at: String(body.occurred_at || new Date().toISOString()),
      correlation: {
        trace_id: String(body.correlation?.trace_id || req.header('x-correlation-id') || `sync-${Date.now()}`),
        ticket_id: ticketId,
        ...(body.correlation?.job_id ? { job_id: String(body.correlation.job_id) } : {}),
        ...(body.correlation?.command_id ? { command_id: String(body.correlation.command_id) } : {}),
      },
      provenance: {
        source: (body.provenance?.source as any) || 'autotask_webhook',
        fetched_at: String(body.provenance?.fetched_at || new Date().toISOString()),
        ...(body.provenance?.adapter_version ? { adapter_version: String(body.provenance.adapter_version) } : {}),
        ...(body.provenance?.sync_cursor ? { sync_cursor: String(body.provenance.sync_cursor) } : {}),
      },
    };

    const result = await workflowService.processAutotaskSyncEvent(event);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/reconcile/:ticketId', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId required' });
      return;
    }
    const result = await workflowService.reconcileTicket(tenantId, ticketId, {
      trace_id: String(req.header('x-correlation-id') || `reconcile-${Date.now()}`),
      ticket_id: ticketId,
    });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof WorkflowReconcileFetchError) {
      res.status(error.info.statusCode).json({
        error: error.info.classification.code === 'RATE_LIMIT'
          ? 'RATE_LIMITED'
          : error.info.classification.code === 'TIMEOUT'
            ? 'GATEWAY_TIMEOUT'
            : 'RECONCILE_FETCH_FAILED',
        code: `WORKFLOW_RECONCILE_${error.info.classification.code}`,
        message: error.message,
        statusCode: error.info.statusCode,
        retryable: error.info.retryable,
        classification: error.info.classification,
        operation: error.info.operation,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const classified = classifyQueueError(error);
    if (classified.code === 'RATE_LIMIT' || classified.code === 'TIMEOUT') {
      const statusCode = classified.code === 'RATE_LIMIT' ? 429 : 504;
      res.status(statusCode).json({
        error: classified.code === 'RATE_LIMIT' ? 'RATE_LIMITED' : 'GATEWAY_TIMEOUT',
        code: `WORKFLOW_RECONCILE_${classified.code}`,
        message: 'Autotask reconcile snapshot fetch failed; retry later',
        statusCode,
        retryable: true,
        classification: classified,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

router.get('/reconciliation-issues', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const ticketId = String(req.query.ticketId || '').trim() || undefined;
    const rows = await workflowService.listReconciliationIssues(tenantId, ticketId);
    res.json({ success: true, data: rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/audit/:ticketId', async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const ticketId = String(req.params.ticketId || '').trim();
    const rows = await workflowService.listAuditByTicket(tenantId, ticketId);
    res.json({ success: true, data: rows, count: rows.length, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;
