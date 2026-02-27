import { AutotaskPollingService } from '../../services/autotask-polling.js';

describe('AutotaskPollingService P0 hardening', () => {
  it('feeds polled Autotask tickets into workflow sync path and triage pipeline', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            {
              id: 123,
              ticketNumber: 'T20260226.0123',
              title: 'Printer down',
              description: 'Queue stuck',
              status: 'New',
              queueID: 7,
              createDate: '2026-02-26T12:00:00.000Z',
            },
          ]),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(workflowSync).toHaveBeenCalledTimes(1);
    expect(workflowSync.mock.calls[0]?.[0]).toMatchObject({
      tenant_id: 'tenant-1',
      event_type: 'ticket.created',
      entity_id: 'T20260226.0123',
      provenance: { source: 'autotask_poller' },
    });
    expect(triageRun).toHaveBeenCalledWith('123');
  });

  it('skips workflow sync when poller tenant is unavailable but preserves triage execution (degraded mode)', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            { id: 321, ticketNumber: 'T20260226.0321', createDate: '2026-02-26T12:00:00.000Z' },
          ]),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(workflowSync).not.toHaveBeenCalled();
    expect(triageRun).toHaveBeenCalledWith('321');
  });

  it('retries transient sync ingestion failures and succeeds before DLQ', async () => {
    let now = 10_000;
    const searchTickets = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 777, ticketNumber: 'T20260227.0777', createDate: '2026-02-27T12:00:00.000Z' },
      ])
      .mockResolvedValue([]);
    const workflowSync = jest
      .fn()
      .mockRejectedValueOnce(new Error('Autotask API error: 429'))
      .mockRejectedValueOnce(new Error('timeout while writing sync event'))
      .mockResolvedValueOnce(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets,
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      now: () => now,
      retryBackoffMs: () => 0,
      syncRetryMaxAttempts: 5,
    });

    await service.runOnce();
    now += 1;
    await service.runOnce();
    now += 1;
    await service.runOnce();

    expect(workflowSync).toHaveBeenCalledTimes(3);
    expect(triageRun).toHaveBeenCalled();
  });

  it('moves sync ingestion failure to DLQ after max attempts', async () => {
    let now = 20_000;
    const searchTickets = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 999, ticketNumber: 'T20260227.0999', createDate: '2026-02-27T12:00:00.000Z' },
      ])
      .mockResolvedValue([]);
    const workflowSync = jest.fn().mockRejectedValue(new Error('Autotask API error: 429'));
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets,
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      now: () => now,
      retryBackoffMs: () => 0,
      syncRetryMaxAttempts: 2,
    });

    await service.runOnce();
    now += 1;
    await service.runOnce();
    now += 1;
    await service.runOnce();

    // 2 attempts total for the event (retry then DLQ), no unbounded retries.
    expect(workflowSync).toHaveBeenCalledTimes(2);
  });
});
