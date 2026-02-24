# Phase 4 Validate & Policy: Corroboration Gate + Destructive Approval Guard

# What changed
- Strengthened `ValidatePolicyService` to better match the Phase 4 contract (“nada de chute” / destructive actions require human approval / broad claims need corroboration).
- Added a new **hard quality stop**: `broad_hypothesis_corroboration_missing`.
  - Triggers when the top diagnosis hypothesis claims ISP/provider/regional outage cause without corroborating evidence in:
    - `external_status`
    - `related_cases`
    - peer-impact style evidence (`multiple users/devices`, `others affected`, etc.)
- Added a new **risk gate**: `destructive_action_requires_human_approval`.
  - Triggers when diagnosis recommends destructive remediation (including `factory reset` / firewall reset) without explicit approval/change-window qualifier.
- Expanded destructive action detection patterns to include common MSP/network wording (`factory reset`, `reset firewall`).
- Added tests covering both new guardrails.

# Why it changed
- Phase 4 requires the validator to behave like a safety/common-sense guardian:
  - block unsafe/destructive recommendations unless human approval is explicit
  - challenge broad hypotheses (e.g., ISP/regional outage) when corroboration is missing
- The previous implementation already had strong evidence/risk checks, but it still allowed:
  - some destructive actions outside `Critical` tickets
  - uncorroborated broad provider hypotheses to proceed as if they were sufficiently proven

# Impact (UI / logic / data)
- UI:
  - No UI code change required.
  - Tickets may more often show `needs_more_info` / blocked playbook generation when broad external hypotheses are not corroborated.
- Logic:
  - `Validate & Policy` now enforces stronger hard stops for:
    - uncorroborated ISP/provider/regional hypotheses
    - destructive remediation without explicit human approval gate
  - Preserves existing advisor-mode behavior for non-hard issues.
- Data:
  - No schema changes or migrations.
  - New `blocking_reasons` values may appear in validation output:
    - `broad_hypothesis_corroboration_missing`
    - `destructive_action_requires_human_approval`

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/validate-policy.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/__tests__/services/validate-policy-gates.test.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
