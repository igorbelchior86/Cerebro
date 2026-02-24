# Triage Header Refresh Button Icon Refresh Glyph Replacement
# What changed
- Refined the hard refresh button in the triage header with a larger hit area (`28x28`), rounded-square shape, and improved visual states.
- Replaced the old single-arc refresh glyph with a clearly different dual-arrow refresh glyph (thicker stroke, higher legibility).
- Added subtle hover feedback (background/border lift) while preserving the existing action and disabled behavior.

# Why it changed
- The previous icon/button composition looked visually weak in the header: small circular hit area, thin stroke, and poor optical balance.
- A stronger change was needed in the glyph itself (not just the button chrome) so the visual difference is obvious.
- The refresh action is important and should look intentional and readable without drawing excessive attention.

# Impact (UI / logic / data)
- UI: Better visual quality and click target for the header refresh control.
- Logic: No behavior change; still triggers `handleRefreshPipeline`.
- Data: No data model or API changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
2026-02-24
