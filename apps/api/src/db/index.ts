// ─────────────────────────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────────────────────────

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://playbook:playbook_dev@localhost:5432/playbook_brain',
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

export async function execute(text: string, params?: unknown[]): Promise<void> {
  await query(text, params);
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
