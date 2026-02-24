# Prepare Context Company Inference And History Scope Hardening
# What changed
- Hardened company inference in `PrepareContext` to extract organization names from email/HTML boilerplate patterns (e.g. `has been created for CAT Resources, LLC`) before falling back to domain-based inference.
- Broad historical correlation (`2e`) now requires reliable scope (`orgId` or `companyName`).
- When `orgId` is unavailable but `companyName` exists, history search is filtered by `tickets_processed.company` to avoid cross-company matches.
- History appendix can record when broad correlation is blocked due to missing scope.

# Why it changed
- Ticket `T20260223.0006` was producing `company = unknown`, which cascaded into IT Glue/Ninja non-correlation and polluted history with unrelated cases from other companies.
- In a multi-tenant dataset, unscoped history search creates false positives and degrades trust in the entire `Prepare Context` step.

# Impact (UI / logic / data)
- UI: `related_cases` should stop showing cross-company junk when org/company scope is unresolved.
- Logic: Prepare Context now preserves company context earlier and enforces boundary-safe history correlation.
- Data: Future runs may show `ticket.company` resolved from intake email boilerplate and `related_cases` reduced/empty when scope is missing.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
