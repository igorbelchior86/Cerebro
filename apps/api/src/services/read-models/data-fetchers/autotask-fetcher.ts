import { AutotaskClient } from '../../../clients/autotask.js';
import { queryOne } from '../../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';
import type { AutotaskTicket } from '@cerebro/types';
import { operationalLogger } from '../../../lib/operational-logger.js';
export class AutotaskFetcher implements DataSourceFetcher {
    name = 'autotask';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            operationalLogger.warn('read_model.autotask_fetcher.credentials_missing', {
                module: 'read-models.autotask-fetcher',
                integration: 'autotask',
                signal: 'integration_failure',
                degraded_mode: true,
            }, { ticket_id: context.ticketId || null });
            return {};
        }

        const client = new AutotaskClient({
            apiIntegrationCode: creds.apiIntegrationCode,
            username: creds.username,
            secret: creds.secret,
            zoneUrl: creds.zoneUrl,
        });

        // Discover zone if needed
        await client.discoverZone();

        const result: FetchResult = {
            raw: {
                autotaskTickets: [],
            }
        };

        try {
            // Basic ticket fetch
            const ticketIdNum = parseInt(context.ticketId, 10);
            if (!isNaN(ticketIdNum)) {
                const ticket = await client.getTicket(ticketIdNum);
                result.raw!.autotaskTickets = [ticket];

                // Example: mapping Autotask ticket to EvidencePack format
                result.ticket = {
                    id: ticket.id.toString(),
                    title: ticket.title || 'Untitled',
                    description: ticket.description || '',
                    created_at: ticket.createDate || new Date().toISOString(),
                    priority: ticket.priority === 1 ? 'Critical' : ticket.priority === 2 ? 'High' : ticket.priority === 3 ? 'Medium' : 'Low',
                    queue: ticket.queueID ? ticket.queueID.toString() : 'General',
                    category: 'Support', // Default or map from queue
                };

                // Type cast to allow fetching optional fields from Autotask that are not in the base type
                const ticketWithRefs = ticket as AutotaskTicket & { companyID?: number; contactID?: number };

                // Fetch company if available
                if (ticketWithRefs.companyID) {
                    try {
                        const company = await client.getCompany(Number(ticketWithRefs.companyID));
                        result.raw!.autotaskCompany = company;
                        result.org = {
                            id: company.id ? company.id.toString() : ticketWithRefs.companyID.toString(),
                            name: (company.companyName as string) || `Company ${ticketWithRefs.companyID}`,
                        };
                    } catch {
                        operationalLogger.warn('read_model.autotask_fetcher.company_fetch_failed', {
                            module: 'read-models.autotask-fetcher',
                            integration: 'autotask',
                            signal: 'integration_failure',
                            company_id: ticketWithRefs.companyID,
                            degraded_mode: true,
                        }, { ticket_id: context.ticketId || null });
                    }
                }

                // Fetch contact if available
                if (ticketWithRefs.contactID) {
                    try {
                        const contact = await client.getContact(Number(ticketWithRefs.contactID));
                        result.raw!.autotaskContact = contact;
                        result.user = {
                            name: (contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'Unknown'),
                            email: (contact.emailAddress as string) || '',
                        };
                    } catch {
                        operationalLogger.warn('read_model.autotask_fetcher.contact_fetch_failed', {
                            module: 'read-models.autotask-fetcher',
                            integration: 'autotask',
                            signal: 'integration_failure',
                            contact_id: ticketWithRefs.contactID,
                            degraded_mode: true,
                        }, { ticket_id: context.ticketId || null });
                    }
                }
            }
        } catch (err) {
            operationalLogger.error('read_model.autotask_fetcher.ticket_fetch_failed', err, {
                module: 'read-models.autotask-fetcher',
                integration: 'autotask',
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
        WHERE tenant_id = $1 AND service = 'autotask'
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId]);
            return row?.credentials || null;
        } catch {
            return null;
        }
    }
}
