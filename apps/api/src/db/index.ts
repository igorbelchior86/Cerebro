// ─────────────────────────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────────────────────────

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool, type PoolClient } from 'pg';
import { operationalLogger } from '../lib/operational-logger.js';

// Using process.cwd() to avoid TS1343 (import.meta error) under Jest's CommonJS transform.
// Assumes Node process runs from `apps/api` (pnpm dev, pnpm build, pnpm start)
config({ path: resolve(process.cwd(), '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://playbook:playbook_dev@localhost:5432/cerebro',
  // Let test runs exit cleanly once only idle Postgres clients remain.
  allowExitOnIdle: process.env.NODE_ENV === 'test',
});

pool.on('error', (err) => {
  operationalLogger.error('db.index.idle_client_error', err, {
    module: 'db.index',
    operation: 'pool.on.error',
  });
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (error) {
    operationalLogger.error('db.index.query_failed', error, {
      module: 'db.index',
      operation: 'query',
    });
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
      operationalLogger.error('db.index.rollback_failed', rollbackError, {
        module: 'db.index',
        operation: 'transaction.rollback',
      });
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
        operationalLogger.error('db.index.advisory_unlock_failed', unlockError, {
          module: 'db.index',
          operation: 'withTryAdvisoryLock.unlock',
        });
      }
    }
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
