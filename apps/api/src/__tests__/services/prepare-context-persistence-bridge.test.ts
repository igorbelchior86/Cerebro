const persistEvidencePackSharedMock = jest.fn();
const persistTicketSSOTSharedMock = jest.fn();
const persistTicketTextArtifactSharedMock = jest.fn();
const persistTicketContextAppendixSharedMock = jest.fn();

jest.mock('../../services/context/persistence.js', () => ({
  persistEvidencePack: (...args: unknown[]) => persistEvidencePackSharedMock(...args),
  persistTicketSSOT: (...args: unknown[]) => persistTicketSSOTSharedMock(...args),
  persistTicketTextArtifact: (...args: unknown[]) => persistTicketTextArtifactSharedMock(...args),
  persistTicketContextAppendix: (...args: unknown[]) => persistTicketContextAppendixSharedMock(...args),
}));

describe('legacy prepare-context persistence bridge', () => {
  beforeEach(() => {
    persistEvidencePackSharedMock.mockReset();
    persistTicketSSOTSharedMock.mockReset();
    persistTicketTextArtifactSharedMock.mockReset();
    persistTicketContextAppendixSharedMock.mockReset();

    persistEvidencePackSharedMock.mockResolvedValue(undefined);
    persistTicketSSOTSharedMock.mockResolvedValue(undefined);
    persistTicketTextArtifactSharedMock.mockResolvedValue(undefined);
    persistTicketContextAppendixSharedMock.mockResolvedValue(undefined);
  });

  it('routes legacy persistence exports through the shared concurrency-safe implementation', async () => {
    const prepareContext = await import('../../services/prepare-context.js');
    const evidencePack = { ticket: { id: 'T1' } } as Parameters<typeof prepareContext.persistEvidencePack>[1];
    const ssot = { title: 'ssot' } as Parameters<typeof prepareContext.persistTicketSSOT>[2];
    const ticketTextArtifact = { source: 'autotask' } as Parameters<typeof prepareContext.persistTicketTextArtifact>[2];
    const appendix = { summary: 'appendix' } as unknown as Parameters<typeof prepareContext.persistTicketContextAppendix>[2];

    await prepareContext.persistEvidencePack('session-1', evidencePack);
    await prepareContext.persistTicketSSOT('ticket-1', 'session-1', ssot);
    await prepareContext.persistTicketTextArtifact('ticket-1', 'session-1', ticketTextArtifact);
    await prepareContext.persistTicketContextAppendix('ticket-1', 'session-1', appendix);

    expect(persistEvidencePackSharedMock).toHaveBeenCalledWith('session-1', { ticket: { id: 'T1' } });
    expect(persistTicketSSOTSharedMock).toHaveBeenCalledWith('ticket-1', 'session-1', { title: 'ssot' });
    expect(persistTicketTextArtifactSharedMock).toHaveBeenCalledWith('ticket-1', 'session-1', { source: 'autotask' });
    expect(persistTicketContextAppendixSharedMock).toHaveBeenCalledWith('ticket-1', 'session-1', { summary: 'appendix' });
  });
});
