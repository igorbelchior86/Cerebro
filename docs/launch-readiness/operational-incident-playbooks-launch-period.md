# Operational Incident Playbooks (Design-Partner Launch Period)

## Common Incident Structure (Use for All Incidents)
1. Triage
   - Identify tenant(s), affected features, first-seen time, blast radius
   - Capture `trace_id` / `tenant_id` / `ticket_id` if available
2. Containment
   - Prefer feature rollback first (`feature_flag`)
   - Escalate to tenant rollback if core flow instability or unknown blast radius
3. Communication
   - Notify tenant admin + internal log with ETA and workaround/manual fallback
4. Recovery
   - Validate expected signals and tenant posture
   - Re-enable only after root-cause confidence
5. Review
   - Document timeline, indicators, rollback used, and follow-up action

## Playbook 1: AI Triage/Handoff Quality Regression
### Symptoms
- bad routing/priority suggestions
- low-confidence spikes
- high override rate or operator distrust

### Immediate Actions
- [ ] Roll back `p0.rollout.ai_triage_assist` for affected tenant(s)
- [ ] Keep Autotask two-way and core inbox active
- [ ] Switch to manual triage (HITL only / no suggestion reliance)
- [ ] Capture examples for QA review

### Expected Signals
- Feature posture shows AI flag disabled
- Core inbox + Autotask workflow still functional
- No change in launch policy snapshot

## Playbook 2: Read-Only Enrichment Provider Degradation (IT Glue / Ninja / SentinelOne / Check Point)
### Symptoms
- timeouts/errors fetching enrichment
- noisy partial data
- degraded side-panel context

### Immediate Actions
- [ ] Roll back only affected enrichment flag(s) for tenant
- [ ] Confirm degraded mode: inbox/core UX still operational
- [ ] Verify provider remains read-only (no mutation path introduced)
- [ ] Capture provider error patterns for reconciliation/hardening

### Expected Signals
- Enrichment flag disabled, other features remain enabled
- manager visibility / audit surfaces still reachable
- no tenant-wide outage

## Playbook 3: Autotask Two-Way Command Path Instability
### Symptoms
- create/update/assign failures
- duplicate commands
- sync divergence or backlog accumulation

### Immediate Actions
- [ ] Disable `p0.rollout.autotask.two_way_commands` for affected tenant
- [ ] Communicate manual fallback (operate directly in Autotask)
- [ ] Keep read-only enrichments and visibility enabled if stable
- [ ] Check retry/DLQ/reconciliation signals and queue backlog

### Expected Signals
- Command-path feature off for tenant
- launch policy still `autotask = two_way` (policy unchanged; feature disabled only)
- Incident ticket records reference tenant + correlation IDs

## Playbook 4: Broad Tenant Instability During Onboarding/Hypercare
### Symptoms
- multiple feature surfaces failing
- unclear blast radius
- founder cannot isolate feature quickly

### Immediate Actions
- [ ] Execute `tenant_all_flags` rollback
- [ ] Fall back to manual operation + direct Autotask usage
- [ ] Stabilize and gather evidence before any re-enable

### Expected Signals
- All rollout flags disabled for tenant
- Other tenants unaffected
- Policy snapshot unchanged

## Communication Templates (Short)
### Initial Acknowledgement
- "We identified an issue affecting [feature] for tenant [tenant]. We are applying a controlled rollback now. Core operations fallback is [manual path]. Next update in [X] minutes."

### Recovery Confirmation
- "Rollback completed for [feature/tenant]. Core operations are stable. We will keep [feature] disabled while we complete root-cause review."

## Tabletop Exercise Checklist (Required Before External Cohort)
- [ ] Simulate AI feature rollback
- [ ] Simulate one enrichment rollback
- [ ] Simulate tenant-wide rollback
- [ ] Verify expected posture signals after each action
- [ ] Time each rollback and record duration
