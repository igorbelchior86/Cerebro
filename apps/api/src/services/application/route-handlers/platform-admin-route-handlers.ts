import { Router, type Request, type Response, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../../../db/index.js';
import { tenantContext } from '../../../lib/tenantContext.js';
import { generateOpaqueToken, hashOpaqueToken, normalizeEmail } from '../../identity/security-utils.js';
import { operationalLogger } from '../../../lib/operational-logger.js';
import { sendInviteEmail } from '../../identity/mailer.js';

type TenantRow = { id: string; name: string; slug: string };
type UserRow = { id: string };

const router: IRouter = Router();

function requirePlatformAdminToken(req: Request, res: Response): string | null {
  const configured = process.env.PLATFORM_ADMIN_TOKEN;
  const provided = String(req.header('x-platform-admin-token') || '').trim();
  if (!configured || provided !== configured) {
    res.status(403).json({ error: 'Platform admin authorization required' });
    return null;
  }
  return provided;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await queryOne<TenantRow>('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!existing) return slug;
    slug = `${base}-${i++}`;
  }
}

async function writeAudit(input: {
  action: string;
  userId: string;
  tenantId: string;
  detail?: Record<string, unknown>;
  req: Request;
}): Promise<void> {
  const ipRaw = input.req.ip || input.req.socket?.remoteAddress || null;
  const ipAddress = ipRaw && ipRaw.includes(':') ? null : ipRaw;
  await query(
    `INSERT INTO audit_log (session_id, user_id, action, detail, ip_address, tenant_id, created_at)
     VALUES (NULL, $1, $2, $3, $4, $5, NOW())`,
    [
      input.userId,
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

router.post('/tenants', async (req: Request, res: Response) => {
  const token = requirePlatformAdminToken(req, res);
  if (!token) return;

  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const tenantName = String(req.body?.tenantName || '').trim();
      const ownerEmailRaw = String(req.body?.ownerEmail || '').trim();
      const ownerRole = String(req.body?.ownerRole || 'owner').trim();

      if (!tenantName || !ownerEmailRaw) {
        return res.status(400).json({ error: 'tenantName and ownerEmail are required' });
      }
      if (!['owner', 'admin', 'member'].includes(ownerRole)) {
        return res.status(400).json({ error: 'ownerRole must be owner|admin|member' });
      }

      const ownerEmail = normalizeEmail(ownerEmailRaw);
      const existingUser = await queryOne<UserRow>(
        'SELECT id FROM users WHERE lower(trim(email)) = $1',
        [ownerEmail],
      );
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const slug = await uniqueSlug(slugify(tenantName));
      const tenantId = uuidv4();
      const inviteId = uuidv4();
      const inviteToken = generateOpaqueToken();
      const inviteTokenHash = hashOpaqueToken(inviteToken);
      const createdBy = `platform-token:${token.slice(0, 6)}`;

      await query('BEGIN');
      try {
        await query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', [tenantId, tenantName, slug]);
        await query(
          `INSERT INTO user_invites (id, tenant_id, email, token, token_hash, role, created_by, invite_type, max_uses, used_count, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, 'activation', 1, 0, NOW() + INTERVAL '48 hours')`,
          [inviteId, tenantId, ownerEmail, inviteToken, inviteTokenHash, ownerRole],
        );
        await query('COMMIT');
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

      await writeAudit({
        action: 'identity.tenant.create',
        userId: createdBy,
        tenantId,
        detail: {
          tenant_name: tenantName,
          owner_email: ownerEmail,
          owner_role: ownerRole,
        },
        req,
      });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const activationUrl = `${appUrl}/activate-account?token=${inviteToken}`;
      const mail = await sendInviteEmail({
        to: ownerEmail,
        inviteUrl: activationUrl,
        role: ownerRole,
        inviterEmail: 'platform-admin@cerebro.local',
        tenantName,
      });
      return res.status(201).json({
        message: 'Tenant created with activation invite',
        tenant: { id: tenantId, name: tenantName, slug },
        invite: {
          type: 'activation',
          email: ownerEmail,
          expiresInHours: 48,
          activationUrl,
          token: inviteToken,
          smtpSent: mail.sent,
        },
      });
    } catch (err) {
      operationalLogger.error('routes.platform_admin.create_tenant.failed', err, {
        module: 'routes.platform-admin',
        route: 'POST /platform/admin/tenants',
      });
      return res.status(500).json({ error: 'Failed to create tenant' });
    }
  });
});

router.post('/tenants/:tenantId/invites', async (req: Request, res: Response) => {
  const token = requirePlatformAdminToken(req, res);
  if (!token) return;

  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const tenantId = String(req.params.tenantId || '').trim();
      const emailRaw = String(req.body?.email || '').trim();
      const role = String(req.body?.role || 'member').trim();
      if (!tenantId || !emailRaw) {
        return res.status(400).json({ error: 'tenantId and email are required' });
      }
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'role must be admin or member' });
      }

      const tenant = await queryOne<TenantRow>('SELECT id, name, slug FROM tenants WHERE id = $1', [tenantId]);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const email = normalizeEmail(emailRaw);
      const existingUser = await queryOne<UserRow>(
        'SELECT id FROM users WHERE lower(trim(email)) = $1',
        [email],
      );
      if (existingUser) return res.status(409).json({ error: 'Email already registered' });

      const inviteToken = generateOpaqueToken();
      const inviteTokenHash = hashOpaqueToken(inviteToken);
      await query(
        `INSERT INTO user_invites (tenant_id, email, token, token_hash, role, created_by, invite_type, max_uses, used_count, expires_at)
         VALUES ($1, $2, $3, $4, $5, NULL, 'add_member', 1, 0, NOW() + INTERVAL '48 hours')`,
        [tenantId, email, inviteToken, inviteTokenHash, role],
      );

      await writeAudit({
        action: 'identity.invite.create',
        userId: `platform-token:${token.slice(0, 6)}`,
        tenantId,
        detail: {
          email,
          role,
          invite_type: 'add_member',
        },
        req,
      });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const activationUrl = `${appUrl}/activate-account?token=${inviteToken}`;
      const mail = await sendInviteEmail({
        to: email,
        inviteUrl: activationUrl,
        role,
        inviterEmail: 'platform-admin@cerebro.local',
        tenantName: tenant.name,
      });
      return res.status(201).json({
        message: 'Invite created',
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        invite: {
          email,
          role,
          activationUrl,
          token: inviteToken,
          expiresInHours: 48,
          smtpSent: mail.sent,
        },
      });
    } catch (err) {
      operationalLogger.error('routes.platform_admin.create_invite.failed', err, {
        module: 'routes.platform-admin',
        route: 'POST /platform/admin/tenants/:tenantId/invites',
      });
      return res.status(500).json({ error: 'Failed to create invite' });
    }
  });
});

router.post('/seed-platform-admin', async (req: Request, res: Response) => {
  const token = requirePlatformAdminToken(req, res);
  if (!token) return;
  try {
    const email = normalizeEmail(String(req.body?.email || ''));
    if (!email) return res.status(400).json({ error: 'email is required' });
    await query(
      `INSERT INTO platform_admins (email, created_by)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email, `platform-token:${token.slice(0, 6)}`],
    );
    return res.status(201).json({ message: 'Platform admin registered', email });
  } catch (err) {
    operationalLogger.error('routes.platform_admin.seed.failed', err, {
      module: 'routes.platform-admin',
      route: 'POST /platform/admin/seed-platform-admin',
    });
    return res.status(500).json({ error: 'Failed to register platform admin' });
  }
});

export default router;
