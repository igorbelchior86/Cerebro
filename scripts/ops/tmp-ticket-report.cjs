const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tid = 'T20260220.0018';

  const session = await c.query(`SELECT id, status, created_at, updated_at FROM triage_sessions WHERE ticket_id=$1 ORDER BY created_at DESC LIMIT 1`, [tid]);
  const sid = session.rows[0]?.id;
  if (!sid) {
    console.log(JSON.stringify({ error: 'no_session' }));
    await c.end();
    return;
  }

  const diagQ = await c.query(`SELECT payload FROM llm_outputs WHERE session_id=$1 AND step='diagnose' ORDER BY created_at DESC LIMIT 1`, [sid]);
  const playQ = await c.query(`SELECT content_md FROM playbooks WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1`, [sid]);
  const diag = diagQ.rows[0]?.payload || {};
  const md = playQ.rows[0]?.content_md || '';
  const steps = md.split('\n').filter((l) => /^\s*\d+\.\s+/.test(l));

  const coverage = {
    h1: steps.some((l) => l.toLowerCase().includes('[h1]')),
    h2: steps.some((l) => l.toLowerCase().includes('[h2]')),
    h3: steps.some((l) => l.toLowerCase().includes('[h3]')),
  };

  const out = {
    session: session.rows[0],
    topHypotheses: (diag.top_hypotheses || []).slice(0, 3).map((h) => ({ rank: h.rank, confidence: h.confidence, hypothesis: h.hypothesis })),
    checklistStepCount: steps.length,
    checklistFirstSteps: steps.slice(0, 8),
    checklistCoverageTags: coverage,
  };

  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
