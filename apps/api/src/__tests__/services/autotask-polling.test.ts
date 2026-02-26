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
});

