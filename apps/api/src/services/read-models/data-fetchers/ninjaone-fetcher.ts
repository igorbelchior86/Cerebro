import { NinjaOneClient } from '../../../clients/ninjaone.js';
import { queryOne } from '../../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';
import { operationalLogger } from '../../../lib/operational-logger.js';

type JsonRecord = Record<string, unknown>;
type NinjaOrganization = { id?: string | number; name?: string };
type NinjaDevice = { id?: string | number };
type NinjaSoftwareRow = { deviceId?: string | number };
type NinjaCredentials = { clientId: string; clientSecret: string; region?: string };

const NINJAONE_BASE: Record<string, string> = {
    us: 'https://app.ninjarmm.com',
    eu: 'https://eu.ninjarmm.com',
    oc: 'https://oc.ninjarmm.com',
};

export class NinjaOneFetcher implements DataSourceFetcher {
    name = 'ninjaone';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            operationalLogger.warn('read_model.ninjaone_fetcher.credentials_missing', {
                module: 'read-models.ninjaone-fetcher',
                integration: 'ninjaone',
                signal: 'integration_failure',
                degraded_mode: true,
            }, { ticket_id: context.ticketId || null });
            return {};
        }

        const client = new NinjaOneClient({
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            ...(creds.region ? { baseUrl: NINJAONE_BASE[creds.region] ?? NINJAONE_BASE.us } : {}),
        });

        const result: FetchResult = {
            raw: {
                ninjaDevice: null,
                ninjaAlerts: [],
            }
        };

        try {
            // In a real pipeline, we'd need a hint from Autotask or ITGlue 
            // about the specific device, user, or organization.
            // Often, the orchestrator passes ninjaoneOrgId via context.organizationIds
            let ninjaOrgId = context.organizationIds?.ninjaone;
            let ninjaOrgMatch: NinjaOrganization | null = null;

            // 1. Resolve Organization
            if (!ninjaOrgId && context.orgNameHint) {
                const orgs = await client.listOrganizations() as NinjaOrganization[];
                const target = context.orgNameHint.toLowerCase().trim();
                const matchedOrg = orgs.find((org) => org.name && org.name.toLowerCase().trim() === target) ||
                    orgs.find((org) => org.name && org.name.toLowerCase().includes(target)) ||
                    orgs.find((org) => target.includes(String(org.name || '').toLowerCase())) ||
                    null;
                ninjaOrgMatch = matchedOrg;
                if (matchedOrg?.id !== undefined) {
                    ninjaOrgId = String(matchedOrg.id);
                }
            } else if (ninjaOrgId) {
                try {
                    ninjaOrgMatch = await client.getOrganization(ninjaOrgId);
                } catch {
                    operationalLogger.warn('read_model.ninjaone_fetcher.org_fetch_failed', {
                        module: 'read-models.ninjaone-fetcher',
                        integration: 'ninjaone',
                        signal: 'integration_failure',
                        org_id: ninjaOrgId,
                        degraded_mode: true,
                    }, { ticket_id: context.ticketId || null });
                }
            }

            result.raw!.ninjaOrgMatch = ninjaOrgMatch;

            // 2. Fetch Devices, Alerts and Software
            if (ninjaOrgId) {
                const fetchResults = await Promise.allSettled([
                    client.listDevicesByOrganization(ninjaOrgId, { limit: 200 }),
                    client.listAlerts(ninjaOrgId),
                    client.querySoftware({ pageSize: 300 }),
                ]);

                const devices = fetchResults[0].status === 'fulfilled' ? fetchResults[0].value as NinjaDevice[] : [];
                const alerts = fetchResults[1].status === 'fulfilled' ? fetchResults[1].value : [];
                let software = fetchResults[2].status === 'fulfilled' ? fetchResults[2].value as NinjaSoftwareRow[] : [];

                // Filter software down to devices in this org
                const orgDeviceIds = new Set(devices.map((device) => Number(device.id)).filter(Number.isFinite));
                software = software.filter((row) => orgDeviceIds.size === 0 || orgDeviceIds.has(Number(row.deviceId)));

                result.raw!.ninjaoneDevices = devices;
                result.raw!.ninjaoneAlerts = alerts;
                result.raw!.ninjaoneSoftware = software;
            } else {
                // Fallback: fetch a global list of devices (as legacy did)
                result.raw!.ninjaoneDevices = await client.listDevices({ limit: 100 });
            }

        } catch (err) {
            operationalLogger.error('read_model.ninjaone_fetcher.fetch_failed', err, {
                module: 'read-models.ninjaone-fetcher',
                integration: 'ninjaone',
                signal: 'integration_failure',
                degraded_mode: true,
            }, { ticket_id: context.ticketId || null });
        }

        return result;
    }

    private async getCredentials(context: DataSourceContext): Promise<NinjaCredentials | null> {
        const tenantId = String(context.tenantId || '').trim();
        if (!tenantId) return null;

        try {
            const row = await queryOne<{ credentials: JsonRecord | null }>(`
      SELECT credentials
      FROM integration_credentials
      WHERE tenant_id = $1 AND service = 'ninjaone'
      ORDER BY updated_at DESC
      LIMIT 1
    `, [tenantId]);
            const credentials = row?.credentials;
            if (!credentials) return null;
            const clientId = String(credentials.clientId || '').trim();
            const clientSecret = String(credentials.clientSecret || '').trim();
            const region = String(credentials.region || '').trim().toLowerCase();
            return clientId && clientSecret
                ? { clientId, clientSecret, ...(region ? { region } : {}) }
                : null;
        } catch {
            return null;
        }
    }
}
