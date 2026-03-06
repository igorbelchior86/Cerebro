jest.mock('../../db/index.js', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('../../services/context/prepare-context.js', () => ({
  PrepareContextService: jest.fn().mockImplementation(() => ({
    prepare: jest.fn(),
  })),
  persistEvidencePack: jest.fn(),
}));

jest.mock('../../services/ai/diagnose.js', () => ({
  DiagnoseService: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
  })),
}));

jest.mock('../../services/domain/validate-policy.js', () => ({
  ValidatePolicyService: jest.fn().mockImplementation(() => ({
    validate: jest.fn(),
  })),
}));

jest.mock('../../services/ai/playbook-writer.js', () => ({
  PlaybookWriterService: jest.fn().mockImplementation(() => ({
    generate: jest.fn(),
  })),
}));

import { transaction } from '../../db/index.js';
import { TriageOrchestrator } from '../../services/orchestration/triage-orchestrator.js';

const transactionMock = transaction as jest.MockedFunction<typeof transaction>;
type TriageOrchestratorInternals = {
  processPendingSessions(): Promise<void>;
  claimOrCreateSession(ticketId: string, source?: string, tenantId?: string): Promise<string>;
};
type TransactionClient = Parameters<Parameters<typeof transaction>[0]>[0];

describe('TriageOrchestrator tenant-scoped claims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unrefs the retry listener interval so background sweeps do not pin the process', async () => {
    const intervalHandle = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => intervalHandle);

    const orchestrator = new TriageOrchestrator();
    const internalOrchestrator = orchestrator as unknown as TriageOrchestratorInternals;
    const processPendingSpy = jest.spyOn(internalOrchestrator, 'processPendingSessions').mockImplementation(async () => undefined);

    orchestrator.startRetryListener();
    await Promise.resolve();

    expect(processPendingSpy).toHaveBeenCalledTimes(1);
    expect(intervalHandle.unref).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });

  it('creates poller sessions inside the provided tenant instead of defaulting to the oldest tenant', async () => {
    const queryMock = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query: queryMock } as unknown as TransactionClient;
    transactionMock.mockImplementation(async (callback) => callback(client));

    const orchestrator = new TriageOrchestrator();
    const internalOrchestrator = orchestrator as unknown as TriageOrchestratorInternals;
    const sessionId = await internalOrchestrator.claimOrCreateSession('132939', undefined, 'tenant-9439');

    expect(sessionId).toBeTruthy();
    expect(String(queryMock.mock.calls[1]?.[0] || '')).toContain('AND tenant_id = $2');
    expect(queryMock.mock.calls[1]?.[1]).toEqual(['132939', 'tenant-9439']);
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(String(queryMock.mock.calls[2]?.[0] || '')).toContain('INSERT INTO triage_sessions');
    expect(queryMock.mock.calls[2]?.[1]?.[5]).toBe('tenant-9439');
  });

  it('keeps legacy default-tenant fallback only when no tenant context is provided', async () => {
    const queryMock = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'default-tenant' }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query: queryMock } as unknown as TransactionClient;
    transactionMock.mockImplementation(async (callback) => callback(client));

    const orchestrator = new TriageOrchestrator();
    const internalOrchestrator = orchestrator as unknown as TriageOrchestratorInternals;
    const sessionId = await internalOrchestrator.claimOrCreateSession('legacy-ticket');

    expect(sessionId).toBeTruthy();
    expect(String(queryMock.mock.calls[1]?.[0] || '')).not.toContain('AND tenant_id = $2');
    expect(String(queryMock.mock.calls[2]?.[0] || '')).toContain('SELECT id FROM tenants');
    expect(queryMock.mock.calls[3]?.[1]?.[5]).toBe('default-tenant');
  });
});
