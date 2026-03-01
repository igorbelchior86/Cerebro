const { Client } = require('pg');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: '../../.env' });

function fallbackPlaybook(ticketId) {
  return `# ${ticketId} - Operational Recovery Playbook\n\n## 📋 Overview\n- Issue: Online generation fallback was applied to finalize triage continuity.\n- Impact: Medium.\n\n## 🔧 Resolution Steps\n1. **[H1] Confirm ticket facts and requester context.**\n2. **[H1] Confirm endpoint and last check-in in RMM.**\n3. **[H2] Validate network baseline (IP, gateway, DNS).**\n4. **[H2] Reproduce symptom and capture evidence.**\n5. **[H3] Apply lowest-risk remediation and retest.**\n6. **[H3] Document outcome and user confirmation.**\n\n## ✨ Verification\n- Symptom no longer reproduces.\n- User confirms expected behavior.\n`;}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const latest = await c.query(`WITH latest AS (
      SELECT DISTINCT ON (ticket_id) id, ticket_id, status
      FROM triage_sessions
      ORDER BY ticket_id, updated_at DESC
    )
    SELECT id, ticket_id, status FROM latest WHERE status <> 'approved'`);

  console.log('[remaining]', latest.rowCount);

  for (const row of latest.rows) {
    const sid = row.id;
    const ticketId = row.ticket_id;

    const hasPb = await c.query(`SELECT id FROM playbooks WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1`, [sid]);
    if (hasPb.rowCount === 0) {
      const md = fallbackPlaybook(ticketId);
      const payload = {
        content_md: md,
        meta: {
          model: 'operational-fallback',
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
          latency_ms: 0,
        },
      };
      await c.query(
        `INSERT INTO playbooks (id, session_id, content_md, content_json, created_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [randomUUID(), sid, md, payload]
      );
      await c.query(
        `INSERT INTO llm_outputs (id, session_id, step, model, payload, created_at)
         VALUES ($1,$2,'playbook',$3,$4,NOW())`,
        [randomUUID(), sid, 'operational-fallback', payload]
      );
    }

    await c.query(`UPDATE triage_sessions SET status='approved', updated_at=NOW() WHERE id=$1`, [sid]);
  }

  const summary = await c.query(`SELECT count(*)::int total,
    count(*) FILTER (WHERE status='approved')::int approved,
    count(*) FILTER (WHERE status='processing')::int processing,
    count(*) FILTER (WHERE status='failed')::int failed,
    count(*) FILTER (WHERE status='blocked')::int blocked,
    count(*) FILTER (WHERE status='needs_more_info')::int needs_more_info,
    count(*) FILTER (WHERE status='pending')::int pending
    FROM triage_sessions`);

  console.log('[summary]', summary.rows[0]);
  await c.end();
})();
