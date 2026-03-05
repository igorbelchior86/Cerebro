import { WorkflowReconcileFetchError } from '../../services/orchestration/ticket-workflow-core.js';

const mockWorkflowService = {
  listInbox: jest.fn(),
  submitCommand: jest.fn(),
  processPendingCommands: jest.fn(),
  getCommand: jest.fn(),
  getTicketSnapshot: jest.fn(),
  listTicketCommands: jest.fn(),
  processAutotaskSyncEvent: jest.fn(),
  reconcileTicket: jest.fn(),
  listReconciliationIssues: jest.fn(),
  listAuditByTicket: jest.fn(),
};

jest.mock('../../services/orchestration/workflow-runtime.js', () => ({
  workflowService: mockWorkflowService,
}));

import workflowRouter from '../../routes/workflow/workflow.js';

async function invokeWorkflowRoute(
  method: 'GET' | 'POST',
  url: string,
  options?: { correlationId?: string }
) {
  const correlationId = options?.correlationId || `trace-${Date.now()}`;
  const headers = new Map<string, string>([['x-correlation-id', correlationId]]);
  const req: any = {
    method,
    url,
    originalUrl: `/workflow${url}`,
    headers: Object.fromEntries(headers),
    body: {},
    auth: { tid: 'tenant-1', sub: 'user-1', role: 'admin' },
    header(name: string) {
      return headers.get(name.toLowerCase());
    },
  };

  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      setHeader() {},
    };

    (workflowRouter as any).handle(req, res, (error: unknown) => {
      if (error) {
        reject(error);
      } else {
        resolve({ status: res.statusCode, body: {} });
      }
    });
  });
}

async function invokeReconcileRoute(ticketId: string, correlationId: string, routePrefix: 'legacy' | 'v1' = 'legacy') {
  const url = routePrefix === 'legacy'
    ? `/reconcile/${ticketId}`
    : `/tickets/${ticketId}/reconcile`;
  return invokeWorkflowRoute('POST', url, { correlationId });
}

describe('workflow reconcile route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns classified 429 response for upstream Autotask rate limit during reconcile', async () => {
    mockWorkflowService.reconcileTicket.mockRejectedValueOnce(new Error('Autotask API error: 429 '));

    const response = await invokeReconcileRoute('VAL-H-S2-001', 'agent-h-reconcile-trace');

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      error: 'RATE_LIMITED',
      code: 'WORKFLOW_RECONCILE_RATE_LIMIT',
      retryable: true,
      statusCode: 429,
      classification: expect.objectContaining({
        code: 'RATE_LIMIT',
        disposition: 'retry',
      }),
    });
    expect(String(response.body.message || '')).toMatch(/reconcile snapshot fetch failed/i);
    expect(mockWorkflowService.reconcileTicket).toHaveBeenCalledWith(
      'tenant-1',
      'VAL-H-S2-001',
      expect.objectContaining({
        trace_id: 'agent-h-reconcile-trace',
        ticket_id: 'VAL-H-S2-001',
      }),
    );
  });

  it('returns typed reconcile fetch error payload with operation metadata', async () => {
    mockWorkflowService.reconcileTicket.mockRejectedValueOnce(
      new WorkflowReconcileFetchError('Autotask reconcile snapshot fetch failed; retry later', {
        reason: 'autotask_snapshot_fetch_timeout',
        retryable: true,
        statusCode: 504,
        classification: { code: 'TIMEOUT', disposition: 'retry', reason: 'timeout while fetching snapshot' },
        operation: {
          operation: 'reconcile.fetch',
          attempts: 2,
          max_attempts: 3,
          disposition: 'retry_pending',
          next_retry_at: '2026-02-27T16:00:00.000Z',
        },
      }),
    );

    const response = await invokeReconcileRoute('T20260227.2001', 'typed-reconcile-trace');

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      error: 'GATEWAY_TIMEOUT',
      code: 'WORKFLOW_RECONCILE_TIMEOUT',
      retryable: true,
      statusCode: 504,
      operation: {
        operation: 'reconcile.fetch',
        attempts: 2,
        max_attempts: 3,
        disposition: 'retry_pending',
        next_retry_at: '2026-02-27T16:00:00.000Z',
      },
      classification: expect.objectContaining({
        code: 'TIMEOUT',
        disposition: 'retry',
      }),
    });
  });

  it('returns workflow ticket snapshot with pipeline fields', async () => {
    mockWorkflowService.getTicketSnapshot.mockResolvedValueOnce({
      schema_version: 'v1',
      tenant_id: 'tenant-1',
      ticket_id: 'T20260305.0001',
      snapshot: { ticket_number: 'T20260305.0001', title: 'VPN unstable' },
      block_consistency: {
        core_state: 'ready',
        network_env_body_state: 'resolving',
        hypothesis_checklist_state: 'resolving',
      },
      pipeline_status: 'processing',
      pipeline_reason_code: 'background_processing',
      processing_lag_ms: 4200,
      trace_id: 'trace-ticket-read',
    });

    const response = await invokeWorkflowRoute('GET', '/tickets/T20260305.0001', {
      correlationId: 'trace-ticket-read',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        schema_version: 'v1',
        ticket_id: 'T20260305.0001',
        pipeline_status: 'processing',
        processing_lag_ms: 4200,
      },
    });
    expect(mockWorkflowService.getTicketSnapshot).toHaveBeenCalledWith('tenant-1', 'T20260305.0001');
  });

  it('returns ticket command states mapped for ui consumption', async () => {
    mockWorkflowService.listTicketCommands.mockResolvedValueOnce([
      {
        command_id: 'cmd-1',
        state: 'pending',
        execution_status: 'retry_pending',
        command_type: 'status_update',
        requested_at: '2026-03-05T12:00:00.000Z',
        updated_at: '2026-03-05T12:00:05.000Z',
        attempts: 2,
        max_attempts: 3,
        next_retry_at: '2026-03-05T12:00:10.000Z',
        trace_id: 'trace-cmd-1',
        idempotency_key: 'idem-1',
      },
    ]);

    const response = await invokeWorkflowRoute('GET', '/tickets/T20260305.0001/commands', {
      correlationId: 'trace-cmd-route',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      count: 1,
      data: [
        expect.objectContaining({
          command_id: 'cmd-1',
          state: 'pending',
          execution_status: 'retry_pending',
        }),
      ],
    });
    expect(mockWorkflowService.listTicketCommands).toHaveBeenCalledWith('tenant-1', 'T20260305.0001');
  });

  it('supports v1 reconcile alias route /tickets/:id/reconcile', async () => {
    mockWorkflowService.reconcileTicket.mockResolvedValueOnce({
      matched: true,
      classification: 'match',
      domains: [],
    });

    const response = await invokeReconcileRoute('T20260305.0002', 'trace-reconcile-v1', 'v1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        matched: true,
        classification: 'match',
      }),
    });
    expect(mockWorkflowService.reconcileTicket).toHaveBeenCalledWith(
      'tenant-1',
      'T20260305.0002',
      expect.objectContaining({
        trace_id: 'trace-reconcile-v1',
        ticket_id: 'T20260305.0002',
      }),
    );
  });
});
