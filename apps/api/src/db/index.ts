// ─────────────────────────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────────────────────────

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Pool, type PoolClient } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This module is imported during bootstrap before the API entrypoint can safely hydrate env.
config({ path: resolve(__dirname, '../../../../', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://playbook:playbook_dev@localhost:5432/cerebro',
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (error) {
    console.error('[DB] Query error:', error);
    throw error;
  }
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(text, params);
  return results[0] || null;
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount || 0;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[DB] Rollback error:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function withTryAdvisoryLock<T>(
  key1: number,
  key2: number,
  callback: () => Promise<T>
): Promise<{ acquired: false } | { acquired: true; result: T }> {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lockResult = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [key1, key2]
    );
    acquired = Boolean(lockResult.rows[0]?.locked);
    if (!acquired) {
      return { acquired: false };
    }

    const result = await callback();
    return { acquired: true, result };
  } finally {
    if (acquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [key1, key2]);
      } catch (unlockError) {
        console.error('[DB] Advisory unlock error:', unlockError);
      }
    }
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
