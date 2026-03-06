import type { IRouter } from 'express';

const queryMock = jest.fn();
const queryOneMock = jest.fn();
const transactionMock = jest.fn();
const sendInviteEmailMock = jest.fn(async () => ({ sent: true }));
const signJwtMock = jest.fn(() => 'signed-jwt');
const setSessionCookieMock = jest.fn();

jest.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  transaction: (...args: unknown[]) => transactionMock(...args),
}));

jest.mock('../../middleware/auth.js', () => ({
  signJwt: signJwtMock as unknown as (...args: unknown[]) => unknown,
  setSessionCookie: setSessionCookieMock as unknown as (...args: unknown[]) => unknown,
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
  sendInviteEmail: sendInviteEmailMock as unknown as (...args: unknown[]) => Promise<{ sent: boolean }>,
  sendPasswordResetEmail: jest.fn(),
}));

type RouterHandle = {
  handle: (
    req: {
      method: string;
      url: string;
      originalUrl: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
      auth?: Record<string, unknown>;
      ip: string;
      socket: { remoteAddress: string };
      correlation: { traceId: string; requestId: string };
      header(name: string): string | undefined;
    },
    res: {
      statusCode: number;
      status(code: number): unknown;
      json(payload: Record<string, unknown>): unknown;
      setHeader(name: string, value: string): void;
    },
    next: (error?: unknown) => void,
  ) => void;
};

async function invokeRouter(
  router: IRouter,
  input: {
    method: 'POST' | 'GET' | 'PATCH';
    url: string;
    originalUrl: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    auth?: Record<string, unknown>;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Map<string, string>(
    Object.entries(input.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const req = {
    method: input.method,
    url: input.url,
    originalUrl: input.originalUrl,
    headers: Object.fromEntries(headers),
    body: input.body || {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    correlation: { traceId: 'trace-test', requestId: 'req-test' },
    ...(input.auth ? { auth: input.auth } : {}),
    header(name: string) {
      return headers.get(name.toLowerCase());
    },
  };

  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      setHeader() {},
    };

    (router as unknown as RouterHandle).handle(req, res, (error?: unknown) => {
      if (error) reject(error);
      else resolve({ status: res.statusCode, body: {} });
    });
  });
}

describe('identity transaction boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PLATFORM_ADMIN_TOKEN = 'platform-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  it('uses a real single-client transaction when activating an invited account', async () => {
    queryOneMock.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM user_invites')) {
        return {
          id: 'invite-1',
          tenant_id: 'tenant-1',
          email: 'invitee@example.com',
          token: 'token-1',
          role: 'member',
          expires_at: '2026-03-07T00:00:00.000Z',
          used_at: null,
        } as never;
      }
      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    });

    const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        expect(params).toEqual([41023, 'invitee@example.com']);
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1')) {
        expect(params).toEqual(['invitee@example.com']);
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO users')) return { rows: [] };
      if (sql.includes('UPDATE user_invites')) return { rows: [{ id: 'invite-1' }] };
      throw new Error(`Unexpected transactional SQL: ${sql}`);
    });
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    queryMock.mockResolvedValue([]);

    const { default: authRouter } = await import('../../services/application/route-handlers/auth-route-handlers.js');

    const response = await invokeRouter(authRouter, {
      method: 'POST',
      url: '/activate-account',
      originalUrl: '/auth/activate-account',
      body: {
        token: 'token-1',
        password: 'strong-password-123',
      },
    });

    expect(response.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [41023, 'invitee@example.com'],
    );
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['tenant-1', 'invitee@example.com', 'member']),
    );
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_invites'),
      ['invite-1'],
    );
    expect(queryMock).not.toHaveBeenCalledWith('BEGIN');
    expect(queryMock).not.toHaveBeenCalledWith('COMMIT');
    expect(signJwtMock).toHaveBeenCalledTimes(1);
    expect(setSessionCookieMock).toHaveBeenCalledTimes(1);
  });

  it('blocks invite activation when the email was claimed concurrently elsewhere', async () => {
    queryOneMock.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM user_invites')) {
        return {
          id: 'invite-1',
          tenant_id: 'tenant-1',
          email: 'invitee@example.com',
          token: 'token-1',
          role: 'member',
          expires_at: '2026-03-07T00:00:00.000Z',
          used_at: null,
        } as never;
      }
      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    });

    const clientQueryMock = jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1')) {
        return { rows: [{ id: 'existing-user' }] };
      }
      throw new Error(`Unexpected transactional SQL: ${sql}`);
    });
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    queryMock.mockResolvedValue([]);

    const { default: authRouter } = await import('../../services/application/route-handlers/auth-route-handlers.js');

    const response = await invokeRouter(authRouter, {
      method: 'POST',
      url: '/activate-account',
      originalUrl: '/auth/activate-account',
      body: {
        token: 'token-1',
        password: 'strong-password-123',
      },
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Email already registered' });
    expect(clientQueryMock.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO users'))).toBe(false);
    expect(signJwtMock).not.toHaveBeenCalled();
  });

  it('uses a real single-client transaction when platform admin creates a tenant and activation invite', async () => {
    queryOneMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      if (normalized.includes('FROM tenants WHERE slug = $1')) {
        expect(params).toEqual(['acme-msp']);
        return null;
      }
      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    });

    const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        expect(params).toEqual([41023, 'owner@acme.com']);
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1')) {
        expect(params).toEqual(['owner@acme.com']);
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO tenants')) return { rows: [] };
      if (sql.includes('INSERT INTO user_invites')) return { rows: [] };
      throw new Error(`Unexpected transactional SQL: ${sql}`);
    });
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    queryMock.mockResolvedValue([]);

    const { default: platformAdminRouter } = await import('../../services/application/route-handlers/platform-admin-route-handlers.js');

    const response = await invokeRouter(platformAdminRouter, {
      method: 'POST',
      url: '/tenants',
      originalUrl: '/platform/admin/tenants',
      body: {
        tenantName: 'Acme MSP',
        ownerEmail: 'owner@acme.com',
        ownerRole: 'owner',
      },
      headers: {
        'x-platform-admin-token': 'platform-secret',
      },
    });

    expect(response.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [41023, 'owner@acme.com'],
    );
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tenants'),
      expect.arrayContaining(['Acme MSP', 'acme-msp']),
    );
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_invites'),
      expect.arrayContaining(['owner@acme.com', 'owner']),
    );
    expect(queryMock).not.toHaveBeenCalledWith('BEGIN');
    expect(queryMock).not.toHaveBeenCalledWith('COMMIT');
    expect(sendInviteEmailMock).toHaveBeenCalledTimes(1);
  });

  it('retries tenant creation with the next slug when another request grabs the base slug first', async () => {
    let slugClaimedByOtherRequest = false;

    queryOneMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      if (normalized.includes('FROM tenants WHERE slug = $1')) {
        const slug = String(params?.[0] || '');
        if (slug === 'acme-msp' && slugClaimedByOtherRequest) {
          return { id: 'tenant-existing' } as never;
        }
        if (slug === 'acme-msp' || slug === 'acme-msp-1') {
          return null;
        }
      }
      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    });

    const clientQueryMock = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO tenants') && !slugClaimedByOtherRequest) {
        slugClaimedByOtherRequest = true;
        const error = new Error('duplicate key value violates unique constraint "tenants_slug_key"') as Error & {
          code: string;
          constraint: string;
          detail: string;
        };
        error.code = '23505';
        error.constraint = 'tenants_slug_key';
        error.detail = 'Key (slug)=(acme-msp) already exists.';
        throw error;
      }
      if (sql.includes('INSERT INTO tenants')) {
        expect(params).toEqual(expect.arrayContaining(['Acme MSP', 'acme-msp-1']));
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO user_invites')) return { rows: [] };
      throw new Error(`Unexpected transactional SQL: ${sql}`);
    });
    transactionMock.mockImplementation(async (callback) => callback({ query: clientQueryMock }));
    queryMock.mockResolvedValue([]);

    const { default: platformAdminRouter } = await import('../../services/application/route-handlers/platform-admin-route-handlers.js');

    const response = await invokeRouter(platformAdminRouter, {
      method: 'POST',
      url: '/tenants',
      originalUrl: '/platform/admin/tenants',
      body: {
        tenantName: 'Acme MSP',
        ownerEmail: 'owner@acme.com',
        ownerRole: 'owner',
      },
      headers: {
        'x-platform-admin-token': 'platform-secret',
      },
    });

    expect(response.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tenants'),
      expect.arrayContaining(['Acme MSP', 'acme-msp-1']),
    );
  });
});
