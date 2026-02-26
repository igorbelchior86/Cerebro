# Design-Partner Cohort Go-Live Readiness Checklist

## Technical Prerequisites
- [ ] P0 stack credentials configured (Autotask, IT Glue, Ninja, SentinelOne, Check Point)
- [ ] Autotask two-way test passed on approved test ticket
- [ ] All non-Autotask integrations validated as read-only in onboarding flow
- [ ] Feature-flag posture endpoints reachable and tested
- [ ] Rollback endpoints tested (feature + tenant)
- [ ] Degraded-mode behavior verified for at least one enrichment provider
- [ ] Retry/DLQ/reconciliation signals reviewed (or documented N/A with rationale)

## Operational Prerequisites
- [ ] Founder support schedule defined for hypercare
- [ ] Tenant admin + technical champion identified
- [ ] Incident communication channel active
- [ ] Manual fallback procedures agreed
- [ ] Escalation severity definitions shared (P0/P1/P2)
- [ ] Runbooks/playbooks accessible to founder and AI support workflow

## Acceptance / Launch Gates
- [ ] Controlled rollout plan attached for the tenant wave
- [ ] Onboarding checklist fully completed (no undocumented manual steps)
- [ ] Rollout dry-run evidence attached (mock tenant or staging)
- [ ] Incident tabletop exercise completed and timed
- [ ] Operational load assumptions reviewed and still valid for this wave
- [ ] Founder signoff: go-live approved

## Go-Live Day Checklist
- [ ] Capture baseline rollout posture
- [ ] Enable flags in sequence
- [ ] Validate each feature after enablement
- [ ] Record final posture + hypercare start timestamp
- [ ] Schedule first 24h review
