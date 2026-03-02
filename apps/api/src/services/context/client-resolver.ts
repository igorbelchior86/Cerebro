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
        if (!tenantId) return null;
        const tenantScoped = await queryOne<{ credentials: T }>(
            `SELECT credentials
       FROM integration_credentials
       WHERE tenant_id = $1 AND service = $2
       LIMIT 1`,
            [tenantId, service]
        );
        return tenantScoped?.credentials ?? null;
    } catch {
        return null;
    }
}

export function buildAutotaskClient(creds: AutotaskCreds | null): AutotaskClient {
    if (!creds?.apiIntegrationCode || !creds?.username || !creds?.secret) {
        throw new Error('Autotask credentials not configured for tenant');
    }
    const apiIntegrationCode = creds.apiIntegrationCode;
    const username = creds.username;
    const secret = creds.secret;
    const zoneUrl = creds.zoneUrl || undefined;

    return new AutotaskClient({
        apiIntegrationCode,
        username,
        secret,
        ...(zoneUrl ? { zoneUrl } : {}),
    });
}

export function buildNinjaClient(creds: NinjaOneCreds | null): NinjaOneClient {
    if (!creds?.clientId || !creds?.clientSecret) {
        throw new Error('NinjaOne credentials not configured for tenant');
    }
    const clientId = creds.clientId;
    const clientSecret = creds.clientSecret;
    const region: 'us' | 'eu' | 'oc' = creds?.region ?? 'us';
    const baseUrl = NINJAONE_BASE[region];
    return new NinjaOneClient({
        clientId,
        clientSecret,
        ...(baseUrl ? { baseUrl } : {}),
    });
}

export function buildITGlueClient(creds: ITGlueCreds | null): ITGlueClient {
    if (!creds?.apiKey) {
        throw new Error('IT Glue credentials not configured for tenant');
    }
    const apiKey = creds.apiKey;
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
    if (!tenantId) {
        throw new Error(`Session ${sessionId} has no tenant_id; refusing cross-tenant credential fallback`);
    }
    const [autotaskCreds, ninjaCreds, itglueCreds] = await Promise.all([
        getIntegrationCredentials<AutotaskCreds>('autotask', tenantId),
        getIntegrationCredentials<NinjaOneCreds>('ninjaone', tenantId),
        getIntegrationCredentials<ITGlueCreds>('itglue', tenantId),
    ]);

    return {
        autotaskClient: buildAutotaskClient(autotaskCreds),
        ninjaoneClient: buildNinjaClient(ninjaCreds),
        itglueClient: buildITGlueClient(itglueCreds),
        credentialScope: 'tenant',
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
