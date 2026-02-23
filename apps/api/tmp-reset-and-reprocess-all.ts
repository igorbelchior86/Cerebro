import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, execute, closePool } from './src/db/index.js';
import { triageOrchestrator } from './src/services/triage-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  console.log('[batch] resetting all pipeline artifacts...');
  const before = await query<{ sessions: number; tickets: number }>(
    `SELECT
      (SELECT count(*)::int FROM triage_sessions) AS sessions,
      (SELECT count(*)::int FROM tickets_processed) AS tickets`
  );
  console.log('[batch] before', before[0]);

  await execute('DELETE FROM triage_sessions');

  const tickets = await query<{ id: string }>(
    `SELECT id FROM tickets_processed ORDER BY created_at ASC`
  );
  console.log('[batch] tickets_to_reprocess', tickets.length);

  let ok = 0;
  let failed = 0;
  for (const t of tickets) {
    const ticketId = String(t.id || '').trim();
    if (!ticketId) continue;
    try {
      await triageOrchestrator.runPipeline(ticketId, undefined, 'email');
      ok++;
      console.log(`[batch] done ${ok}/${tickets.length} ${ticketId}`);
    } catch (err: any) {
      failed++;
      console.error(`[batch] fail ${ticketId}:`, err?.message || err);
    }
  }

  const summary = await query<{ total_sessions: number; approved: number; processing: number; blocked: number; failed: number; pending: number }>(
    `SELECT
      count(*)::int AS total_sessions,
      count(*) FILTER (WHERE status='approved')::int AS approved,
      count(*) FILTER (WHERE status='processing')::int AS processing,
      count(*) FILTER (WHERE status='blocked')::int AS blocked,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      count(*) FILTER (WHERE status='pending')::int AS pending
     FROM triage_sessions`
  );

  console.log('[batch] completed', { ok, failed, summary: summary[0] });
}

main()
  .catch((e) => {
    console.error('[batch] fatal', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
