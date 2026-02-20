## Lesson: 2026-02-19
**Mistake**: Hand-rolling generic SVG paths for semantic icons (like the Moon in the theme toggle).
**Root cause**: Tried to construct an SVG from memory/scratch instead of pulling from a premium, battle-tested icon set like Heroicons, Radix, or Lucide.
**Rule**: Always use premium icon sets (e.g., Heroicons) for core UI elements to ensure a polished look. 
**Pattern**: When building custom UI components requiring icons, copy the exact SVG paths from established libraries rather than improvising.
