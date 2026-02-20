# Ticket Switch Without Full UI Blink
# What changed
- In detail route `/triage/[id]`, ticket selection from sidebar no longer calls Next navigation for each switch.
- Added local `selectedTicketId` state to load ticket detail in-place.
- URL is updated with `history.replaceState` so address bar still reflects the selected ticket without remounting the screen.

# Why it changed
- Even with persisted sidebar scroll/filter, selecting another ticket still caused full screen remount and visible UI blink.
- The remount was produced by dynamic route transitions (`router.push`) on each card click.

# Impact (UI / logic / data)
- UI: Switching tickets from sidebar is now smooth (no full-page blink/remount effect).
- Logic: Detail fetch flow now depends on local selected ticket state instead of route transitions for every card click.
- Data: No backend changes.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-02-20
