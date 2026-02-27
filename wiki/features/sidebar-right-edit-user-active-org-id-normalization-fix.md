# Title
Fix: Edit User reconhece Org selecionada com normalização de ID

# What changed
- Adicionado normalizador `toPositiveId` no frontend de triage.
- Cálculo de `activeOrgId` passou a aceitar somente IDs positivos válidos (override org -> ticket company_id -> user companyId).
- Ao salvar Org, o ID persistido no estado local agora usa valor normalizado (fallback seguro para option.id).

# Why it changed
- O modal `Edit User` seguia exibindo "Select an Org first" após selecionar `Refresh Technologies`.
- Causa raiz: coerção `Number(null) => 0` contaminava a detecção de org ativa.

# Impact (UI / logic / data)
- UI: `Edit User` passa a listar usuários quando uma org foi selecionada.
- Logic: gate de dependência `User -> Org` fica robusto contra IDs nulos/inválidos.
- Data: sem alteração estrutural.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
