import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { query, closePool } = await import('./src/db/index.js');
  const { triageOrchestrator } = await import('./src/services/triage-orchestrator.js');

  const failed = await query<{ ticket_id: string }>(
    `SELECT DISTINCT ON (ticket_id) ticket_id
     FROM triage_sessions
     WHERE status IN ('failed', 'blocked', 'pending')
     ORDER BY ticket_id, updated_at DESC`
  );

  console.log('[retry] targets', failed.length);
  let ok = 0;
  let ko = 0;

  for (const row of failed) {
    const ticketId = String(row.ticket_id || '').trim();
    if (!ticketId) continue;
    try {
      await triageOrchestrator.runPipeline(ticketId, undefined, 'email');
      ok++;
      console.log(`[retry] ok ${ok}/${failed.length} ${ticketId}`);
    } catch (err: any) {
      ko++;
      console.error(`[retry] fail ${ticketId}:`, err?.message || err);
    }
  }

  const summary = await query<{ total: number; approved: number; processing: number; failed: number; blocked: number; pending: number }>(
    `SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status='approved')::int AS approved,
      count(*) FILTER (WHERE status='processing')::int AS processing,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      count(*) FILTER (WHERE status='blocked')::int AS blocked,
      count(*) FILTER (WHERE status='pending')::int AS pending
     FROM triage_sessions`
  );

  console.log('[retry] done', { ok, ko, summary: summary[0] });
  await closePool();
}

main().catch((e) => {
  console.error('[retry] fatal', e);
  process.exit(1);
});
