# Title
2026-02-27: Fix de sugestões iniciais no Edit Org

# What changed
- `GET /autotask/companies/search` agora trata `q` vazio com busca default (ativas + refresh) e merge deduplicado.
- Correção restaura lista inicial no modal sem precisar digitar.

# Why it changed
- Usuário reportou regressão: orgs só apareciam após digitação.

# Impact (UI / logic / data)
- UI: melhor UX no open do modal Edit Org.
- Logic: busca vazia deixou de depender de filtro vazio do Autotask.
- Data: sem alteração de schema.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
