// ─────────────────────────────────────────────────────────────
// Auto-seed first admin tenant using ENV vars.
// Called at server startup when no tenants exist.
// Also runnable directly: npm run -w apps/api seed:admin
// ─────────────────────────────────────────────────────────────

import { resolve } from 'path';
import { config } from 'dotenv';

// Using process.cwd() to avoid TS1343 (import.meta error) under Jest's CommonJS transform.
config({ path: resolve(process.cwd(), '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from './index.js';
import { operationalLogger } from '../lib/operational-logger.js';

interface Tenant { id: string; }

export async function autoSeedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const org = process.env.SEED_TENANT_NAME || 'My MSP';

  if (!email || !password) return; // env vars not set — skip

  try {
    const rows = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM tenants',
    );
    if (parseInt(rows[0]?.count ?? '0') > 0) return; // already seeded

    const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const password_hash = await bcrypt.hash(password, 12);
    const tenant_id = uuidv4();
    const user_id = uuidv4();

    await query('BEGIN');
    try {
      await query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', [tenant_id, org, slug]);
      await query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'owner')`,
        [user_id, tenant_id, email.toLowerCase().trim(), password_hash],
      );
      await query('COMMIT');
      operationalLogger.info('db.seed_admin.tenant_created', {
        module: 'db.seed-admin',
        tenant_id: tenant_id,
        organization: org,
      }, {
        tenant_id,
      });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (err: any) {
    // Silently skip if DB not ready yet — will succeed on next restart
    if (err.code === '42P01') {
      operationalLogger.warn('db.seed_admin.auth_tables_not_found', {
        module: 'db.seed-admin',
        signal: 'integration_failure',
        degraded_mode: true,
        error_code: err.code,
      });
    } else {
      operationalLogger.error('db.seed_admin.failed', err, {
        module: 'db.seed-admin',
        error_code: err?.code || null,
      });
    }
  }
}

// ─── Standalone runner ────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-admin.ts') || process.argv[1]?.endsWith('seed-admin.js')) {
  autoSeedAdmin()
    .then(() => {
      operationalLogger.info('db.seed_admin.done', {
        module: 'db.seed-admin',
      });
      process.exit(0);
    })
    .catch((err) => {
      operationalLogger.error('db.seed_admin.runner_failed', err, {
        module: 'db.seed-admin',
      });
      process.exit(1);
    });
}
