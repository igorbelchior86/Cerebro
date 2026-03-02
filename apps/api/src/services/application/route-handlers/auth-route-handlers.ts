// ─────────────────────────────────────────────────────────────
// Auth Routes
// POST /auth/register-tenant  — legacy bootstrap path (disabled by default)
// POST /auth/login            — step 1: email + password
// POST /auth/mfa/validate     — step 2: TOTP code
// POST /auth/mfa/setup        — get TOTP QR code (requires full auth)
// POST /auth/mfa/enable       — confirm first code + activate MFA (requires full auth)
// POST /auth/logout
// GET  /auth/me
// POST /auth/invite           — owner/admin only
// POST /auth/activate-account — one-time account activation from invite token
// POST /auth/accept-invite    — deprecated alias
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response, IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../../../db/index.js';
import {
  signJwt,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireAdmin,
  type AuthPayload,
} from '../../../middleware/auth.js';
import { operationalLogger } from '../../../lib/operational-logger.js';
import { tenantContext } from '../../../lib/tenantContext.js';
import { applyWorkspaceRuntimeSettings } from '../../read-models/runtime-settings.js';
import { generateOpaqueToken, hashOpaqueToken, normalizeEmail } from '../../identity/security-utils.js';
import samlRouter from './auth-saml-route-handlers.js';

const router: IRouter = Router();

// ─── Types ───────────────────────────────────────────────────

interface Tenant { id: string; name: string; slug: string; }
interface User {
  id: string; tenant_id: string; email: string; password_hash: string;
  role: 'owner' | 'admin' | 'member'; totp_secret: string | null; totp_enabled: boolean;
  name: string | null; avatar: string | null; preferences: any;
}
interface Invite {
  id: string; tenant_id: string; email: string; token: string;
  role: 'admin' | 'member'; expires_at: string; used_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await queryOne<Tenant>('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!existing) return slug;
    slug = `${base}-${i++}`;
  }
}

function correlationFromRequest(req: Request) {
  const tenantId = String(req.auth?.tid || '').trim();
  const traceId = String(req.header('x-correlation-id') || req.header('x-trace-id') || '').trim();
  return {
    ...(tenantId ? { tenant_id: tenantId } : {}),
    ...(traceId ? { trace_id: traceId } : {}),
  };
}

async function writeIdentityAudit(input: {
  req: Request;
  tenantId: string;
  actorId: string;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const ipRaw = input.req.ip || input.req.socket?.remoteAddress || null;
  const ipAddress = ipRaw && ipRaw.includes(':') ? null : ipRaw;
  await query(
    `INSERT INTO audit_log (session_id, user_id, action, detail, ip_address, tenant_id, created_at)
     VALUES (NULL, $1, $2, $3, $4, $5, NOW())`,
    [
      input.actorId,
      input.action,
      JSON.stringify({
        ...(input.detail || {}),
        trace_id: input.req.correlation?.traceId || null,
        request_id: input.req.correlation?.requestId || null,
      }),
      ipAddress,
      input.tenantId,
    ],
  );
}

// ─── POST /auth/register-tenant ──────────────────────────────
// Open ONLY when zero tenants exist (bootstrap) or with SEED_ADMIN_TOKEN

router.post('/register-tenant', async (req: Request, res: Response) => {
  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const enableLegacyRegister = String(process.env.AUTH_ENABLE_LEGACY_REGISTER || 'false').toLowerCase() === 'true';
      if (!enableLegacyRegister) {
        return res.status(410).json({
          error: 'register-tenant is deprecated; use platform admin tenant provisioning',
        });
      }

      const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' });
      }
      if (password.length < 12) {
        return res.status(400).json({ error: 'Password must be at least 12 characters' });
      }

      // Allow bootstrap only when no tenants exist
      const rows = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM tenants');
      const count = parseInt(rows[0]?.count ?? '0');
      const bootstrapToken = process.env.SEED_ADMIN_TOKEN;
      const headerToken = req.headers['x-bootstrap-token'];

      if (count > 0) {
        if (!bootstrapToken || headerToken !== bootstrapToken) {
          return res.status(403).json({ error: 'Registration is closed. Contact your administrator.' });
        }
      }

      const slug = await uniqueSlug(slugify(name));
      const password_hash = await bcrypt.hash(password, 12);
      const tenant_id = uuidv4();
      const user_id = uuidv4();
      const normalizedEmail = normalizeEmail(email);

      // Single transaction
      await query('BEGIN');
      try {
        await query(
          'INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)',
          [tenant_id, name, slug],
        );
        await query(
          `INSERT INTO users (id, tenant_id, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'owner')`,
          [user_id, tenant_id, normalizedEmail, password_hash],
        );
        await query('COMMIT');
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

      const token = signJwt({ sub: user_id, tid: tenant_id, role: 'owner', scope: 'full' });
      setSessionCookie(res, token);

      await writeIdentityAudit({
        req,
        tenantId: tenant_id,
        actorId: user_id,
        action: 'identity.legacy_register_tenant',
        detail: {
          tenant_name: name,
          tenant_slug: slug,
          email: normalizedEmail,
        },
      });

      res.status(201).json({
        message: 'Tenant created',
        tenant: { id: tenant_id, name, slug },
        user: { id: user_id, email: normalizedEmail, role: 'owner' },
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      operationalLogger.error('routes.auth.register_tenant.failed', err, {
        module: 'routes.auth',
        route: 'POST /auth/register-tenant',
      }, correlationFromRequest(req));
      res.status(500).json({ error: 'Failed to create tenant' });
    }
  });
});

// ─── POST /auth/login ─────────────────────────────────────────
// Step 1: verify email + password. Returns full session OR mfaRequired flag.

router.post('/login', async (req: Request, res: Response) => {
  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
      }
      const normalizedEmail = normalizeEmail(email);

      const user = await queryOne<User>(
        'SELECT * FROM users WHERE lower(trim(email)) = $1',
        [normalizedEmail],
      );

      // Use constant-time comparison to prevent timing attacks
      const dummyHash = '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhash';
      const valid = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, dummyHash);

      if (!user || !valid) {
        await query(
          `INSERT INTO audit_log (session_id, user_id, action, detail, ip_address, tenant_id, created_at)
           VALUES (NULL, 'anonymous', 'identity.login.failure', $1, NULL, NULL, NOW())`,
          [JSON.stringify({ email: normalizedEmail, reason: 'invalid_credentials' })],
        );
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.totp_enabled) {
        // Issue a short-lived temp token for MFA step
        const tempToken = signJwt(
          { sub: user.id, tid: user.tenant_id, role: user.role, scope: 'mfa-pending' },
          '5m',
        );
        await writeIdentityAudit({
          req,
          tenantId: user.tenant_id,
          actorId: user.id,
          action: 'identity.login.mfa_pending',
          detail: { email: user.email },
        });
        return res.json({ mfaRequired: true, tempToken });
      }

      // No MFA — issue full session
      const token = signJwt({ sub: user.id, tid: user.tenant_id, role: user.role, scope: 'full' });
      setSessionCookie(res, token);
      await writeIdentityAudit({
        req,
        tenantId: user.tenant_id,
        actorId: user.id,
        action: 'identity.login.success',
        detail: { email: user.email, method: 'password' },
      });
      res.json({
        user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id, mfaEnabled: false },
      });
    } catch (err) {
      operationalLogger.error('routes.auth.login.failed', err, {
        module: 'routes.auth',
        route: 'POST /auth/login',
      }, correlationFromRequest(req));
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

// ─── POST /auth/mfa/validate ──────────────────────────────────
// Step 2: verify TOTP code using the temp token from /login

router.post('/mfa/validate', async (req: Request, res: Response) => {
  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const { tempToken, code } = req.body as { tempToken?: string; code?: string };
      if (!tempToken || !code) {
        return res.status(400).json({ error: 'tempToken and code are required' });
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

      let payload: AuthPayload;
      try {
        const jwt = await import('jsonwebtoken');
        payload = jwt.default.verify(tempToken, secret) as AuthPayload;
      } catch {
        return res.status(401).json({ error: 'Invalid or expired MFA token' });
      }

      if (payload.scope !== 'mfa-pending') {
        return res.status(401).json({ error: 'Invalid token scope' });
      }

      const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [payload.sub]);
      if (!user?.totp_secret || !user.totp_enabled) {
        return res.status(401).json({ error: 'MFA not configured' });
      }

      const valid = authenticator.verify({ token: code.replace(/\s/g, ''), secret: user.totp_secret });
      if (!valid) {
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }

      const sessionToken = signJwt({ sub: user.id, tid: user.tenant_id, role: user.role, scope: 'full' });
      setSessionCookie(res, sessionToken);
      res.json({
        user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id, mfaEnabled: true },
      });
    } catch (err) {
      operationalLogger.error('routes.auth.mfa_validate.failed', err, {
        module: 'routes.auth',
        route: 'POST /auth/mfa/validate',
      }, correlationFromRequest(req));
      res.status(500).json({ error: 'MFA validation failed' });
    }
  });
});

// ─── POST /auth/mfa/setup ─────────────────────────────────────
// Returns TOTP secret + QR code URL (does NOT activate MFA yet)

router.post('/mfa/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.sub;
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.totp_enabled) return res.status(409).json({ error: 'MFA is already enabled' });

    const secret = authenticator.generateSecret();
    // Store secret (not yet enabled — enabled after first successful verify)
    await query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, userId]);

    const otpauthUrl = authenticator.keyuri(user.email, 'Cerebro', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({ secret, qrDataUrl, otpauthUrl });
  } catch (err) {
    operationalLogger.error('routes.auth.mfa_setup.failed', err, {
      module: 'routes.auth',
      route: 'POST /auth/mfa/setup',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'MFA setup failed' });
  }
});

// ─── POST /auth/mfa/enable ────────────────────────────────────
// Confirms first TOTP code and activates MFA on the account

router.post('/mfa/enable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: 'code is required' });

    const userId = req.auth!.sub;
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_secret) return res.status(400).json({ error: 'Run /auth/mfa/setup first' });
    if (user.totp_enabled) return res.status(409).json({ error: 'MFA already enabled' });

    const valid = authenticator.verify({ token: code.replace(/\s/g, ''), secret: user.totp_secret });
    if (!valid) return res.status(401).json({ error: 'Invalid TOTP code' });

    await query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [userId]);
    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    operationalLogger.error('routes.auth.mfa_enable.failed', err, {
      module: 'routes.auth',
      route: 'POST /auth/mfa/enable',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

// ─── POST /auth/mfa/disable ───────────────────────────────────

router.post('/mfa/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) return res.status(400).json({ error: 'password is required to disable MFA' });

    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [req.auth!.sub]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    await query('UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1', [user.id]);
    res.json({ message: 'MFA disabled' });
  } catch (err) {
    operationalLogger.error('routes.auth.mfa_disable.failed', err, {
      module: 'routes.auth',
      route: 'POST /auth/mfa/disable',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await queryOne<User & { tenant_name: string; tenant_slug: string }>(
      `SELECT u.id, u.email, u.role, u.totp_enabled, u.created_at, u.name, u.avatar, u.preferences,
              t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.auth!.sub],
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      preferences: user.preferences || {},
      role: user.role,
      mfaEnabled: user.totp_enabled,
      createdAt: (user as any).created_at,
      tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug },
    });
  } catch (err) {
    operationalLogger.error('routes.auth.me_get.failed', err, {
      module: 'routes.auth',
      route: 'GET /auth/me',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── PATCH /auth/me/profile ───────────────────────────────────

router.patch('/me/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, avatar, preferences } = req.body;
    const userId = req.auth!.sub;

    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${queryIndex++}`);
      values.push(name);
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${queryIndex++}`);
      values.push(avatar);
    }
    if (preferences !== undefined) {
      updates.push(`preferences = $${queryIndex++}`);
      values.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const queryStr = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING id, name, avatar, preferences`;

    const result = await query(queryStr, values);
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated', profile: result[0] });
  } catch (err) {
    operationalLogger.error('routes.auth.me_profile_patch.failed', err, {
      module: 'routes.auth',
      route: 'PATCH /auth/me/profile',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── POST /auth/logout ────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ message: 'Logged out' });
});

// ─── POST /auth/invite ────────────────────────────────────────

router.post('/invite', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, role = 'member' } = req.body as { email?: string; role?: string };
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or member' });
    }

    const tenantId = req.auth!.tid;
    const invitedBy = req.auth!.sub;
    const normalizedEmail = normalizeEmail(email);

    // Check user doesn't already exist in this tenant
    const existing = await queryOne<User>(
      'SELECT id FROM users WHERE lower(trim(email)) = $1',
      [normalizedEmail],
    );
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    await query(
      `INSERT INTO user_invites (tenant_id, email, token, token_hash, role, created_by, invite_type, max_uses, used_count)
       VALUES ($1, $2, $3, $4, $5, $6, 'add_member', 1, 0)`,
      [tenantId, normalizedEmail, token, tokenHash, role, invitedBy],
    );

    // In production you'd email this link. For now, return it directly.
    const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/activate-account?token=${token}`;
    await writeIdentityAudit({
      req,
      tenantId,
      actorId: invitedBy,
      action: 'identity.invite.create',
      detail: {
        email: normalizedEmail,
        role,
        invite_type: 'add_member',
      },
    });
    res.json({ message: 'Invite created', inviteUrl, token });
  } catch (err) {
    operationalLogger.error('routes.auth.invite.failed', err, {
      module: 'routes.auth',
      route: 'POST /auth/invite',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// ─── POST /auth/activate-account ──────────────────────────────

async function activateAccountFromInvite(req: Request, res: Response): Promise<Response | void> {
  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const { token, password } = req.body as { token?: string; password?: string };
      if (!token || !password) {
        return res.status(400).json({ error: 'token and password are required' });
      }
      if (password.length < 12) {
        return res.status(400).json({ error: 'Password must be at least 12 characters' });
      }

      const tokenHash = hashOpaqueToken(token);
      const invite = await queryOne<Invite>(
        `SELECT * FROM user_invites
         WHERE (token_hash = $1 OR token = $2)
           AND revoked_at IS NULL
           AND used_count < max_uses
           AND used_at IS NULL
           AND expires_at > NOW()`,
        [tokenHash, token],
      );
      if (!invite) return res.status(404).json({ error: 'Invite not found or expired' });

      const password_hash = await bcrypt.hash(password, 12);
      const userId = uuidv4();

      await query('BEGIN');
      try {
        await query(
          `INSERT INTO users (id, tenant_id, email, password_hash, role)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, invite.tenant_id, normalizeEmail(invite.email), password_hash, invite.role],
        );
        const consume = await query<{ id: string }>(
          `UPDATE user_invites
           SET used_at = NOW(), used_count = used_count + 1
           WHERE id = $1 AND used_at IS NULL AND used_count < max_uses
           RETURNING id`,
          [invite.id],
        );
        if (consume.length === 0) {
          throw new Error('Invite token already consumed');
        }
        await query('COMMIT');
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

      const sessionToken = signJwt({
        sub: userId, tid: invite.tenant_id, role: invite.role, scope: 'full',
      });
      setSessionCookie(res, sessionToken);

      await writeIdentityAudit({
        req,
        tenantId: invite.tenant_id,
        actorId: userId,
        action: 'identity.account.activate',
        detail: {
          email: normalizeEmail(invite.email),
          role: invite.role,
          invite_id: invite.id,
        },
      });
      res.status(201).json({
        message: 'Account created',
        user: { id: userId, email: normalizeEmail(invite.email), role: invite.role },
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      operationalLogger.error('routes.auth.activate_account.failed', err, {
        module: 'routes.auth',
        route: 'POST /auth/activate-account',
      }, correlationFromRequest(req));
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  });
}

router.post('/activate-account', activateAccountFromInvite);

// Deprecated alias maintained for backward compatibility.
router.post('/accept-invite', activateAccountFromInvite);

// ─── GET /auth/team ───────────────────────────────────────────
// Returns all users in the current tenant (RLS enforces isolation)

router.get('/team', requireAuth, async (req: Request, res: Response) => {
  try {
    const members = await query<{
      id: string; email: string; name?: string; role: string; created_at: string;
    }>(
      `SELECT id, email, name, role, created_at
       FROM users
       ORDER BY created_at ASC`,
      [],
    );
    res.json(members);
  } catch (err) {
    operationalLogger.error('routes.auth.team_get.failed', err, {
      module: 'routes.auth',
      route: 'GET /auth/team',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// ─── GET /auth/workspace/settings ─────────────────────────────
// Returns the workspace-level settings (LLM, polling, etc.) for the current tenant.

router.get('/workspace/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<{ settings: Record<string, any> }>(
      'SELECT settings FROM tenants WHERE id = $1',
      [req.auth!.tid],
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant.settings || {});
  } catch (err) {
    operationalLogger.error('routes.auth.workspace_settings_get.failed', err, {
      module: 'routes.auth',
      route: 'GET /auth/workspace/settings',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to fetch workspace settings' });
  }
});

// ─── PATCH /auth/workspace/settings ───────────────────────────
// Update workspace-level settings. Only owner/admin can modify.

router.patch('/workspace/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    // Merge with existing settings (shallow merge)
    const tenant = await queryOne<{ settings: Record<string, any> }>(
      'SELECT settings FROM tenants WHERE id = $1',
      [req.auth!.tid],
    );
    const merged = { ...(tenant?.settings || {}), ...newSettings };

    await query(
      'UPDATE tenants SET settings = $1 WHERE id = $2',
      [JSON.stringify(merged), req.auth!.tid],
    );

    // Apply to current API process immediately (no restart required).
    applyWorkspaceRuntimeSettings(merged);

    res.json({ message: 'Workspace settings updated', settings: merged });
  } catch (err) {
    operationalLogger.error('routes.auth.workspace_settings_patch.failed', err, {
      module: 'routes.auth',
      route: 'PATCH /auth/workspace/settings',
    }, correlationFromRequest(req));
    res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

// ─── SAML Auth (tenant-scoped) ───────────────────────────────
router.use('/saml', samlRouter);

export default router;
