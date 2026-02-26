import express from 'express';
import request from 'supertest';

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

import workflowRouter from '../../routes/workflow.js';

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
});
