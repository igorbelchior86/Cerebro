# scripts/ops — Operational Scripts

These are **one-off operational scripts** used for debugging, data patching, and manual interventions in production.  
They are **not part of the application build** and should **never be imported** by app code.

> ⚠️ All scripts here require direct DB/API access. Always run in a safe, isolated environment first.

---

## Scripts

| File | Purpose | Risk | How to run |
|---|---|---|---|
| `fix-db.cjs` | Manual DB fix — repair inconsistent state | 🔴 High | `node scripts/ops/fix-db.cjs` (requires DB env) |
| `test-groq.js` | Ad hoc Groq LLM API test | 🟡 Medium | `node scripts/ops/test-groq.js` |
| `tmp-autotask-ticket-shape.ts` | Inspect Autotask ticket raw shape | 🟢 Low | `npx ts-node scripts/ops/tmp-autotask-ticket-shape.ts` |
| `tmp-check-summary.cjs` | Check summary state of tickets | 🟢 Low | `node scripts/ops/tmp-check-summary.cjs` |
| `tmp-force-approve-all.ts` | Force-approve all pending P0 sessions | 🔴 High | `npx ts-node scripts/ops/tmp-force-approve-all.ts` |
| `tmp-force-approve-remaining.cjs` | Force-approve remaining blocked sessions | 🔴 High | `node scripts/ops/tmp-force-approve-remaining.cjs` |
| `tmp-reprocess-failed.ts` | Requeue failed triage sessions | 🟡 Medium | `npx ts-node scripts/ops/tmp-reprocess-failed.ts` |
| `tmp-reset-and-reprocess-all.ts` | Reset all sessions and requeue — destructive | 🔴 High | `npx ts-node scripts/ops/tmp-reset-and-reprocess-all.ts` |
| `tmp-reset-ticket-check.cjs` | Reset a specific ticket status | 🟡 Medium | `node scripts/ops/tmp-reset-ticket-check.cjs` |
| `tmp-reset-ticket-delete.cjs` | Delete a ticket forcefully | 🔴 High | `node scripts/ops/tmp-reset-ticket-delete.cjs` |
| `tmp-ticket-report.cjs` | Generate a manual ticket report | 🟢 Low | `node scripts/ops/tmp-ticket-report.cjs` |

---

## Rules

1. **Never call these scripts from application code.**
2. **Always use `.env` from the target environment, never production without review.**
3. **Destructive scripts (High risk) require a second pair of eyes before running.**
4. **After using a script, document what changed in the relevant wiki entry.**
