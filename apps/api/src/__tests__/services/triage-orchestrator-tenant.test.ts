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

describe('TriageOrchestrator tenant-scoped claims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates poller sessions inside the provided tenant instead of defaulting to the oldest tenant', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    transactionMock.mockImplementation(async (callback: any) => callback(client as any));

    const orchestrator = new TriageOrchestrator();
    const sessionId = await (orchestrator as any).claimOrCreateSession('132939', undefined, 'tenant-9439');

    expect(sessionId).toBeTruthy();
    expect(String(client.query.mock.calls[1]?.[0] || '')).toContain('AND tenant_id = $2');
    expect(client.query.mock.calls[1]?.[1]).toEqual(['132939', 'tenant-9439']);
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(String(client.query.mock.calls[2]?.[0] || '')).toContain('INSERT INTO triage_sessions');
    expect(client.query.mock.calls[2]?.[1]?.[5]).toBe('tenant-9439');
  });

  it('keeps legacy default-tenant fallback only when no tenant context is provided', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'default-tenant' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    transactionMock.mockImplementation(async (callback: any) => callback(client as any));

    const orchestrator = new TriageOrchestrator();
    const sessionId = await (orchestrator as any).claimOrCreateSession('legacy-ticket');

    expect(sessionId).toBeTruthy();
    expect(String(client.query.mock.calls[1]?.[0] || '')).not.toContain('AND tenant_id = $2');
    expect(String(client.query.mock.calls[2]?.[0] || '')).toContain('SELECT id FROM tenants');
    expect(client.query.mock.calls[3]?.[1]?.[5]).toBe('default-tenant');
  });
});
