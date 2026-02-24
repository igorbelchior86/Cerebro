# Fusion Grounding Guard + SSOT User Display Unification
# What changed
- Hardened cross-source fusion validation in `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`:
  - Added deterministic post-LLM validation for fusion resolutions (`validateFusionLlmResolutions`)
  - `evidence_refs` must exist in pipeline-generated candidate/link/inference evidence refs
  - `inference_refs` must reference deterministic pipeline-generated inference IDs
  - Identity fields (`ticket.affected_user_name`, `ticket.affected_user_email`, `identity.user_principal_name`) cannot accept new values outside known candidates unless backed by a valid deterministic inference
  - LLM-provided `links`/`inferences` are no longer merged into the audit/SSOT; only pipeline-generated deterministic links/inferences are used
- Strengthened fusion prompt wording to explicitly forbid invented systems/evidence and changed the schema example value away from a real-looking person name.
- Unified “User” display semantics across UI surfaces:
  - `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts` sidebar list mapping now derives the displayed user from SSOT using a shared rule: use `affected_user_name` only when it is specific; otherwise use `requester_name`
  - `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx` center/right panel now use the same SSOT-derived user selection logic (including local snapshot refresh path)

# Why it changed
- A critical data leakage bug occurred in `T20260223.0006`: the fusion LLM invented an unsupported inference (`internal_hr_system`) and resolved `ticket.affected_user_name = Alex Hall`, even though no evidence existed in ticket/IT Glue/Ninja data.
- The UI also showed inconsistent users across sidebar and right panel because each surface used different field precedence (`requester` vs `affected user`) without a shared SSOT display rule.

# Impact (UI / logic / data)
- UI:
  - Sidebar, center header/meta, and right context panel now converge on the same SSOT-derived “User” display logic.
  - Generic placeholders like “new employee (name not provided)” no longer override requester names in the UI user slot.
- Logic:
  - Fusion LLM output is now grounded to pipeline-generated evidence and deterministic inference IDs.
  - Unsupported/alucinated inferences can no longer overwrite SSOT identity fields.
- Data:
  - Future `ticket_ssot.fusion_audit` payloads should not contain invented evidence systems (e.g. `internal_hr_system`) unless they are explicitly modeled as pipeline sources/candidates.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/routes/email-ingestion.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
