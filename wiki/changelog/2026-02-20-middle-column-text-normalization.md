# Middle Column Text Normalization
# What changed
- Added robust text normalization for Autotask timeline item fields in middle column.
- Normalization now strips HTML tags/scripts/styles, decodes common HTML entities, removes `Description:` prefix, and collapses whitespace.
- Applied normalization to problem description, title fallback, requester, company/org, and site fields.

# Why it changed
- Timeline text was still noisy and inconsistent due to raw email/body formatting artifacts.

# Impact (UI / logic / data)
- UI: Cleaner, normalized timeline text in item 1.
- Logic: Deterministic sanitization before rendering.
- Data: No backend schema changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
