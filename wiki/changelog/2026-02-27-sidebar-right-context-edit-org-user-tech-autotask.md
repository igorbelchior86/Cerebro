# Title
2026-02-27: Sidebar right context edit via Autotask

# What changed
- Implementado pencil icon nos campos `Org`, `User`, `Tech` no painel de contexto da sidebar direita.
- Implementado modal de busca read-only via API Autotask para selecionar valores.
- Implementado filtro obrigatório de `User` por `Org` selecionada.
- Integração de seleção de `Tech` com comando workflow `update_assign`.
- Expostos endpoints backend:
  - `GET /autotask/companies/search`
  - `GET /autotask/contacts/search` (com `companyId`)
  - `GET /autotask/resources/search`

# Why it changed
- Necessidade de ajustes rápidos de contexto no fluxo de triagem com dados reais do Autotask.
- Evitar seleção de usuário fora da organização corrente.

# Impact (UI / logic / data)
- UI: cards editáveis com ação contextual.
- Logic: dependência org->user e submit de tech assignment com resource ID.
- Data: somente leitura de Autotask; sem migração de banco.

# Files touched
- `apps/web/src/components/PlaybookPanel.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/api/src/routes/autotask.ts`
- `apps/api/src/clients/autotask.ts`

# Date
2026-02-27
