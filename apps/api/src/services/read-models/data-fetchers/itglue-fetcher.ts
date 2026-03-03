import { ITGlueClient } from '../../../clients/itglue.js';
import { queryOne } from '../../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';
import { resolveITGlueOrg, resolveITGlueOrgFamilyScopes } from './itglue-helpers.js';
import { operationalLogger } from '../../../lib/operational-logger.js';

export class ITGlueFetcher implements DataSourceFetcher {
    name = 'itglue';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            operationalLogger.warn('read_model.itglue_fetcher.credentials_missing', {
                module: 'read-models.itglue-fetcher',
                integration: 'itglue',
                signal: 'integration_failure',
                degraded_mode: true,
            }, { ticket_id: context.ticketId || null });
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
                operationalLogger.info('read_model.itglue_fetcher.org_not_resolved', {
                    module: 'read-models.itglue-fetcher',
                    integration: 'itglue',
                    degraded_mode: true,
                }, { ticket_id: context.ticketId || null });
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
                operationalLogger.info('read_model.itglue_fetcher.primary_scope_missing', {
                    module: 'read-models.itglue-fetcher',
                    integration: 'itglue',
                    degraded_mode: true,
                }, { ticket_id: context.ticketId || null });
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
            operationalLogger.error('read_model.itglue_fetcher.fetch_failed', err, {
                module: 'read-models.itglue-fetcher',
                integration: 'itglue',
                signal: 'integration_failure',
                degraded_mode: true,
            }, { ticket_id: context.ticketId || null });
        }

        return result;
    }

    private async getCredentials(context: DataSourceContext): Promise<any | null> {
        const tenantId = String(context.tenantId || '').trim();
        if (!tenantId) return null;

        try {
            const row = await queryOne<{ credentials: any }>(`
                SELECT credentials
                FROM integration_credentials
                WHERE tenant_id = $1 AND service = 'itglue'
                ORDER BY updated_at DESC
                LIMIT 1
            `, [tenantId]);
            return row?.credentials || null;
        } catch {
            return null;
        }
    }
}
