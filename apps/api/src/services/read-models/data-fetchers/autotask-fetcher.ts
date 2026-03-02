import { AutotaskClient } from '../../clients/autotask.js';
import { queryOne } from '../../db/index.js';
import type { DataSourceFetcher, DataSourceContext, FetchResult } from './types.js';
import type { AutotaskTicket } from '@cerebro/types';
export class AutotaskFetcher implements DataSourceFetcher {
    name = 'autotask';

    async fetch(context: DataSourceContext): Promise<FetchResult> {
        const creds = await this.getCredentials(context);
        if (!creds) {
            console.warn(`[AutotaskFetcher] No credentials found for org/tenant`);
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
                    } catch (companyErr) {
                        console.warn(`[AutotaskFetcher] Failed to fetch company ${ticketWithRefs.companyID}:`, companyErr);
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
                    } catch (contactErr) {
                        console.warn(`[AutotaskFetcher] Failed to fetch contact ${ticketWithRefs.contactID}:`, contactErr);
                    }
                }
            }
        } catch (err) {
            console.error(`[AutotaskFetcher] Failed to fetch ticket ${context.ticketId}:`, err);
        }

        return result;
    }

    private async getCredentials(context: DataSourceContext): Promise<any | null> {
        if (!context.tenantId) {
            // In Cerebro, the single tenant config is often used if no tenantId is provided, or we query by org.
            // For this fetcher, we try to load the default integration config or tenant specific.
            const row = await queryOne<{ config: any }>(`
        SELECT config
        FROM integrations
        WHERE provider = 'autotask'
        AND status = 'active'
        LIMIT 1
       `);
            return row?.config || null;
        }

        const row = await queryOne<{ config: any }>(`
      SELECT config
      FROM integrations
      WHERE tenant_id = $1 AND provider = 'autotask' AND status = 'active'
    `, [context.tenantId]);

        return row?.config || null;
    }
}
