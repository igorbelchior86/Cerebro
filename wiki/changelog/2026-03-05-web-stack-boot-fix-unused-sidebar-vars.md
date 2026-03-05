# Web stack boot fix (unused sidebar vars)
# What changed
- Removed unused import `API` from sidebar state hook.
- Removed unused derived variable `selectedGlobalQueueId` from sidebar state hook.

# Why it changed
- Web runtime/build was failing to start due ESLint errors (`no-unused-vars`) in `useSidebarState.ts`.

# Impact (UI / logic / data)
- UI: no behavior change.
- Logic: no behavior change; dead code cleanup only.
- Data: no schema or persistence impact.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `wiki/changelog/2026-03-05-web-stack-boot-fix-unused-sidebar-vars.md`
- `tasks/todo.md`

# Date
- 2026-03-05
