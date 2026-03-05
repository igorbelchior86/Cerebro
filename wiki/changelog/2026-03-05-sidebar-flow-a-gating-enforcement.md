# Sidebar Flow A Gating Enforcement
# What changed
- Disabled direct global-queue sidebar source path that fetched `/autotask/sidebar-tickets` and bypassed canonical workflow read model in `apps/web/src/features/chat/sidebar/useSidebarState.ts`.
- Propagated block consistency fields (`core_state`, `network_env_body_state`, `hypothesis_checklist_state`, `pipeline_status`) from workflow inbox rows to sidebar ticket model in `apps/web/src/lib/workflow-sidebar-adapter.ts`.
- Updated sidebar card rendering to respect unresolved Flow A state:
  - no `—` placeholders while `core_state = resolving`;
  - explicit `Resolving...` UI state;
  - status edit action disabled during unresolved core state.

# Why it changed
- Incident: cards were rendered with missing Flow A fields (org/requester and other core values).
- Root cause: sidebar UI rendered fallback placeholders regardless of `block_consistency.core_state`, and one queue path still bypassed canonical workflow source.

# Impact (UI / logic / data)
- UI: cards now show explicit resolving state for Flow A instead of missing-data placeholders.
- Logic: sidebar now uses canonical workflow inbox as source of truth for global queue visualization too.
- Data: no schema/migration changes.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/lib/workflow-sidebar-adapter.ts`
- `apps/web/src/features/chat/sidebar/SidebarTicketCard.tsx`
- `apps/web/src/features/chat/sidebar/types.ts`
- `tasks/todo.md`

# Date
- 2026-03-05
