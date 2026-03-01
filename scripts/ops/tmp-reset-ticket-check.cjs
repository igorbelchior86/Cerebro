const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tid = 'T20260220.0018';
  const sql = "SELECT 'sessions' AS tbl, count(*)::int AS n FROM triage_sessions WHERE ticket_id=$1 " +
    "UNION ALL SELECT 'evidence', count(*)::int FROM evidence_packs ep JOIN triage_sessions ts ON ts.id=ep.session_id WHERE ts.ticket_id=$1 " +
    "UNION ALL SELECT 'llm', count(*)::int FROM llm_outputs lo JOIN triage_sessions ts ON ts.id=lo.session_id WHERE ts.ticket_id=$1 " +
    "UNION ALL SELECT 'validation', count(*)::int FROM validation_results vr JOIN triage_sessions ts ON ts.id=vr.session_id WHERE ts.ticket_id=$1 " +
    "UNION ALL SELECT 'playbooks', count(*)::int FROM playbooks p JOIN triage_sessions ts ON ts.id=p.session_id WHERE ts.ticket_id=$1";
  const r = await c.query(sql, [tid]);
  console.log(JSON.stringify(r.rows));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
