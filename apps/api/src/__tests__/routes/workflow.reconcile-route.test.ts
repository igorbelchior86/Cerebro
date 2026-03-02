import express from 'express';
import request from 'supertest';
import { WorkflowReconcileFetchError } from '../../services/orchestration/ticket-workflow-core.js';

const mockWorkflowService = {
  listInbox: jest.fn(),
  submitCommand: jest.fn(),
  processPendingCommands: jest.fn(),
  getCommand: jest.fn(),
  processAutotaskSyncEvent: jest.fn(),
  reconcileTicket: jest.fn(),
  listReconciliationIssues: jest.fn(),
  listAuditByTicket: jest.fn(),
};

jest.mock('../../services/workflow-runtime.js', () => ({
  workflowService: mockWorkflowService,
}));

import workflowRouter from '../../routes/workflow/workflow.js';

describe('workflow reconcile route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns classified 429 response for upstream Autotask rate limit during reconcile', async () => {
    mockWorkflowService.reconcileTicket.mockRejectedValueOnce(new Error('Autotask API error: 429 '));

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).auth = { tid: 'tenant-1', sub: 'user-1', role: 'admin' };
      next();
    });
    app.use('/workflow', workflowRouter);

    const response = await request(app)
      .post('/workflow/reconcile/VAL-H-S2-001')
      .set('x-correlation-id', 'agent-h-reconcile-trace')
      .send({});

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

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).auth = { tid: 'tenant-1', sub: 'user-1', role: 'admin' };
      next();
    });
    app.use('/workflow', workflowRouter);

    const response = await request(app)
      .post('/workflow/reconcile/T20260227.2001')
      .set('x-correlation-id', 'typed-reconcile-trace')
      .send({});

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
});
