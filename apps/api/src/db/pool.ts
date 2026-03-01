/**
 * Database connection pool with optimization
 */

import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { tenantContext } from '../lib/tenantContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This module is imported before the API entrypoint can run dotenv, so load the root .env here.
config({ path: resolve(__dirname, '../../../../', '.env') });

// Suppress notice about TIME ZONE setting
const types = pg.types;
types.setTypeParser(1114, (stringValue) => {
  return new Date(stringValue + '+00:00');
});

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://playbook:playbook_dev@localhost:5432/cerebro',
  // Connection pool optimization
  max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 20,
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 30000,
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT) : 2000,
  statement_timeout: process.env.DB_STATEMENT_TIMEOUT ? parseInt(process.env.DB_STATEMENT_TIMEOUT) : 30000,
  application_name: 'cerebro-api'
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(1);
});

pool.on('connect', () => {
  console.log('[DB] New client connection established');
});

pool.on('remove', () => {
  console.log('[DB] Client connection removed');
});

/**
 * Execute query and return results (wraps in RLS transaction securely)
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  return transaction(async (client) => {
    const startTime = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 50));
    }
    return result.rows as T[];
  });
}

/**
 * Execute query and return single result
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(text, params);
  return results[0] || null;
}

/**
 * Execute insert and return inserted row (wraps in RLS transaction securely)
 */
export async function insert<T>(text: string, params?: unknown[]): Promise<T | null> {
  return transaction(async (client) => {
    const result = await client.query(text, params);
    return result.rows[0] as T || null;
  });
}

/**
 * Execute update/delete and return affected row count (wraps in RLS transaction securely)
 */
export async function execute(text: string, params?: unknown[]): Promise<number> {
  return transaction(async (client) => {
    const result = await client.query(text, params);
    return result.rowCount || 0;
  });
}

/**
 * Execute transaction with rollback on error
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const store = tenantContext.getStore();

  try {
    await client.query('BEGIN');

    // Apply RLS Context for the transaction block
    if (store?.bypassRLS) {
      await client.query(`SET LOCAL app.bypass_rls = 'on'`);
    } else if (store?.tenantId) {
      // Must use parameterized equivalent or safe escaping, 
      // but SET LOCAL doesn't easily accept parameters natively in pg.
      // Since tenantId is a UUID from our system, it's safe to interpolate.
      await client.query(`SET LOCAL app.current_tenant_id = '${store.tenantId}'`);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get database pool statistics
 */
export function getPoolStats() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount
  };
}

/**
 * Close pool and terminate all connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Connection pool closed');
}

/**
 * Health check for database
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}

export default pool;
