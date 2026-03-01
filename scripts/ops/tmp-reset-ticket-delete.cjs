const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tid = 'T20260220.0018';
  const r = await c.query('DELETE FROM triage_sessions WHERE ticket_id = $1', [tid]);
  console.log(JSON.stringify({ deleted_sessions: r.rowCount }));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
