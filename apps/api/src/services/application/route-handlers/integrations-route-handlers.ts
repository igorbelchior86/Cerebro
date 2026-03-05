// ─────────────────────────────────────────────────────────────
// Integrations — Credentials + Health Check
//
// PUT  /integrations/credentials/:service  — save/update creds
// GET  /integrations/credentials           — get all (secrets masked)
// GET  /integrations/health                — real connectivity check
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { query, queryOne } from '../../../db/index.js';
import { AutotaskClient } from '../../../clients/autotask.js';

const router: ExpressRouter = Router();

// ─── Types ────────────────────────────────────────────────────

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string; // auto-discovered if omitted
}

interface NinjaOneCreds {
  clientId: string;
  clientSecret: string;
  region: 'us' | 'eu' | 'oc';
}

interface ITGlueCreds {
  apiKey: string;
  region: 'us' | 'eu' | 'au';
}

type ServiceStatus = 'connected' | 'misconfigured' | 'error';

interface ServiceResult {
  name: string;
  service: string;
  status: ServiceStatus;
  detail: string;
  latencyMs?: number;
}

type CredentialRecord = Record<string, unknown>;
const MASK_PLACEHOLDER_CHAR = '•';

function isMaskedPlaceholder(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  return normalized.includes(MASK_PLACEHOLDER_CHAR);
}

function mergeCredentialPayload(existing: CredentialRecord | null, incoming: CredentialRecord): CredentialRecord {
  const merged: CredentialRecord = { ...(existing || {}) };
  for (const [key, rawValue] of Object.entries(incoming)) {
    if (rawValue === undefined || rawValue === null) continue;
    if (typeof rawValue === 'string') {
      const value = rawValue.trim();
      if (!value) continue;
      if (isMaskedPlaceholder(value)) continue;
      merged[key] = value;
      continue;
    }
    merged[key] = rawValue;
  }
  return merged;
}

function credentialsAreComplete(service: string, credentials: CredentialRecord): boolean {
  const read = (key: string): string => String(credentials[key] ?? '').trim();
  if (service === 'autotask') {
    return Boolean(read('apiIntegrationCode') && read('username') && read('secret'));
  }
  if (service === 'ninjaone') {
    return Boolean(read('clientId') && read('clientSecret'));
  }
  if (service === 'itglue') {
    return Boolean(read('apiKey'));
  }
  return false;
}

// ─── DB helpers ────────────────────────────────────────────────
// Table created by migration 002 + 006. No ensureTable() needed.

async function getCredentials<T>(tenantId: string, service: string): Promise<T | null> {
  const row = await queryOne<{ credentials: T }>(
    'SELECT credentials FROM integration_credentials WHERE tenant_id = $1 AND service = $2',
    [tenantId, service]
  );
  return row?.credentials ?? null;
}

/** Mask secrets for safe client-side display */
function mask(val?: string): string {
  if (!val) return '';
  if (val.length <= 4) return '••••';
  return val.slice(0, 2) + '••••' + val.slice(-2);
}

// ─── Connectivity checks ───────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

async function checkAutotask(creds: AutotaskCreds | null): Promise<ServiceResult> {
  if (!creds?.apiIntegrationCode || !creds?.username || !creds?.secret) {
    return { name: 'Autotask', service: 'autotask', status: 'misconfigured', detail: 'Credentials not configured' };
  }

  const t0 = Date.now();
  try {
    const client = new AutotaskClient({
      apiIntegrationCode: creds.apiIntegrationCode,
      username: creds.username,
      secret: creds.secret,
      ...(creds.zoneUrl ? { zoneUrl: creds.zoneUrl } : {}),
    });
    // Connected must mean real read path works, not only zone discovery.
    const queues = await withTimeout(client.getTicketQueues(), 8000);
    const latencyMs = Date.now() - t0;
    return {
      name: 'Autotask',
      service: 'autotask',
      status: 'connected',
      detail: `Read-only (queues ok${Array.isArray(queues) ? `: ${queues.length}` : ''})`,
      latencyMs,
    };
  } catch (err) {
    const message = String((err as Error).message || err || '');
    const detail = /401|unauthorized|authentication/i.test(message)
      ? 'Authentication failed — check credentials'
      : message;
    return { name: 'Autotask', service: 'autotask', status: 'error', detail, latencyMs: Date.now() - t0 };
  }
}

const NINJAONE_BASE: Record<string, string> = {
  us: 'https://app.ninjarmm.com',
  eu: 'https://eu.ninjarmm.com',
  oc: 'https://oc.ninjarmm.com',
};

async function checkNinjaOne(creds: NinjaOneCreds | null): Promise<ServiceResult> {
  if (!creds?.clientId || !creds?.clientSecret) {
    return { name: 'NinjaOne', service: 'ninjaone', status: 'misconfigured', detail: 'Credentials not configured' };
  }

  const base = NINJAONE_BASE[creds.region ?? 'us'] ?? NINJAONE_BASE.us;
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${base}/ws/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          scope: 'monitoring management control',
        }).toString(),
      }),
      6000
    );
    const latencyMs = Date.now() - t0;
    if (res.ok) return { name: 'NinjaOne', service: 'ninjaone', status: 'connected', detail: 'Read-only', latencyMs };
    const body = await res.json().catch(() => ({})) as { error?: string; error_description?: string };
    return {
      name: 'NinjaOne', service: 'ninjaone', status: 'error',
      detail: body.error_description ?? body.error ?? `HTTP ${res.status}`,
      latencyMs,
    };
  } catch (err) {
    return { name: 'NinjaOne', service: 'ninjaone', status: 'error', detail: (err as Error).message, latencyMs: Date.now() - t0 };
  }
}

const ITGLUE_BASE: Record<string, string> = {
  us: 'https://api.itglue.com',
  eu: 'https://api.eu.itglue.com',
  au: 'https://api.au.itglue.com',
};

async function checkITGlue(creds: ITGlueCreds | null): Promise<ServiceResult> {
  if (!creds?.apiKey) {
    return { name: 'IT Glue', service: 'itglue', status: 'misconfigured', detail: 'Credentials not configured' };
  }

  const base = ITGLUE_BASE[creds.region ?? 'us'] ?? ITGLUE_BASE.us;
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${base}/organizations?page[size]=1&page[number]=1`, {
        headers: { 'x-api-key': creds.apiKey },
      }),
      6000
    );
    const latencyMs = Date.now() - t0;
    if (res.ok) return { name: 'IT Glue', service: 'itglue', status: 'connected', detail: 'Read-only', latencyMs };
    if (res.status === 401 || res.status === 403) return { name: 'IT Glue', service: 'itglue', status: 'error', detail: 'Authentication failed — check API key', latencyMs };
    return { name: 'IT Glue', service: 'itglue', status: 'error', detail: `HTTP ${res.status}`, latencyMs };
  } catch (err) {
    return { name: 'IT Glue', service: 'itglue', status: 'error', detail: (err as Error).message, latencyMs: Date.now() - t0 };
  }
}

// ─── Routes ────────────────────────────────────────────────────
// All routes are workspace-scoped. RLS policies on integration_credentials
// ensure queries only see the current tenant's rows automatically.

/**
 * GET /integrations/credentials
 * Returns saved credentials for all services with secrets masked.
 */
router.get('/credentials', async (req, res) => {
  try {
    const tenantId = String(req.auth?.tid || '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });

    const [at, ninja, itg] = await Promise.all([
      getCredentials<AutotaskCreds>(tenantId, 'autotask'),
      getCredentials<NinjaOneCreds>(tenantId, 'ninjaone'),
      getCredentials<ITGlueCreds>(tenantId, 'itglue'),
    ]);

    res.json({
      autotask: at
        ? { configured: true, username: at.username, apiIntegrationCode: mask(at.apiIntegrationCode), secret: mask(at.secret), zoneUrl: at.zoneUrl ?? 'auto' }
        : { configured: false },
      ninjaone: ninja
        ? { configured: true, clientId: ninja.clientId, clientSecret: mask(ninja.clientSecret), region: ninja.region ?? 'us' }
        : { configured: false },
      itglue: itg
        ? { configured: true, apiKey: mask(itg.apiKey), region: itg.region ?? 'us' }
        : { configured: false },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * PUT /integrations/credentials/:service
 * Save or update credentials for a specific service.
 * tenant_id is injected via INSERT to associate rows with the tenant.
 */
router.put('/credentials/:service', async (req, res) => {
  const { service } = req.params;
  if (!['autotask', 'ninjaone', 'itglue'].includes(service)) {
    res.status(400).json({ error: `Unknown service: ${service}` });
    return;
  }

  const credentials = req.body as CredentialRecord;
  if (!credentials || typeof credentials !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object with credentials' });
    return;
  }

  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const existing = await getCredentials<CredentialRecord>(tenantId, service);
    const merged = mergeCredentialPayload(existing, credentials);
    if (service === 'ninjaone' && !String(merged.region ?? '').trim()) merged.region = 'us';
    if (service === 'itglue' && !String(merged.region ?? '').trim()) merged.region = 'us';
    if (!credentialsAreComplete(service, merged)) {
      res.status(400).json({ error: 'Missing required credential fields' });
      return;
    }
    await query(
      `INSERT INTO integration_credentials (tenant_id, service, credentials, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, service) DO UPDATE
         SET credentials = $3, updated_at = NOW()`,
      [tenantId, service, JSON.stringify(merged)]
    );
    if (service === 'autotask') {
      const creds = merged as unknown as AutotaskCreds;
      if (creds?.username && creds?.apiIntegrationCode && creds?.secret) {
        AutotaskClient.clearAuthFailureCooldownForPrincipal({
          username: creds.username,
          apiIntegrationCode: creds.apiIntegrationCode,
          secret: creds.secret,
        });
      }
    }
    res.json({ success: true, service, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /integrations/credentials/:service
 * Remove saved credentials for a service.
 */
router.delete('/credentials/:service', async (req, res) => {
  const { service } = req.params;
  try {
    const tenantId = String(req.auth?.tid || '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });
    await query('DELETE FROM integration_credentials WHERE tenant_id = $1 AND service = $2', [tenantId, service]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /integrations/health
 * Real-time connectivity check using stored DB credentials.
 * All three checks run in parallel with 6s timeout each.
 */
router.get('/health', async (req, res) => {
  try {
    const tenantId = String(req.auth?.tid || '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });

    const [atCreds, ninjaCreds, itgCreds] = await Promise.all([
      getCredentials<AutotaskCreds>(tenantId, 'autotask'),
      getCredentials<NinjaOneCreds>(tenantId, 'ninjaone'),
      getCredentials<ITGlueCreds>(tenantId, 'itglue'),
    ]);

    const results = await Promise.allSettled([
      checkAutotask(atCreds),
      checkNinjaOne(ninjaCreds),
      checkITGlue(itgCreds),
    ]);

    const services: ServiceResult[] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { name: 'Unknown', service: 'unknown', status: 'error' as ServiceStatus, detail: (r.reason as Error)?.message ?? 'Unknown error' }
    );

    const allConnected = services.every((s) => s.status === 'connected');
    const anyError = services.some((s) => s.status === 'error');
    const anyMisconfigured = services.some((s) => s.status === 'misconfigured');

    res.json({
      overall: allConnected ? 'healthy' : anyError ? 'degraded' : anyMisconfigured ? 'not_configured' : 'unknown',
      services,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
