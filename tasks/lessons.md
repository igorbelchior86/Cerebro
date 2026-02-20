## Lesson: 2026-02-20
**Mistake**: Sidebar showed import time rather than actual ticket creation time.
**Root cause**: `created_at` in `tickets_processed` was populated via DB default/current timestamp during ingestion; list ordering also used `last_updated_at`.
**Rule**: For timeline UI fields, always validate timestamp provenance end-to-end (source extraction -> persistence -> API ordering -> display).
**Pattern**: Any ticket timeline/card/time sort feature must avoid ingestion timestamps unless explicitly requested.

## Lesson: 2026-02-20 (navigation persistence)
**Mistake**: Sidebar UI context (active filter + list position) was lost after selecting a ticket.
**Root cause**: Component-local state was not persisted across route remounts; navigation used default scroll behavior.
**Rule**: For list-detail navigation, persist list UI state (filter/sort/scroll) across route transitions and disable auto-scroll jumps where appropriate.
**Pattern**: Any sidebar/list that navigates to detail routes must retain user context to avoid disorientation.

## Lesson: 2026-02-20 (blink on ticket switch)
**Mistake**: Previous fix preserved sidebar state but still navigated between dynamic routes, so full UI remounted and blinked.
**Root cause**: Persistence of scroll/filter alone does not prevent remount; route transition in `/triage/[id]` remained.
**Rule**: For master-detail ticket navigation, if smooth switching is required, avoid route remount on every selection and switch detail state in-place.
**Pattern**: Use state-driven detail selection + URL sync (`history.replaceState`) when UI continuity is higher priority than route-level remount behavior.

## Lesson: 2026-02-20 (card readability)
**Mistake**: Card layout hid too much of subject and split context into less useful rows.
**Root cause**: Single-line subject truncation and non-optimal information hierarchy.
**Rule**: In compact ticket cards, prioritize subject readability with 2-line clamp and group secondary metadata in one compact row.
**Pattern**: Time on left + org/requester on right improves scanability without increasing card height too much.

## Lesson: 2026-02-20 (title vs description boundary)
**Mistake**: Card sometimes displayed `Title + Description` concatenated as title.
**Root cause**: Parser title regex stopped at newline only, but some templates place `Description:` on same line/HTML flow.
**Rule**: Parse structured email fields with explicit marker boundaries, not only newline boundaries.
**Pattern**: `Title` extraction must stop at next known marker (`Description`, `Created by`, etc.).

## Lesson: 2026-02-20 (middle-column parity)
**Mistake**: Session timeline was too generic and lacked pipeline granularity from mock/template.
**Root cause**: UI was driven by short translation strings instead of stage-oriented message composition.
**Rule**: For pipeline UIs, represent each processing stage explicitly and include sub-steps where available.
**Pattern**: Build deterministic timeline from flow sections (`evidence`, `diagnosis`, `validation`, `playbook`) and keep user messages appended.

## Lesson: 2026-02-20 (explicit parity fields)
**Mistake**: Timeline first item remained generic and did not preserve source-specific narrative required by mockup.
**Root cause**: Stage generator lacked ticket-context interpolation (title/requester/org/site/priority).
**Rule**: For parity-driven UI fixes, reproduce required fields literally before expanding to broader improvements.
**Pattern**: Header and first pipeline event must always include concrete ticket identity + issue narrative.

## Lesson: 2026-02-20 (description noise)
**Mistake**: Raw ticket descriptions still included signatures/disclaimers/reply tails after basic normalization.
**Root cause**: Normalization handled formatting noise but not semantic noise blocks common in email flows.
**Rule**: Email-derived description fields require block-level cleanup (reply/disclaimer/signature) plus safety fallback.
**Pattern**: Apply deterministic text-cleaning pipeline at ingestion, not only at UI render time.

## Lesson: 2026-02-20 (layout jitter)
**Mistake**: UI still shifted vertically/horizontally during ticket switches despite state persistence fixes.
**Root cause**: Conditional mount/unmount of right panel and variable header row geometry.
**Rule**: For master-detail navigation, keep core columns mounted and reserve header control space to avoid reflow.
**Pattern**: Prefer `visibility:hidden` for optional badges and ellipsis-constrained titles in fixed-height headers.

## Lesson: 2026-02-20 (polling jitter)
**Mistake**: Even with layout stabilization, polling still rebuilt timeline with fresh timestamps, causing visual movement.
**Root cause**: Message array changed every polling cycle due to new Date timestamps and unconditional setMessages.
**Rule**: In polling UIs, update message timelines only on semantic state changes, not on polling ticks.
**Pattern**: Use deterministic timestamps + content signature guard + no auto-scroll on periodic refresh.
