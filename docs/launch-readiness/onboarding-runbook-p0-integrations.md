# P0 Design-Partner Onboarding Runbook (Controlled Launch)

## Purpose
- Repeatable onboarding for a Phase 5 design partner on the P0 stack.
- Preserve P0 launch policy guardrails during onboarding and validation.

## Launch Policy Guardrail (Must Be Repeated in Every Onboarding Call)
- Autotask = TWO-WAY (managed through Cerebro)
- IT Glue = READ-ONLY
- Ninja = READ-ONLY
- SentinelOne = READ-ONLY
- Check Point = READ-ONLY

## Preconditions
- [ ] Design partner contract/approval for controlled launch and rollback windows
- [ ] Tenant created and admin user invited
- [ ] Founder has rollback authority and support contact path
- [ ] Internal validation (Refresh) marked pass for current build
- [ ] `GET /manager-ops/p0/rollout/policy` confirms launch policy unchanged

## Tenant Technical Prerequisites
- [ ] Tenant ID recorded
- [ ] Admin account with MFA enabled
- [ ] Timezone/business hours documented (for SLA interpretation)
- [ ] Escalation contacts documented (manager + technical champion)
- [ ] Test ticket(s) identified for safe onboarding validation

## Integration Checklist (P0 Stack)

### 1. Autotask (Two-Way)
- [ ] Credentials configured for tenant
- [ ] Read path validation: ticket query returns expected records
- [ ] Two-way validation (safe scope):
  - [ ] create/update/assign path tested on non-production or approved test ticket
  - [ ] changes reconcile back into Cerebro workflow state
- [ ] Retry/DLQ/degraded signal observed or simulated (at least one failure-path check)
- [ ] Manual fallback documented if command path is disabled via feature rollback

### 2. IT Glue (Read-Only)
- [ ] Credentials configured
- [ ] Organization lookup works for test tenant/company
- [ ] Read-only enrichment visible in context/evidence
- [ ] Mutation path remains rejected (explicit read-only enforcement behavior documented)
- [ ] 404/partial endpoint degradation does not block core inbox flow

### 3. Ninja (Read-Only)
- [ ] Credentials configured
- [ ] Device/alert context lookup works on known test device/ticket
- [ ] Read-only enrichment visible in context/evidence
- [ ] Mutation path remains rejected
- [ ] Degraded mode behavior confirmed (no inbox outage on provider failure)

### 4. SentinelOne (Read-Only)
- [ ] Credentials configured
- [ ] Alert/endpoint lookup returns data for test case (or explicit empty state)
- [ ] Read-only enrichment visible and provenance-labeled
- [ ] Mutation path remains rejected

### 5. Check Point (Read-Only)
- [ ] Credentials configured
- [ ] Security/network context lookup returns data for test case (or explicit empty state)
- [ ] Read-only enrichment visible and provenance-labeled
- [ ] Mutation path remains rejected

## Feature-Flag Enablement During Onboarding
- [ ] Capture pre-onboarding posture (`GET /manager-ops/p0/rollout/flags`)
- [ ] Enable in rollout order (see controlled rollout plan)
- [ ] Record each flag change reason (`onboarding wave-X`)
- [ ] Capture post-onboarding posture

## Mock Tenant Dry-Run (Required Before First External Cohort)
- [ ] Execute `pnpm --filter @playbook-brain/api exec tsx ../../scripts/p0-rollout-dry-run.ts`
- [ ] Confirm output includes frozen launch policy snapshot
- [ ] Confirm feature rollback and tenant rollback both return all flags disabled at end

## Signoff (Per Tenant)
- [ ] Founder signoff
- [ ] Tenant admin signoff
- [ ] Hypercare window scheduled
- [ ] Incident communication channel active
