import { config } from 'dotenv';
import { AutotaskClient } from '@cerebro/integrations';
import { queryOne } from './db/index.js';

config({ path: './.env' });

async function main() {
    const row = await queryOne<{ credentials: any }>(
        `SELECT credentials FROM integration_credentials WHERE service = 'autotask' LIMIT 1`,
        []
    );
    if (!row) {
        console.log('No credentials found');
        return;
    }

    const client = new AutotaskClient({
        apiIntegrationCode: row.credentials.apiIntegrationCode,
        username: row.credentials.username,
        secret: row.credentials.secret,
        zoneUrl: row.credentials.zoneUrl,
    });

    console.log('Fetching Company 29683640...');
    try {
        const company = await client.getCompany(29683640);
        console.log('Company:', JSON.stringify(company, null, 2));
    } catch (err: any) {
        console.error('Failed to get company:', err.message);
    }

    console.log('Fetching Contact 31697515...');
    try {
        const contact = await client.getContact(31697515);
        console.log('Contact:', JSON.stringify(contact, null, 2));
    } catch (err: any) {
        console.error('Failed to get contact:', err.message);
    }
}

main().catch(console.error);
