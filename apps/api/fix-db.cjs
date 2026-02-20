const { Client } = require('pg');
require('dotenv').config({ path: '../../.env' });

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query('ALTER TABLE tickets_processed ALTER COLUMN title TYPE TEXT');
        await client.query('ALTER TABLE tickets_processed ALTER COLUMN requester TYPE TEXT');
        await client.query('ALTER TABLE tickets_processed ALTER COLUMN id TYPE TEXT');
        await client.query('ALTER TABLE tickets_raw ALTER COLUMN message_id TYPE TEXT');
        console.log('Migrated columns to TEXT successfully.');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}
run();
