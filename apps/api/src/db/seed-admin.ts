// ─────────────────────────────────────────────────────────────
// Auto-seed first admin tenant using ENV vars.
// Called at server startup when no tenants exist.
// Also runnable directly: npm run -w apps/api seed:admin
// ─────────────────────────────────────────────────────────────

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../../', '.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from './index.js';

interface Tenant { id: string; }

export async function autoSeedAdmin(): Promise<void> {
  const email    = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const org      = process.env.SEED_TENANT_NAME || 'My MSP';

  if (!email || !password) return; // env vars not set — skip

  try {
    const rows = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM tenants',
    );
    if (parseInt(rows[0]?.count ?? '0') > 0) return; // already seeded

    const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const password_hash = await bcrypt.hash(password, 12);
    const tenant_id = uuidv4();
    const user_id   = uuidv4();

    await query('BEGIN');
    try {
      await query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', [tenant_id, org, slug]);
      await query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'owner')`,
        [user_id, tenant_id, email.toLowerCase().trim(), password_hash],
      );
      await query('COMMIT');
      console.log(`[SEED] Admin tenant created: "${org}" <${email}>`);
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (err: any) {
    // Silently skip if DB not ready yet — will succeed on next restart
    if (err.code === '42P01') {
      console.warn('[SEED] Auth tables not found — run DB migration 003 first');
    } else {
      console.error('[SEED] autoSeedAdmin error:', err.message);
    }
  }
}

// ─── Standalone runner ────────────────────────────────────────
if (process.argv[1] === __filename) {
  autoSeedAdmin()
    .then(() => { console.log('[SEED] Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
