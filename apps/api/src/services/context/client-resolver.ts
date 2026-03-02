// ─────────────────────────────────────────────────────────────
// Client Resolver
// Credential lookup and integration-client construction,
// extracted from PrepareContextService.
// ─────────────────────────────────────────────────────────────

import { AutotaskClient } from '../../clients/autotask.js';
import { NinjaOneClient } from '../../clients/ninjaone.js';
import { ITGlueClient } from '../../clients/itglue.js';
import { query, queryOne } from '../../db/index.js';
import type { AutotaskCreds, NinjaOneCreds, ITGlueCreds } from './prepare-context.types.js';

const NINJAONE_BASE: Record<string, string> = {
    us: 'https://app.ninjarmm.com',
    eu: 'https://eu.ninjarmm.com',
    oc: 'https://oc.ninjarmm.com',
};

const ITGLUE_BASE: Record<string, string> = {
    us: 'https://api.itglue.com',
    eu: 'https://api.eu.itglue.com',
    au: 'https://api.au.itglue.com',
};

export async function getSessionTenantId(sessionId: string): Promise<string | null> {
    const row = await queryOne<{ tenant_id: string | null }>(
        `SELECT tenant_id FROM triage_sessions WHERE id = $1 LIMIT 1`,
        [sessionId]
    );
    return row?.tenant_id || null;
}

export async function getIntegrationCredentials<T>(
    service: 'autotask' | 'ninjaone' | 'itglue',
    tenantId?: string | null
): Promise<T | null> {
    try {
        if (tenantId) {
            const tenantScoped = await queryOne<{ credentials: T }>(
                `SELECT credentials
         FROM integration_credentials
         WHERE tenant_id = $1 AND service = $2
         LIMIT 1`,
                [tenantId, service]
            );
            if (tenantScoped?.credentials) return tenantScoped.credentials;
        }

        const latest = await queryOne<{ credentials: T }>(
            `SELECT credentials
       FROM integration_credentials
       WHERE service = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
            [service]
        );
        return latest?.credentials ?? null;
    } catch {
        return null;
    }
}

export function buildAutotaskClient(creds: AutotaskCreds | null): AutotaskClient {
    const apiIntegrationCode =
        creds?.apiIntegrationCode ||
        process.env.AUTOTASK_API_INTEGRATION_CODE ||
        process.env.AUTOTASK_API_INTEGRATIONCODE ||
        '';
    const username =
        creds?.username ||
        process.env.AUTOTASK_USERNAME ||
        process.env.AUTOTASK_API_USER ||
        '';
    const secret =
        creds?.secret ||
        process.env.AUTOTASK_SECRET ||
        process.env.AUTOTASK_API_SECRET ||
        '';
    // Important: when using UI/DB credentials, avoid forcing a stale/placeholder env zone URL.
    // Let Autotask zone discovery run unless the DB credential explicitly provides zoneUrl.
    const zoneUrl = creds
        ? (creds.zoneUrl || undefined)
        : (process.env.AUTOTASK_ZONE_URL || undefined);

    return new AutotaskClient({
        apiIntegrationCode,
        username,
        secret,
        ...(zoneUrl ? { zoneUrl } : {}),
    });
}

export function buildNinjaClient(creds: NinjaOneCreds | null): NinjaOneClient {
    const clientId = creds?.clientId || process.env.NINJAONE_CLIENT_ID || '';
    const clientSecret = creds?.clientSecret || process.env.NINJAONE_CLIENT_SECRET || '';
    const region: 'us' | 'eu' | 'oc' = creds?.region ?? 'us';
    const baseUrl = NINJAONE_BASE[region];
    return new NinjaOneClient({
        clientId,
        clientSecret,
        ...(baseUrl ? { baseUrl } : {}),
    });
}

export function buildITGlueClient(creds: ITGlueCreds | null): ITGlueClient {
    const apiKey = creds?.apiKey || process.env.ITGLUE_API_KEY || '';
    const region: 'us' | 'eu' | 'au' = creds?.region ?? 'us';
    const baseUrl = ITGLUE_BASE[region];
    return new ITGlueClient({
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
    });
}

export async function resolveClientsForSession(sessionId: string): Promise<{
    autotaskClient: AutotaskClient;
    ninjaoneClient: NinjaOneClient;
    itglueClient: ITGlueClient;
    credentialScope: 'tenant' | 'workspace_fallback';
    tenantId: string | null;
}> {
    const tenantId = await getSessionTenantId(sessionId);
    const [autotaskCreds, ninjaCreds, itglueCreds] = await Promise.all([
        getIntegrationCredentials<AutotaskCreds>('autotask', tenantId),
        getIntegrationCredentials<NinjaOneCreds>('ninjaone', tenantId),
        getIntegrationCredentials<ITGlueCreds>('itglue', tenantId),
    ]);

    return {
        autotaskClient: buildAutotaskClient(autotaskCreds),
        ninjaoneClient: buildNinjaClient(ninjaCreds),
        itglueClient: buildITGlueClient(itglueCreds),
        credentialScope: tenantId ? 'tenant' : 'workspace_fallback',
        tenantId,
    };
}

export async function checkHasCompanyColumn(cache: { value: boolean | null }): Promise<boolean> {
    if (cache.value !== null) return cache.value;
    const rows = await query<{ exists: boolean }>(
        `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'tickets_processed'
         AND column_name = 'company'
     ) AS exists`
    );
    cache.value = Boolean(rows[0]?.exists);
    return cache.value;
}
