import { AutotaskPollingService } from '../../services/adapters/autotask-polling.js';

describe('AutotaskPollingService P0 hardening', () => {
  it('disables historical parity backfill when active-only mode is enabled', async () => {
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: true,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([]),
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });
    const backfillSpy = jest.spyOn(service as any, 'runParityBackfill').mockResolvedValue(undefined);

    await service.runOnce();

    expect(backfillSpy).not.toHaveBeenCalled();
  });

  it('keeps historical parity backfill available when active-only mode is disabled', async () => {
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: false,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([]),
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });
    const backfillSpy = jest.spyOn(service as any, 'runParityBackfill').mockResolvedValue(undefined);

    await service.runOnce();

    expect(backfillSpy).toHaveBeenCalledTimes(1);
  });

  it('excludes tickets from Complete queue in active-only mode', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const searchTickets = jest.fn(async (filter: string) => {
      const raw = JSON.parse(filter);
      const queueFilter = Array.isArray(raw?.filter)
        ? raw.filter.find((entry: any) => String(entry?.field || '') === 'queueID')
        : null;
      if (queueFilter) {
        if (Number(queueFilter.value) === 10) {
          return [
            { id: 1001, ticketNumber: 'T-COMPLETE-1', queueID: 10, createDate: '2026-03-03T12:00:00.000Z' },
          ];
        }
        if (Number(queueFilter.value) === 20) {
          return [
            { id: 2001, ticketNumber: 'T-ACTIVE-1', queueID: 20, createDate: '2026-03-03T12:01:00.000Z' },
          ];
        }
      }
      return [
        { id: 3001, ticketNumber: 'T-COMPLETE-RECENT', queueID: 10, createDate: '2026-03-03T12:02:00.000Z' },
        { id: 3002, ticketNumber: 'T-ACTIVE-RECENT', queueID: 20, createDate: '2026-03-03T12:03:00.000Z' },
      ];
    });
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: true,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          getTicketQueues: jest.fn().mockResolvedValue([
            { id: 10, name: 'Complete' },
            { id: 20, name: 'Service Desk' },
          ]),
          searchTickets,
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

    const entityIds = workflowSync.mock.calls.map((call) => String(call?.[0]?.entity_id || ''));
    expect(entityIds).toEqual(expect.arrayContaining(['T-ACTIVE-1', 'T-ACTIVE-RECENT']));
    expect(entityIds).not.toEqual(expect.arrayContaining(['T-COMPLETE-1', 'T-COMPLETE-RECENT']));
    expect(triageRun).toHaveBeenCalledTimes(1);
    expect(triageRun).toHaveBeenCalledWith('3002');
  });

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
