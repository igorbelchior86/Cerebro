import { ITGlueClient } from '../../clients/itglue.js';
import { queryOne } from '../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';
import { resolveITGlueOrg, resolveITGlueOrgFamilyScopes } from './itglue-helpers.js';

export class ITGlueFetcher implements DataSourceFetcher {
    name = 'itglue';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            console.warn(`[ITGlueFetcher] No credentials found`);
            return {};
        }

        const client = new ITGlueClient({
            apiKey: creds.apiKey,
            baseUrl: creds.region === 'eu' ? 'https://api.eu.itglue.com' : 'https://api.itglue.com',
        });

        const result: FetchResult = {
            raw: {
                itglueAssets: [],
                itgluePasswords: [],
                itglueConfigs: [],
                docs: []
            }
        };

        try {
            let itglueOrgId = context.organizationIds?.itglue;
            let itglueOrgMatch = null;

            if (!itglueOrgId && context.orgNameHint) {
                itglueOrgMatch = await resolveITGlueOrg(client, context.orgNameHint, context.ticketText);
                if (itglueOrgMatch) {
                    itglueOrgId = itglueOrgMatch.id;
                }
            }

            if (!itglueOrgId) {
                console.log(`[ITGlueFetcher] No ITGlue Org ID mapped or resolved. Returning empty.`);
                return result;
            }

            // Pseudo-match if we already had the ID via mapping
            if (itglueOrgId && !itglueOrgMatch) {
                itglueOrgMatch = { id: itglueOrgId, name: context.orgNameHint || 'Matched ITG Org' };
            }

            const scopes = await resolveITGlueOrgFamilyScopes(client, itglueOrgMatch!, context.orgNameHint);

            // Rate-limited basic fetch (simplified from prepare-context.ts for now,
            // we will refine it or let EnrichmentEngine do the deeper dive)
            // Just fetching for the primary org scope for simplicity first
            const firstScope = scopes[0];
            const primaryScope = firstScope ? firstScope.id : undefined;
            if (!primaryScope) {
                console.log(`[ITGlueFetcher] No valid ITGlue primary scope id found.`);
                return result;
            }

            const [configs, passwords, assets, contacts, locations, domains, sslCerts, documentsRaw, runbooks] = await Promise.all([
                client.getConfigurations(primaryScope, 150).catch(() => []),
                client.getPasswords(primaryScope, 150).catch(() => []),
                client.getFlexibleAssets('any', primaryScope, 100).catch(() => []),
                client.getContacts(primaryScope, 150).catch(() => []),
                client.getLocations(primaryScope, 150).catch(() => []),
                client.getDomains(primaryScope, 150).catch(() => []),
                client.getSslCertificates(primaryScope, 150).catch(() => []),
                client.getOrganizationDocumentsRaw(primaryScope, 150).catch(() => []),
                client.getRunbooks(primaryScope).catch(() => []),
            ]);

            result.raw!.itglueConfigs = configs;
            result.raw!.itgluePasswords = passwords;
            result.raw!.itglueAssets = assets;
            result.raw!.itglueContacts = contacts;
            result.raw!.itglueLocations = locations;
            result.raw!.itglueDomains = domains;
            result.raw!.itglueSslCertificates = sslCerts;
            result.raw!.itglueDocumentsRaw = documentsRaw;
            result.raw!.itglueRunbooks = runbooks;

            result.raw!.itglueOrgMatch = itglueOrgMatch;
            result.raw!.itglueScopes = scopes;

        } catch (err) {
            console.error(`[ITGlueFetcher] Error fetching data:`, err);
        }

        return result;
    }

    private async getCredentials(context: DataSourceContext): Promise<any | null> {
        if (!context.tenantId) {
            const row = await queryOne<{ config: any }>(`
                SELECT config
                FROM integrations
                WHERE provider = 'itglue'
                AND status = 'active'
                LIMIT 1
            `);
            return row?.config || null;
        }

        const row = await queryOne<{ config: any }>(`
            SELECT config
            FROM integrations
            WHERE tenant_id = $1 AND provider = 'itglue' AND status = 'active'
        `, [context.tenantId]);

        return row?.config || null;
    }
}
