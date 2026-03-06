// ─────────────────────────────────────────────────────────────
// Auth Middleware — JWT verification
// ─────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import { tenantContext } from '../lib/tenantContext.js';
import { mapAuthRoleToP0Role } from '../platform/rbac.js';

export interface AuthPayload {
  sub: string;                          // user UUID
  tid: string;                          // tenant UUID
  role: 'owner' | 'admin' | 'member';
  scope: 'full' | 'mfa-pending';
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function extractCookieSession(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('pb_session' in value)) return null;
  const session = value.pb_session;
  return typeof session === 'string' && session.trim() ? session : null;
}

function isErrorWithName(value: unknown): value is { name: string } {
  return Boolean(value) && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string';
}

function extractToken(req: Request): string | null {
  // 1. httpOnly cookie (preferred)
  const cookie = extractCookieSession((req as Request & { cookies?: unknown }).cookies);
  if (cookie) return cookie;

  // 2. Bearer token fallback (for API clients / curl testing)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

/**
 * Middleware: require a fully-authenticated session (scope === 'full').
 * Attaches `req.auth` with decoded payload on success.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const payload = jwt.verify(token, secret) as AuthPayload;

    if (payload.scope !== 'full') {
      res.status(401).json({ error: 'MFA verification required' });
      return;
    }

    req.auth = payload;

    // Inject the tenant directly into the transaction scope thread
    const store = tenantContext.getStore();
    if (store && payload.tid) {
      store.tenantId = payload.tid;
      store.actorId = payload.sub;
      store.actorType = 'user';
      store.actorRole = mapAuthRoleToP0Role(payload.role);
    }

    next();
  } catch (err: unknown) {
    if (isErrorWithName(err) && err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Session expired' });
    } else {
      res.status(401).json({ error: 'Invalid session' });
    }
  }
}

/**
 * Middleware: require owner or admin role.
 * Must be used AFTER requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.auth?.role;
  if (role !== 'owner' && role !== 'admin') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  next();
}

/**
 * Sign a JWT with standard options.
 */
export function signJwt(
  payload: Omit<AuthPayload, 'iat' | 'exp'>,
  expiresIn: string | number = '7d',
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

/**
 * Set the session cookie on the response.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie('pb_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie('pb_session', { path: '/' });
}
