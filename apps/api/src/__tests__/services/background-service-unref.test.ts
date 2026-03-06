jest.mock('../../services/application/route-handlers/ticket-intake-route-handlers.js', () => ({
  ingestSupportMailboxOnce: jest.fn(),
  backfillPendingEmailTickets: jest.fn(),
}));

import { AutotaskPollingService as LegacyAutotaskPollingService } from '../../services/autotask-polling.js';
import { TicketIntakePollingService as LegacyTicketIntakePollingService } from '../../services/ticket-intake-polling.js';
import { TicketIntakePollingService as AdapterTicketIntakePollingService } from '../../services/adapters/ticket-intake-polling.js';
import { TriageOrchestrator as LegacyTriageOrchestrator } from '../../services/triage-orchestrator.js';

describe('background service interval unref coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('unrefs intervals in legacy pollers and orchestrator listeners', async () => {
    const handles = Array.from({ length: 4 }, () => ({ unref: jest.fn() })) as any[];
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((() => handles.shift()) as any);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation((() => undefined) as any);

    const legacyOrchestrator = new LegacyTriageOrchestrator();
    const legacyRetrySpy = jest.spyOn(legacyOrchestrator as any, 'processPendingSessions').mockResolvedValue(undefined);
    legacyOrchestrator.startRetryListener();
    await Promise.resolve();

    const legacyAutotask = new LegacyAutotaskPollingService();
    const legacyAutotaskRunSpy = jest.spyOn(legacyAutotask, 'runOnce').mockResolvedValue(undefined);
    legacyAutotask.start();
    await Promise.resolve();

    const legacyTicketIntake = new LegacyTicketIntakePollingService();
    const legacyTicketPollSpy = jest.spyOn(legacyTicketIntake as any, 'poll').mockResolvedValue(undefined);
    legacyTicketIntake.start();
    await Promise.resolve();

    const adapterTicketIntake = new AdapterTicketIntakePollingService();
    const adapterTicketPollSpy = jest.spyOn(adapterTicketIntake as any, 'poll').mockResolvedValue(undefined);
    adapterTicketIntake.start();
    await Promise.resolve();

    expect(legacyRetrySpy).toHaveBeenCalledTimes(1);
    expect(legacyAutotaskRunSpy).toHaveBeenCalledTimes(1);
    expect(legacyTicketPollSpy).toHaveBeenCalledTimes(1);
    expect(adapterTicketPollSpy).toHaveBeenCalledTimes(1);

    for (const handle of setIntervalSpy.mock.results.map((result) => result.value as any)) {
      expect(handle.unref).toHaveBeenCalledTimes(1);
    }

    legacyAutotask.stop();
    legacyTicketIntake.stop();
    adapterTicketIntake.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
  });
});
