# Title
Fix: Edit User passa a aceitar Org com `companyID = 0` (Refresh)

# What changed
- Ajustado parsing de ID no frontend do triage:
  - `toPositiveId` foi substituído por `toAutotaskId` (`>= 0`).
- Ajustadas checagens do fluxo `Org -> User` para usar `null` checks em vez de truthy/falsy:
  - `if (!activeOrgId)` -> `if (activeOrgId === null)`
  - `if (activeOrgId)` -> `if (activeOrgId !== null)`
- Ajustada propagação de resposta de update para aceitar `updated.companyId = 0`.

# Why it changed
- A org `Refresh Technologies` no tenant retorna `companyID = 0`.
- O frontend descartava esse valor como inválido por usar validações/branches baseados em truthiness.
- Resultado observado: modal de `Edit User` dizia "Select an Org first" mesmo após selecionar `Refresh`.

# Impact (UI / logic / data)
- UI: `Edit User` lista usuários normalmente para `Refresh Technologies`.
- Logic: dependência `User -> Org` funciona para IDs Autotask não positivos (caso `0`).
- Data: sem mudança de schema; sem alteração de payload persistido.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
