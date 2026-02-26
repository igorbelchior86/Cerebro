# Controlled Design-Partner Rollout Plan (Phase 5)

## Scope
- Phase 5 controlled rollout after Refresh internal validation (M1 passed).
- Tenant-by-tenant enablement using per-tenant rollout flags.
- Preserve launch policy exactly:
  - Autotask = TWO-WAY
  - IT Glue / Ninja / SentinelOne / Check Point = READ-ONLY

## Pre-Launch Gate (Must Be True Before Tenant Admission)
- [ ] Refresh internal validation exit criteria documented (launch/no-launch decision).
- [ ] P0 incidents from validation triaged and P0/P1 launch blockers closed or explicitly accepted.
- [ ] Founder runbook owner assigned for launch week support.
- [ ] Rollback contacts and communication templates prepared.
- [ ] Feature-flag rollout control endpoint reachable in dev/staging (`/manager-ops/p0/rollout/flags`).
- [ ] Dry-run rollback completed for mock tenant (feature rollback + tenant rollback).

## Tenant Cohort Waves

### Wave 0 (Internal / Refresh only)
- Goal: final operational rehearsal with real playbooks and founder support workflow.
- Enable flags only for internal tenant.
- Exit:
  - [ ] No unresolved P0 launch blockers for 48h observation window
  - [ ] Founder support load within planned threshold (see operational assumptions)

### Wave 1 (1 Design Partner)
- Goal: prove onboarding repeatability + rollback safety.
- Tenant selection criteria:
  - [ ] Uses P0 stack (Autotask + IT Glue + Ninja + SentinelOne + Check Point)
  - [ ] Has internal champion (manager/admin)
  - [ ] Accepts controlled rollout and rollback procedures
- Enablement sequence:
  1. `p0.rollout.design_partner_access`
  2. `p0.rollout.autotask.two_way_commands`
  3. `p0.rollout.manager_visibility`
  4. `p0.rollout.ai_triage_assist`
  5. `p0.rollout.enrichment.itglue`
  6. `p0.rollout.enrichment.ninja`
  7. `p0.rollout.enrichment.sentinelone`
  8. `p0.rollout.enrichment.checkpoint`
  9. `p0.rollout.automation.simulation_only` (optional, only after stability)
- Observation window:
  - [ ] First day hypercare
  - [ ] 72h incident review

### Wave 2 (Small Cohort Expansion: 2-3 Design Partners)
- Entry criteria:
  - [ ] Wave 1 stable (no unresolved P0 incidents in previous 72h)
  - [ ] Onboarding checklist completed without undocumented steps
  - [ ] Rollback dry-run repeated after any rollout tooling changes
- Rollout strategy:
  - Stagger enablement by tenant (one tenant per day max)
  - Do not overlap initial hypercare windows if founder is sole responder

## Tenant Rollout Procedure (Executable)
1. Confirm tenant ID and admin session.
2. Verify launch policy snapshot:
   - `GET /manager-ops/p0/rollout/policy`
   - Confirm non-Autotask integrations are `read_only`.
3. Capture baseline posture:
   - `GET /manager-ops/p0/rollout/flags`
   - Save JSON in incident/launch notes.
4. Enable flags in sequence using:
   - `POST /manager-ops/p0/rollout/flags/:flagKey` with `{"enabled":true,"reason":"wave-X rollout"}`
5. After each enablement:
   - Validate expected signal in UI/API for that feature.
   - Check audit/visibility surfaces for anomalies.
6. If anomaly detected:
   - Execute feature rollback (`/manager-ops/p0/rollout/rollback` mode `feature_flag`).
   - If broad issue, execute tenant rollback (`tenant_all_flags`).
7. Record final posture and hypercare owner.

## Operational Load Assumptions (Founder + AI Agents Model)
- Assumption A1: Founder can actively support only 1 tenant hypercare window at a time.
  - Test: no overlapping day-1 onboarding windows.
- Assumption A2: Founder triage capacity during launch week is <= 3 concurrent incidents (P1/P2 mixed).
  - Test: incident log count and time-to-ack dashboard/manual ledger.
- Assumption A3: AI agents can maintain runbook/docs updates same day for incidents without blocking containment.
  - Test: post-incident doc update SLA <= 24h.
- Assumption A4: Rollback execution (feature or tenant) can be completed in <= 10 minutes.
  - Test: tabletop + dry-run timing with the rollout endpoints.

## Evidence to Keep Per Tenant
- Baseline and final rollout posture JSON
- Onboarding checklist completion record
- Hypercare notes (issues, mitigations, rollback actions if any)
- Go-live signoff checklist
