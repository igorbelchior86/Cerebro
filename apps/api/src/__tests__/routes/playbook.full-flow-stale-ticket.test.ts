const queryOneMock = jest.fn();
const executeMock = jest.fn();
const transactionMock = jest.fn();
const removeInboxTicketMock = jest.fn();

jest.mock('../../db/index.js', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  execute: (...args: unknown[]) => executeMock(...args),
  transaction: (...args: unknown[]) => transactionMock(...args),
}));

jest.mock('../../services/orchestration/workflow-runtime.js', () => ({
  workflowService: {
    removeInboxTicket: (...args: unknown[]) => removeInboxTicketMock(...args),
  },
}));

describe('playbook full-flow stale Autotask ticket handling', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    executeMock.mockReset();
    transactionMock.mockReset();
    removeInboxTicketMock.mockReset();
    queryOneMock.mockResolvedValue(undefined);
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

  it('creates an isolated full-flow session per tenant for the same ticket id', async () => {
    const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        return { rows: [] };
      }

      if (sql.includes('FROM triage_sessions') && sql.includes('AND tenant_id = $2')) {
        expect(params).toEqual(['T20260306.0001', 'tenant-b']);
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO triage_sessions')) {
        expect(params?.[1]).toBe('T20260306.0001');
        expect(params?.[4]).toBe('tenant-b');
        return { rows: [{ id: 'session-tenant-b' }] };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    transactionMock.mockImplementation(async (callback: (client: { query: typeof clientQueryMock }) => Promise<unknown>) =>
      callback({ query: clientQueryMock }),
    );

    const { __testables } = await import('../../services/application/route-handlers/playbook-route-handlers.js');

    await expect(__testables.resolveOrCreateFullFlowSession('T20260306.0001', 'tenant-b')).resolves.toEqual({
      id: 'session-tenant-b',
      created: true,
    });

    expect(clientQueryMock).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [41022, 'tenant-b:T20260306.0001'],
    );
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND tenant_id = $2'),
      ['T20260306.0001', 'tenant-b'],
    );
  });
});
