const executeMock = jest.fn();
const removeInboxTicketMock = jest.fn();

jest.mock('../../db/index.js', () => ({
  queryOne: jest.fn(),
  execute: (...args: unknown[]) => executeMock(...args),
  transaction: jest.fn(),
}));

jest.mock('../../services/orchestration/workflow-runtime.js', () => ({
  workflowService: {
    removeInboxTicket: (...args: unknown[]) => removeInboxTicketMock(...args),
  },
}));

describe('playbook full-flow stale Autotask ticket handling', () => {
  beforeEach(() => {
    executeMock.mockReset();
    removeInboxTicketMock.mockReset();
    executeMock.mockResolvedValue(undefined);
    removeInboxTicketMock.mockResolvedValue(undefined);
  });

  it('identifies missing Autotask ticket errors', async () => {
    const { __testables } = await import('../../services/application/route-handlers/playbook-route-handlers.js');

    expect(__testables.isMissingAutotaskTicketError(new Error('Ticket T20260305.0031 not found in Autotask query'))).toBe(true);
    expect(__testables.isMissingAutotaskTicketError(new Error('Cannot prepare context without valid ticket from Autotask'))).toBe(true);
    expect(__testables.isMissingAutotaskTicketError(new Error('Autotask API error: 429'))).toBe(false);
  });

  it('removes stale inbox ticket and marks session deleted', async () => {
    const { __testables } = await import('../../services/application/route-handlers/playbook-route-handlers.js');

    await __testables.markSessionDeletedFromAutotask(
      'session-1',
      'T20260305.0031',
      'tenant-1',
      'Ticket T20260305.0031 not found in Autotask query',
    );

    expect(removeInboxTicketMock).toHaveBeenCalledWith(
      'tenant-1',
      'T20260305.0031',
      expect.objectContaining({
        reason: 'autotask_ticket_missing_during_full_flow',
        metadata: expect.objectContaining({
          session_id: 'session-1',
          upstream_reason: 'Ticket T20260305.0031 not found in Autotask query',
        }),
      }),
    );
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'failed'"),
      ['deleted in Autotask: Ticket T20260305.0031 not found in Autotask query', 'session-1'],
    );
  });
});
