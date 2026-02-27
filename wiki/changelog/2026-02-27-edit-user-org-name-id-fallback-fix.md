# Title
2026-02-27: Fallback nome->ID para listagem de User por Org

# What changed
- No modal `Edit User`, quando não existe `activeOrgId`, o frontend tenta resolver o ID da org a partir do nome já exibido.
- Com ID resolvido, a busca de contatos por `companyID` é executada normalmente.

# Why it changed
- Selecionar `Refresh Technologies` ainda não destravava a listagem de usuários em alguns casos.

# Impact (UI / logic / data)
- UI: redução de falso bloqueio "Select an Org first".
- Logic: gate de org tornou-se resiliente a inconsistência transitória de estado.
- Data: sem impactos estruturais.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
