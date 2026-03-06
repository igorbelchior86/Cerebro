jest.mock('../../services/application/route-handlers/ticket-intake-route-handlers.js', () => ({
  ingestSupportMailboxOnce: jest.fn(),
  backfillPendingEmailTickets: jest.fn(),
}));

import { AutotaskPollingService as LegacyAutotaskPollingService } from '../../services/autotask-polling.js';
import { TicketIntakePollingService as LegacyTicketIntakePollingService } from '../../services/ticket-intake-polling.js';
import { TicketIntakePollingService as AdapterTicketIntakePollingService } from '../../services/adapters/ticket-intake-polling.js';
import { TriageOrchestrator as LegacyTriageOrchestrator } from '../../services/triage-orchestrator.js';

type LegacyTriageInternals = {
  startRetryListener(): void;
  processPendingSessions(): Promise<void>;
};
type LegacyTicketIntakeInternals = {
  start(): void;
  stop(): void;
  poll(): Promise<void>;
};

describe('background service interval unref coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('unrefs intervals in legacy pollers and orchestrator listeners', async () => {
    const handles = Array.from({ length: 4 }, () => ({ unref: jest.fn() } as unknown as NodeJS.Timeout));
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => handles.shift() ?? handles[0]!);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);

    const legacyOrchestrator = new LegacyTriageOrchestrator();
    const legacyOrchestratorInternals = legacyOrchestrator as unknown as LegacyTriageInternals;
    const legacyRetrySpy = jest.spyOn(legacyOrchestratorInternals, 'processPendingSessions').mockImplementation(async () => undefined);
    legacyOrchestratorInternals.startRetryListener();
    await Promise.resolve();

    const legacyAutotask = new LegacyAutotaskPollingService();
    const legacyAutotaskRunSpy = jest.spyOn(legacyAutotask, 'runOnce').mockResolvedValue(undefined);
    legacyAutotask.start();
    await Promise.resolve();

    const legacyTicketIntake = new LegacyTicketIntakePollingService();
    const legacyTicketIntakeInternals = legacyTicketIntake as unknown as LegacyTicketIntakeInternals;
    const legacyTicketPollSpy = jest.spyOn(legacyTicketIntakeInternals, 'poll').mockImplementation(async () => undefined);
    legacyTicketIntakeInternals.start();
    await Promise.resolve();

    const adapterTicketIntake = new AdapterTicketIntakePollingService();
    const adapterTicketIntakeInternals = adapterTicketIntake as unknown as LegacyTicketIntakeInternals;
    const adapterTicketPollSpy = jest.spyOn(adapterTicketIntakeInternals, 'poll').mockImplementation(async () => undefined);
    adapterTicketIntakeInternals.start();
    await Promise.resolve();

    expect(legacyRetrySpy).toHaveBeenCalledTimes(1);
    expect(legacyAutotaskRunSpy).toHaveBeenCalledTimes(1);
    expect(legacyTicketPollSpy).toHaveBeenCalledTimes(1);
    expect(adapterTicketPollSpy).toHaveBeenCalledTimes(1);

    for (const handle of setIntervalSpy.mock.results.map((result) => result.value as NodeJS.Timeout)) {
      expect(handle.unref).toHaveBeenCalledTimes(1);
    }

    legacyAutotask.stop();
    legacyTicketIntake.stop();
    adapterTicketIntake.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
  });
});
