# Playbook Fallback And Session Selection Fix
# What changed
- Fixed session selection in full-flow to always use the latest triage session (`ORDER BY created_at DESC LIMIT 1`).
- Fixed full-flow background behavior to re-run validation when existing validation is unsafe and no playbook exists.
- Updated validation policy to allow playbook generation when status is `needs_more_info` (still blocked when `risk_gate` exists).
- Added deterministic no-LLM fallback for Diagnose when Gemini/Groq are unavailable at runtime.
- Added deterministic no-LLM fallback for PlaybookWriter when Gemini/Groq are unavailable at runtime.
- Added startup log with non-sensitive LLM env presence (`geminiKey=yes/no`, `groqKey=yes/no`) for runtime diagnosis.

# Why it changed
- Ticket `T20260220.0012` was stuck without playbook due to reused unsafe validation and provider fallback failures.
- Existing flow could keep reusing stale/failed state and never converge to playbook-ready.

# Impact (UI / logic / data)
- UI: tickets previously stuck in pending/failed now can progress to approved with generated playbook.
- Logic: pipeline is more resilient to provider failures and stale validation state.
- Data: existing sessions can now be resumed to completion without creating duplicate sessions.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/playbook.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/diagnose.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/playbook-writer.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/index.ts

# Date
- 2026-02-20
