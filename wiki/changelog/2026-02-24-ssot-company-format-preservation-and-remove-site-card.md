# SSOT Company Format Preservation and Remove Site Card

# What changed
- Hardened `PrepareContext` SSOT anti-regression so `company` preserves the intake ticket company string (display formatting/punctuation) instead of allowing processed variants to overwrite it.
- Removed the `Site` context card from the right sidebar (`PlaybookPanel` context list) to eliminate formatting leakage and UI noise.

# Why it changed
- After ticket reset, UI initially showed the correct company name from intake/listing, but once processing completed the displayed company regressed to a degraded processed variant.
- The right sidebar `Site` field was leaking malformed formatting/HTML residue and was not useful for current workflows.

# Impact (UI / logic / data)
- **UI**: Left/center/right remain consistent on company display after processing; right sidebar no longer shows `Site`.
- **Logic**: SSOT merge now treats intake company as display-canonical and protects against formatting regressions, not only `unknown` regressions.
- **Data**: No schema changes. Only the SSOT company merge behavior changed.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-24
