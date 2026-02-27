# Title
Fix: consultas Autotask dos modais Org/User/Tech com filtro estruturado

# What changed
- Corrigido backend dos endpoints de busca (`companies`, `contacts`, `resources`) para enviar payload `search` estruturado JSON ao Autotask.
- Removido uso de filtro textual bruto que ativava fallback para `title contains ...`.
- Ajustada busca textual de `contacts/resources` para pós-filtro server-side sobre resultados retornados.

# Why it changed
- O modal `Edit Org` retornava erro 500 (`Unable to find title in the Company Entity`) e `Edit Tech` não listava opções.
- Causa raiz: fallback interno do client quando recebe filtro não estruturado.

# Impact (UI / logic / data)
- UI: modais voltam a carregar opções corretamente.
- Logic: rotas usam contrato de query compatível com Autotask (`filter` estruturado).
- Data: sem mudanças de schema; apenas correção de leitura.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `tasks/lessons.md`

# Date
2026-02-27
