import { query, queryOne } from '../../db/index.js';

jest.mock('../../db/index.js', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

jest.mock('../../middleware/auth.js', () => ({
  signJwt: jest.fn(),
  setSessionCookie: jest.fn(),
  clearSessionCookie: jest.fn(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../services/read-models/runtime-settings.js', () => ({
  applyWorkspaceRuntimeSettings: jest.fn(),
}));

jest.mock('../../services/application/route-handlers/auth-saml-route-handlers.js', () => ({
  __esModule: true,
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../services/identity/mailer.js', () => ({
  sendInviteEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const queryMock = query as jest.MockedFunction<typeof query>;
const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;

describe('auth workspace settings concurrency guard', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
  });

  it('merges settings with a single atomic UPDATE and preserves concurrent patches', async () => {
    let currentSettings: Record<string, unknown> = { theme: 'light', polling: 30 };

    queryOneMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      expect(normalized).toContain("COALESCE(settings, '{}'::jsonb) || $1::jsonb");
      const patch = JSON.parse(String(params?.[0] || '{}')) as Record<string, unknown>;
      currentSettings = { ...currentSettings, ...patch };
      return { settings: { ...currentSettings } } as never;
    });

    const { __testables } = await import('../../services/application/route-handlers/auth-route-handlers.js');

    const [first, second] = await Promise.all([
      __testables.mergeWorkspaceSettings('tenant-1', { polling: 60 }),
      __testables.mergeWorkspaceSettings('tenant-1', { llm_provider: 'groq' }),
    ]);

    expect(queryMock).not.toHaveBeenCalled();
    expect(queryOneMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ theme: 'light', polling: 60 });
    expect(second).toEqual({ theme: 'light', polling: 60, llm_provider: 'groq' });
    expect(currentSettings).toEqual({ theme: 'light', polling: 60, llm_provider: 'groq' });
  });
});
