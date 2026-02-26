# Title
Agent C manager-ops optional validation typecheck fix

# What changed
Updated the `/p0/ai/triage-decision` route in `apps/api/src/routes/manager-ops.ts` to omit the `validation` property when it is not present, instead of passing `validation: undefined`.

# Why it changed
`@playbook-brain/api` typecheck failed under `exactOptionalPropertyTypes` because `BuildAIDecisionInput.validation` is optional and the route was explicitly passing `undefined`, which is not assignable unless the target type explicitly includes `undefined`.

# Impact (UI / logic / data)
Logic: no behavior change for valid requests. Type-safety fix only. Requests without `validation` continue to work, and requests with `validation` still pass through unchanged.

# Files touched
- apps/api/src/routes/manager-ops.ts

# Date
2026-02-26
