# Task: Eliminate UI lift/fall jitter while switching tickets
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Stop continuous timeline re-creation on every polling tick.
- [x] Step 2: Use deterministic timestamps per selected ticket timeline.
- [x] Step 3: Prevent automatic smooth scroll on each message refresh.
- [x] Step 4: Verify type safety.
- [x] Step 5: Update wiki and lessons.

## Open Questions
- None.

## Progress Notes
- Added timeline signature guard to only update messages when pipeline content truly changes.
- Replaced dynamic `new Date()` timeline timestamps with deterministic offsets from ticket created time.
- Removed auto `scrollIntoView` behavior that was causing repeated vertical motion.
- Decoupled flow polling effect from sidebar polling updates using `sidebarTicketsRef`.

## Review
- What worked:
  - Removing unnecessary message resets/pseudo-changes significantly reduces visual jump.
- What was tricky:
  - Keeping ticket context data available without tying timeline effect to sidebar fetch cadence.
- Time taken:
  - ~15 minutes
