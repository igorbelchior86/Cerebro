const { Client } = require('pg');
require('dotenv').config({ path: '../../.env' });
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const q = `SELECT count(*)::int total,
                    count(*) FILTER (WHERE status='approved')::int approved,
                    count(*) FILTER (WHERE status='processing')::int processing,
                    count(*) FILTER (WHERE status='failed')::int failed,
                    count(*) FILTER (WHERE status='blocked')::int blocked,
                    count(*) FILTER (WHERE status='needs_more_info')::int needs_more_info,
                    count(*) FILTER (WHERE status='pending')::int pending
             FROM triage_sessions`;
  const r = await c.query(q);
  console.log(r.rows[0]);
  await c.end();
})();
