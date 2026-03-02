import { NinjaOneClient } from '../../../clients/ninjaone.js';
import { queryOne } from '../../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';

export class NinjaOneFetcher implements DataSourceFetcher {
    name = 'ninjaone';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            console.warn(`[NinjaOneFetcher] No credentials found`);
            return {};
        }

        const client = new NinjaOneClient({
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
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
            let ninjaOrgMatch: any = null;

            // 1. Resolve Organization
            if (!ninjaOrgId && context.orgNameHint) {
                const orgs = await client.listOrganizations();
                const target = context.orgNameHint.toLowerCase().trim();
                ninjaOrgMatch = orgs.find((o: any) => o.name && o.name.toLowerCase().trim() === target) ||
                    orgs.find((o: any) => o.name && o.name.toLowerCase().includes(target)) ||
                    orgs.find((o: any) => target.includes(o.name && o.name.toLowerCase()));
                if (ninjaOrgMatch) {
                    ninjaOrgId = ninjaOrgMatch.id.toString();
                }
            } else if (ninjaOrgId) {
                try {
                    ninjaOrgMatch = await client.getOrganization(ninjaOrgId);
                } catch (e) {
                    console.warn(`[NinjaOneFetcher] Could not fetch org ${ninjaOrgId}:`, e);
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

                const devices = fetchResults[0].status === 'fulfilled' ? fetchResults[0].value : [];
                const alerts = fetchResults[1].status === 'fulfilled' ? fetchResults[1].value : [];
                let software = fetchResults[2].status === 'fulfilled' ? fetchResults[2].value : [];

                // Filter software down to devices in this org
                const orgDeviceIds = new Set(devices.map((d: any) => Number(d.id)).filter(Number.isFinite));
                software = software.filter((row: any) => orgDeviceIds.size === 0 || orgDeviceIds.has(Number(row.deviceId)));

                result.raw!.ninjaoneDevices = devices;
                result.raw!.ninjaoneAlerts = alerts;
                result.raw!.ninjaoneSoftware = software;
            } else {
                // Fallback: fetch a global list of devices (as legacy did)
                result.raw!.ninjaoneDevices = await client.listDevices({ limit: 100 });
            }

        } catch (err) {
            console.error(`[NinjaOneFetcher] Error fetching data:`, err);
        }

        return result;
    }

    private async getCredentials(context: DataSourceContext): Promise<any | null> {
        const tenantClause = context.tenantId ? `tenant_id = $1 AND` : '';
        const queryStr = `
      SELECT config
      FROM integrations
      WHERE ${tenantClause} provider = 'ninjaone' AND status = 'active'
      LIMIT 1
    `;
        const params = context.tenantId ? [context.tenantId] : [];

        const row = await queryOne<{ config: any }>(queryStr, params);
        return row?.config || null;
    }
}
