# Title
2026-02-27: Fix de gate "Select an Org first" no Edit User

# What changed
- Corrigido cálculo de org ativa para o modal `Edit User` com normalização de IDs positivos.
- Removida dependência de coerção numérica implícita que interpretava `null` como `0`.

# Why it changed
- Selecionar `Refresh Technologies` não habilitava listagem de usuários no modal.

# Impact (UI / logic / data)
- UI: listagem de users volta a funcionar após seleção de org.
- Logic: resolução de `activeOrgId` robusta e previsível.
- Data: sem impacto de schema.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
