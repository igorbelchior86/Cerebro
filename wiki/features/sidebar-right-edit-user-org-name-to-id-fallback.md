# Title
Fix: Edit User resolve company_id por nome da Org quando ID não está no estado

# What changed
- Adicionado fallback no frontend do modal `Edit User`:
  - quando `activeOrgId` está ausente, resolve ID via `searchAutotaskCompanies(orgName)`
  - aplica `resolvedOrgIdFallback` para habilitar a busca de contatos.
- Reset do fallback ao abrir/fechar modal para evitar estado stale.

# Why it changed
- Mesmo após selecionar `Refresh Technologies`, o modal continuava mostrando "Select an Org first".
- Em alguns estados, a UI tinha nome da org mas não tinha `company_id` materializado.

# Impact (UI / logic / data)
- UI: `Edit User` consegue listar contatos da org selecionada sem exigir re-seleção manual.
- Logic: dependência `User -> Org` agora tolera payload parcialmente denormalizado.
- Data: sem alterações de schema ou contratos persistentes.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
