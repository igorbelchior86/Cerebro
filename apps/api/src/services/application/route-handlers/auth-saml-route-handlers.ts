import { Router, type Request, type Response, type IRouter } from 'express';
import { query, queryOne } from '../../../db/index.js';
import { requireAuth, requireAdmin, setSessionCookie, signJwt } from '../../../middleware/auth.js';
import { tenantContext } from '../../../lib/tenantContext.js';
import { createRelayState, normalizeEmail, parseRelayState } from '../../identity/security-utils.js';
import { createSpInitiatedLoginRequest, parseAcsResponse, type TenantSamlProviderRecord } from '../../identity/saml-service.js';
import { operationalLogger } from '../../../lib/operational-logger.js';

const router: IRouter = Router();

type TenantRecord = { id: string; slug: string };
type UserRecord = {
  id: string;
  tenant_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  totp_enabled: boolean;
};

function certificatesPreview(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    const cert = String(value || '').replace(/\s+/g, '');
    if (cert.length <= 12) return '***';
    return `${cert.slice(0, 8)}...${cert.slice(-8)}`;
  });
}

async function writeAudit(input: {
  action: string;
  userId: string;
  tenantId: string;
  req: Request;
  detail?: Record<string, unknown>;
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

async function loadProviderByTenant(
  tenantId: string,
  providerKey: string,
): Promise<TenantSamlProviderRecord | null> {
  return queryOne<TenantSamlProviderRecord>(
    `SELECT tenant_id, provider_key, enabled, sp_entity_id, acs_url, idp_entity_id, idp_sso_url,
            idp_certificates, nameid_format, attribute_mapping
     FROM tenant_saml_providers
     WHERE tenant_id = $1 AND provider_key = $2`,
    [tenantId, providerKey],
  );
}

router.get('/providers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT provider_key, enabled, sp_entity_id, acs_url, idp_entity_id, idp_sso_url,
              idp_certificates, nameid_format, attribute_mapping, updated_at
       FROM tenant_saml_providers
       WHERE tenant_id = $1
       ORDER BY provider_key ASC`,
      [req.auth!.tid],
    );

    const providers = rows.map((row) => ({
      providerKey: row.provider_key,
      enabled: Boolean(row.enabled),
      spEntityId: row.sp_entity_id,
      acsUrl: row.acs_url,
      idpEntityId: row.idp_entity_id,
      idpSsoUrl: row.idp_sso_url,
      idpCertificatesPreview: certificatesPreview(row.idp_certificates),
      nameIdFormat: row.nameid_format,
      attributeMapping: row.attribute_mapping || {},
      updatedAt: row.updated_at,
    }));

    return res.json({ providers });
  } catch (err) {
    operationalLogger.error('routes.auth.saml.providers_get.failed', err, {
      module: 'routes.auth.saml',
      route: 'GET /auth/saml/providers',
    });
    return res.status(500).json({ error: 'Failed to load SAML providers' });
  }
});

router.put('/providers/:provider', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const providerKey = String(req.params.provider || '').trim();
    const payload = req.body || {};
    const spEntityId = String(payload.entity_id_sp || '').trim();
    const acsUrl = String(payload.acs_url || '').trim();
    const idpEntityId = String(payload.idp_entity_id || '').trim();
    const idpSsoUrl = String(payload.idp_sso_url || '').trim();
    const nameIdFormat = String(
      payload.nameid_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    ).trim();
    const enabled = Boolean(payload.enabled);
    const attributeMapping =
      typeof payload.attribute_mapping === 'object' && payload.attribute_mapping
        ? payload.attribute_mapping
        : { email: 'email', first_name: 'firstName', last_name: 'lastName', groups: 'groups' };
    const idpCertInput = payload.idp_x509_cert;
    const idpCertificates = Array.isArray(idpCertInput)
      ? idpCertInput.map((c) => String(c || '').trim()).filter(Boolean)
      : [String(idpCertInput || '').trim()].filter(Boolean);

    if (!providerKey || !spEntityId || !acsUrl || !idpEntityId || !idpSsoUrl || idpCertificates.length === 0) {
      return res.status(400).json({
        error: 'provider, entity_id_sp, acs_url, idp_entity_id, idp_sso_url and idp_x509_cert are required',
      });
    }

    await query(
      `INSERT INTO tenant_saml_providers (
         tenant_id, provider_key, enabled, sp_entity_id, acs_url, idp_entity_id, idp_sso_url,
         idp_certificates, nameid_format, attribute_mapping, updated_at, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, NOW(), $11)
       ON CONFLICT (tenant_id, provider_key) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             sp_entity_id = EXCLUDED.sp_entity_id,
             acs_url = EXCLUDED.acs_url,
             idp_entity_id = EXCLUDED.idp_entity_id,
             idp_sso_url = EXCLUDED.idp_sso_url,
             idp_certificates = EXCLUDED.idp_certificates,
             nameid_format = EXCLUDED.nameid_format,
             attribute_mapping = EXCLUDED.attribute_mapping,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
      [
        req.auth!.tid,
        providerKey,
        enabled,
        spEntityId,
        acsUrl,
        idpEntityId,
        idpSsoUrl,
        JSON.stringify(idpCertificates),
        nameIdFormat,
        JSON.stringify(attributeMapping),
        req.auth!.sub,
      ],
    );

    await writeAudit({
      action: 'identity.saml.config.update',
      userId: req.auth!.sub,
      tenantId: req.auth!.tid,
      req,
      detail: {
        provider_key: providerKey,
        enabled,
      },
    });

    return res.json({ message: 'SAML provider upserted', providerKey, enabled });
  } catch (err) {
    operationalLogger.error('routes.auth.saml.providers_put.failed', err, {
      module: 'routes.auth.saml',
      route: 'PUT /auth/saml/providers/:provider',
    });
    return res.status(500).json({ error: 'Failed to upsert SAML provider' });
  }
});

router.get('/:provider/start', async (req: Request, res: Response) => {
  return tenantContext.run({ bypassRLS: true }, async () => {
    try {
      const providerKey = String(req.params.provider || '').trim();
      const tenantSlug = String(req.query.tenantSlug || '').trim();
      if (!providerKey || !tenantSlug) {
        return res.status(400).json({ error: 'provider and tenantSlug are required' });
      }

      const tenant = await queryOne<TenantRecord>(
        'SELECT id, slug FROM tenants WHERE slug = $1',
        [tenantSlug],
      );
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const provider = await loadProviderByTenant(tenant.id, providerKey);
      if (!provider || !provider.enabled) {
        return res.status(404).json({ error: 'SAML provider not found or disabled' });
      }

      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const relayState = createRelayState({
        tenantId: tenant.id,
        providerKey,
        nonce,
        samlRequestId: 'pending',
        issuedAt: Date.now(),
      });

      const login = await createSpInitiatedLoginRequest(provider, relayState);
      const signedRelayState = createRelayState({
        tenantId: tenant.id,
        providerKey,
        nonce,
        samlRequestId: login.samlRequestId,
        issuedAt: Date.now(),
      });
      const redirectUrl = login.redirectUrl.replace(
        `RelayState=${encodeURIComponent(relayState)}`,
        `RelayState=${encodeURIComponent(signedRelayState)}`,
      );

      await query(
        `INSERT INTO saml_request_replay_guard (tenant_id, provider_key, saml_request_id, assertion_id, used_at, expires_at)
         VALUES ($1, $2, $3, NULL, NOW(), NOW() + INTERVAL '10 minutes')
         ON CONFLICT (tenant_id, provider_key, saml_request_id) DO NOTHING`,
        [tenant.id, providerKey, login.samlRequestId],
      );

      await writeAudit({
        action: 'identity.saml.authn.start',
        userId: 'anonymous',
        tenantId: tenant.id,
        req,
        detail: {
          provider_key: providerKey,
          saml_request_id: login.samlRequestId,
        },
      });

      return res.redirect(302, redirectUrl);
    } catch (err) {
      operationalLogger.error('routes.auth.saml.start.failed', err, {
        module: 'routes.auth.saml',
        route: 'GET /auth/saml/:provider/start',
      });
      return res.status(500).json({ error: 'Failed to initiate SAML login' });
    }
  });
});

router.post('/:provider/acs', async (req: Request, res: Response) => {
  return tenantContext.run({ bypassRLS: true }, async () => {
    const providerKey = String(req.params.provider || '').trim();
    const relayStateRaw = String(req.body?.RelayState || req.query?.RelayState || '').trim();
    const relay = relayStateRaw ? parseRelayState(relayStateRaw) : null;
    if (!providerKey || !relay || relay.providerKey !== providerKey) {
      return res.status(400).json({ error: 'Invalid SAML RelayState' });
    }

    try {
      const provider = await loadProviderByTenant(relay.tenantId, providerKey);
      if (!provider || !provider.enabled) {
        return res.status(404).json({ error: 'SAML provider not found or disabled' });
      }

      const replayRequest = await queryOne<{ saml_request_id: string }>(
        `SELECT saml_request_id
         FROM saml_request_replay_guard
         WHERE tenant_id = $1
           AND provider_key = $2
           AND saml_request_id = $3
           AND expires_at > NOW()`,
        [relay.tenantId, providerKey, relay.samlRequestId],
      );
      if (!replayRequest) {
        return res.status(403).json({ error: 'SAML request expired or already used' });
      }

      const parsed = await parseAcsResponse(provider, req, relay.samlRequestId);
      const email = normalizeEmail(parsed.email);
      const user = await queryOne<UserRecord>(
        `SELECT id, tenant_id, email, role, totp_enabled
         FROM users
         WHERE tenant_id = $1 AND lower(trim(email)) = $2`,
        [relay.tenantId, email],
      );

      if (!user) {
        await writeAudit({
          action: 'identity.saml.user_not_provisioned',
          userId: 'anonymous',
          tenantId: relay.tenantId,
          req,
          detail: {
            provider_key: providerKey,
            email,
            saml_request_id: relay.samlRequestId,
          },
        });
        return res.status(403).json({ error: 'User is not provisioned for this tenant' });
      }

      await query(
        `UPDATE saml_request_replay_guard
         SET assertion_id = $4
         WHERE tenant_id = $1
           AND provider_key = $2
           AND saml_request_id = $3
           AND assertion_id IS NULL`,
        [relay.tenantId, providerKey, relay.samlRequestId, parsed.samlResponseId || null],
      );

      const sessionToken = signJwt({
        sub: user.id,
        tid: user.tenant_id,
        role: user.role,
        scope: 'full',
      });
      setSessionCookie(res, sessionToken);

      await writeAudit({
        action: 'identity.saml.authn.success',
        userId: user.id,
        tenantId: user.tenant_id,
        req,
        detail: {
          provider_key: providerKey,
          saml_request_id: relay.samlRequestId,
          saml_response_id: parsed.samlResponseId || null,
        },
      });

      const redirectTo = `${process.env.APP_URL || 'http://localhost:3000'}/en/triage/home`;
      return res.redirect(302, redirectTo);
    } catch (err: any) {
      await writeAudit({
        action: 'identity.saml.authn.failure',
        userId: 'anonymous',
        tenantId: relay.tenantId,
        req,
        detail: {
          provider_key: providerKey,
          saml_request_id: relay.samlRequestId,
          error: err?.message || 'unknown',
        },
      });
      operationalLogger.error('routes.auth.saml.acs.failed', err, {
        module: 'routes.auth.saml',
        route: 'POST /auth/saml/:provider/acs',
      });
      return res.status(403).json({ error: 'SAML authentication failed' });
    }
  });
});

router.post('/:provider/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await writeAudit({
      action: 'identity.saml.logout.local',
      userId: req.auth!.sub,
      tenantId: req.auth!.tid,
      req,
      detail: {
        provider_key: String(req.params.provider || '').trim(),
      },
    });
    res.clearCookie('pb_session', { path: '/' });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    operationalLogger.error('routes.auth.saml.logout.failed', err, {
      module: 'routes.auth.saml',
      route: 'POST /auth/saml/:provider/logout',
    });
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;

