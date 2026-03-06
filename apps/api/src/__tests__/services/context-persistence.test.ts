import { execute, queryOne, transaction } from '../../db/index.js';
import { persistEvidencePack, persistTicketSSOT } from '../../services/context/persistence.js';

jest.mock('../../db/index.js', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
}));

const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;
const executeMock = execute as jest.MockedFunction<typeof execute>;
const transactionMock = transaction as jest.MockedFunction<typeof transaction>;

describe('context persistence concurrency guards', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    executeMock.mockReset();
    transactionMock.mockReset();
  });

  it('serializes concurrent evidence pack writes for the same session', async () => {
    let legacySelectCount = 0;
    let releaseLegacyReads: (() => void) | null = null;
    const legacyReadsReleased = new Promise<void>((resolve) => {
      releaseLegacyReads = resolve;
    });

    queryOneMock.mockImplementation(async () => {
      legacySelectCount += 1;
      if (legacySelectCount === 2) releaseLegacyReads?.();
      await legacyReadsReleased;
      return null as never;
    });

    let legacyInsertCount = 0;
    executeMock.mockImplementation(async (sql) => {
      if (String(sql).includes('INSERT INTO evidence_packs')) {
        legacyInsertCount += 1;
      }
      return 1;
    });

    const persistedBySession = new Map<string, string>();
    let txTail = Promise.resolve();
    let transactionalInsertCount = 0;
    let transactionalUpdateCount = 0;

    transactionMock.mockImplementation(async (callback) => {
      const waitForTurn = txTail;
      let releaseTurn: (() => void) | undefined;
      txTail = new Promise<void>((resolve) => {
        releaseTurn = resolve;
      });

      await waitForTurn;
      const client = {
        query: jest.fn(async (sql: string, params?: unknown[]) => {
          const normalized = String(sql);
          if (normalized.includes('pg_advisory_xact_lock')) {
            return { rowCount: 1, rows: [] };
          }
          if (normalized.includes('UPDATE evidence_packs')) {
            const sessionId = String(params?.[1] || '');
            if (!persistedBySession.has(sessionId)) {
              return { rowCount: 0, rows: [] };
            }
            transactionalUpdateCount += 1;
            persistedBySession.set(sessionId, String(params?.[0] || ''));
            return { rowCount: 1, rows: [] };
          }
          if (normalized.includes('INSERT INTO evidence_packs')) {
            transactionalInsertCount += 1;
            persistedBySession.set(String(params?.[0] || ''), String(params?.[1] || ''));
            return { rowCount: 1, rows: [] };
          }
          throw new Error(`Unexpected SQL in test double: ${normalized}`);
        }),
      } as any;

      try {
        return await callback(client);
      } finally {
        if (releaseTurn) releaseTurn();
      }
    });

    await Promise.all([
      persistEvidencePack('session-1', { ticket: { id: 'A' } } as any),
      persistEvidencePack('session-1', { ticket: { id: 'B' } } as any),
    ]);

    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(transactionalInsertCount).toBe(1);
    expect(transactionalUpdateCount).toBe(1);
    expect(legacyInsertCount).toBe(0);
    expect(persistedBySession.get('session-1')).toContain('"id":"B"');
  });

  it('prevents a stale session from overwriting a newer SSOT artifact', async () => {
    let latestSessionId = 'session-old';
    let allowOldWrite: (() => void) | undefined;
    const oldWriteGate = new Promise<void>((resolve) => {
      allowOldWrite = resolve;
    });

    queryOneMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      if (normalized.includes('WHERE id = $1')) {
        return {
          id: String(params?.[0] || ''),
          ticket_id: 'ticket-1',
          status: 'processing',
          last_error: null,
        } as never;
      }
      if (normalized.includes('ORDER BY created_at DESC')) {
        return { id: latestSessionId } as never;
      }
      return null;
    });

    let storedSessionId: string | null = null;
    let storedPayload: string | null = null;
    let sawGuardedWrite = false;

    executeMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      const sessionId = String(params?.[1] || '');
      if (!normalized.includes('ticket_ssot')) return 1;

      if (sessionId === 'session-old') {
        await oldWriteGate;
      }

      if (normalized.includes('WITH eligible_session AS')) {
        sawGuardedWrite = true;
        if (sessionId !== latestSessionId) {
          return 0;
        }
      }

      storedSessionId = sessionId;
      storedPayload = String(params?.[2] || '');
      return 1;
    });

    transactionMock.mockResolvedValue(undefined as never);

    const oldPersist = persistTicketSSOT('ticket-1', 'session-old', { title: 'old' } as any);
    await Promise.resolve();

    latestSessionId = 'session-new';
    const newPersist = persistTicketSSOT('ticket-1', 'session-new', { title: 'new' } as any);
    await Promise.resolve();
    if (allowOldWrite) allowOldWrite();

    await Promise.all([oldPersist, newPersist]);

    expect(sawGuardedWrite).toBe(true);
    expect(storedSessionId).toBe('session-new');
    expect(storedPayload).toContain('"title":"new"');
  });
});
