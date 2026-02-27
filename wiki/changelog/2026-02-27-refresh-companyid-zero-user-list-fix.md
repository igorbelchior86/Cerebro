# Title
2026-02-27: Fix de listagem de User para Org Refresh (`companyID = 0`)

# What changed
- Corrigido o gate de `activeOrgId` no modal de contexto da sidebar direita.
- Frontend agora trata `companyID = 0` como ID válido para Org.
- Condições de carregamento/salvamento de `User` foram ajustadas para não bloquear `Org` com ID `0`.

# Why it changed
- Caso de produção restrito à org `Refresh Technologies`.
- Investigação de payload mostrou que a org principal de Refresh retorna `id = 0`, e não era considerada válida no frontend.

# Impact (UI / logic / data)
- UI: seleção de `Refresh Technologies` deixa de mostrar erro falso de "Select an Org first".
- Logic: busca de contatos por `companyID` é executada corretamente para `0`.
- Data: nenhuma mudança estrutural; comportamento de leitura/escrita mantém contrato existente.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
