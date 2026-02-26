# Feature-Flag Rollout / Rollback Procedures (Per Tenant)

## Endpoints (Admin + Tenant-Scoped)
- `GET /manager-ops/p0/rollout/policy`
- `GET /manager-ops/p0/rollout/flags`
- `POST /manager-ops/p0/rollout/flags/:flagKey`
- `POST /manager-ops/p0/rollout/rollback`

All endpoints require authenticated admin/owner session and use `req.auth.tid` tenant context.

## Procedure: Inspect Policy + Posture
1. `GET /manager-ops/p0/rollout/policy`
2. Verify response:
   - `autotask = two_way`
   - `itglue/ninja/sentinelone/checkpoint = read_only`
3. `GET /manager-ops/p0/rollout/flags`
4. Record:
   - `summary.enabled_flags`
   - `recent_changes`
   - target flag states

## Procedure: Enable a Flag
```bash
curl -X POST "$API_URL/manager-ops/p0/rollout/flags/p0.rollout.ai_triage_assist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"reason":"wave-1 onboarding"}'
```

Validation after enable:
- [ ] `GET /manager-ops/p0/rollout/flags` shows `enabled=true`
- [ ] feature behavior appears for the same tenant only
- [ ] no launch policy change in `/rollout/policy`

## Procedure: Feature Rollback (Single Flag)
```bash
curl -X POST "$API_URL/manager-ops/p0/rollout/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"feature_flag","flag_key":"p0.rollout.ai_triage_assist","reason":"incident containment"}'
```

Use when:
- AI behavior quality regression
- integration enrichment causing latency/noise
- manager visibility route instability isolated to one feature surface

## Procedure: Tenant Rollback (All Rollout Flags)
```bash
curl -X POST "$API_URL/manager-ops/p0/rollout/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"tenant_all_flags","reason":"tenant-level rollback during launch incident"}'
```

Expected result:
- all rollout flags disabled for that tenant
- launch policy still unchanged
- `recent_changes` includes rollback audit trail (in-memory change history)

## Rollout Flag Order (Recommended)
1. `p0.rollout.design_partner_access`
2. `p0.rollout.autotask.two_way_commands`
3. `p0.rollout.manager_visibility`
4. `p0.rollout.ai_triage_assist`
5. `p0.rollout.enrichment.itglue`
6. `p0.rollout.enrichment.ninja`
7. `p0.rollout.enrichment.sentinelone`
8. `p0.rollout.enrichment.checkpoint`
9. `p0.rollout.automation.simulation_only`

## Expected Signals During Dry-Run/Tabletop
- `launch_policy` snapshot always shows non-Autotask integrations as `read_only`
- enabling flags changes only the current tenant posture
- feature rollback reduces `summary.enabled_flags` by 1
- tenant rollback sets `summary.enabled_flags = 0`

## Limitations (Current P0 Hardening State)
- Rollout flags use local file-backed runtime persistence by default (`.run/p0-rollout-control.json`) and remain host-local (not distributed/shared across multiple API instances).
- Suitable for controlled launch rehearsal / single-instance founder-operated rollout; multi-instance rollout control still needs a shared durable backing store.
- Persisted rollout registry/backing store with distributed coordination remains a post-Phase-5 hardening item if cohort size grows.
