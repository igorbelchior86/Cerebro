# Agent G P0 UI Read-Only Launch Policy UX Constraints
# What changed
- Codified frontend UX constraints for P0 UI wiring:
- Always display launch policy posture in workflow/manager surfaces
- Do not render write controls for IT Glue, Ninja, SentinelOne, or Check Point
- Treat `/manager-ops/p0/*` as admin/internal validation surfaces and render access-aware degraded states for 401/403 responses
- Render trust-layer enrichment status from audit evidence when persisted enrichment envelopes are not available for retrieval

# Why it changed
- P0 launch policy is a hard safety/business constraint and must be visible in UX to avoid implying unsupported write capabilities.
- Backend trust-layer currently persists audit/AI decision records, not reusable enrichment context envelopes, so technician context UI needed a safe/readable fallback representation.

# Impact (UI / logic / data)
- UI: Explicit `TWO-WAY` vs `READ-ONLY` badges appear in inbox, ticket context, and manager ops surfaces.
- UI: Technician context panel shows enrichment provider status/evidence via trust audit rows, including partial failure/degraded banners.
- Logic: 401/403 and endpoint failures are surfaced as operational messages instead of silent failures.
- Data: No new backend contracts introduced; frontend adapts to existing P0 data persistence boundaries.

# Files touched
- `apps/web/src/components/p0/P0InboxPage.tsx`
- `apps/web/src/components/p0/P0WorkflowTicketPage.tsx`
- `apps/web/src/components/p0/P0ManagerOpsPage.tsx`
- `apps/web/src/lib/p0-ui-client.ts`

# Date
- 2026-02-26
