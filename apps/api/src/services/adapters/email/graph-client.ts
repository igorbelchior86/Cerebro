import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'isomorphic-fetch';
import { operationalLogger } from '../../../lib/operational-logger.js';

export class GraphClient {
    private msalClient: ConfidentialClientApplication | null = null;

    constructor() { }

    private getMsalClient(): ConfidentialClientApplication {
        if (!this.msalClient) {
            const clientId = process.env.GRAPH_CLIENT_ID;
            const clientSecret = process.env.GRAPH_CLIENT_SECRET;
            const tenantId = process.env.GRAPH_TENANT_ID;

            if (!clientId || !clientSecret || !tenantId) {
                operationalLogger.warn('adapters.graph_client.credentials_missing', {
                    module: 'adapters.email.graph-client',
                    integration: 'microsoft_graph',
                    signal: 'integration_failure',
                    degraded_mode: true,
                });
            }

            this.msalClient = new ConfidentialClientApplication({
                auth: {
                    clientId: clientId || '',
                    clientSecret: clientSecret || '',
                    authority: `https://login.microsoftonline.com/${tenantId}`,
                },
            });
        }
        return this.msalClient;
    }

    private async getAccessToken(): Promise<string> {
        const response = await this.getMsalClient().acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default'],
        });

        if (!response?.accessToken) {
            throw new Error('Could not acquire access token for Graph API.');
        }

        return response.accessToken;
    }

    private async getClient(): Promise<Client> {
        const accessToken = await this.getAccessToken();

        return Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            },
        });
    }

    /**
     * Fetches unread tickets from a specified mailbox filtering by sender and subject.
     * This assumes the app has application-level permissions (Mail.Read) to the mailbox.
     */
    async fetchSupportEmails(mailboxAddress: string) {
        try {
            const client = await this.getClient();

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const dateStr = twoDaysAgo.toISOString();

            // Filter for emails containing 'TICKET' in subject received in the last 2 days
            // In production, we assume application permissions `Mail.Read` allowing access to specific user's mail
            const response = await client
                .api(`/users/${mailboxAddress}/messages`)
                .filter(`contains(subject, 'TICKET') and receivedDateTime ge ${dateStr}`)
                .select('id,subject,bodyPreview,body,from,receivedDateTime')
                .top(50)
                .get();

            return response.value;
        } catch (error) {
            operationalLogger.error('adapters.graph_client.fetch_emails_failed', error, {
                module: 'adapters.email.graph-client',
                integration: 'microsoft_graph',
                signal: 'integration_failure',
                degraded_mode: true,
            });
            throw error;
        }
    }

    /**
     * Marks an email as read
     */
    async markEmailAsRead(mailboxAddress: string, messageId: string) {
        try {
            const client = await this.getClient();
            await client
                .api(`/users/${mailboxAddress}/messages/${messageId}`)
                .patch({ isRead: true });
        } catch (error) {
            operationalLogger.error('adapters.graph_client.mark_email_read_failed', error, {
                module: 'adapters.email.graph-client',
                integration: 'microsoft_graph',
                signal: 'integration_failure',
                degraded_mode: true,
            });
        }
    }
}

export const graphClient = new GraphClient();
