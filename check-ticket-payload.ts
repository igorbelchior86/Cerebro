import { config } from 'dotenv';
import { AutotaskClient } from './packages/integrations/src/autotask/client.js';
import { queryOne } from './apps/api/src/db/index.js';

config({ path: './apps/api/.env' });

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

    const tickets = await client.searchTickets(JSON.stringify({ op: 'eq', field: 'status', value: 1 }), 2);
    console.log('RAW TICKET SAMPLE:');
    console.log(JSON.stringify(tickets[0], null, 2));
}

main().catch(console.error);
