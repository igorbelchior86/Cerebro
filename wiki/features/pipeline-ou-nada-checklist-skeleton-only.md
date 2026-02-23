# Pipeline OU NADA Checklist Skeleton Only
# What changed
- Removed checklist fallback generation from markdown parsing in `PlaybookPanel`.
- Replaced checklist/hypotheses empty fallback messages with shimmer skeleton placeholders.
- Kept rendered markdown only when actual playbook content exists and panel is ready.

# Why it changed
- The UI must not show fallback content for pipeline artifacts.
- If checklist/hypotheses are not generated yet, the UI should show loading skeletons instead of synthetic or fallback text.

# Impact (UI / logic / data)
- UI: Checklist/Hypotheses now strictly follow pipeline artifact readiness.
- Logic: No client-side fallback checklist parsing from markdown.
- Data: No data schema change.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/PlaybookPanel.tsx
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/features/pipeline-ou-nada-checklist-skeleton-only.md

# Date
- 2026-02-23
