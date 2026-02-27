# Title
Feature: Reviewer intermediário com política `AT win` para campos críticos

# What changed
- Adicionada camada de reviewer no backend (`GET /playbook/full-flow`) que:
  - consulta snapshot atual do ticket no Autotask,
  - compara com projeção local,
  - aplica overlay autoritativo do Autotask (`AT win`) nos campos críticos,
  - retorna `data.authoritative_review` com divergências detectadas.
- Adicionada reconciliação no frontend para remover `contextOverrides` stale (`org`, `user`, `tech`) quando divergem do snapshot de servidor.

# Why it changed
- Havia casos de split-brain (Cerebro diferente do Autotask) sem nova ação do usuário, reduzindo confiança operacional.
- Requisito explícito: para Account/Contact/Status/Priority/Additional Contacts/Issue/Sub-Issue/Source/Due Date/SLA/Queue/Primary/Secondary Resource, Autotask é SSOT.

# Impact (UI / logic / data)
- UI: em divergência, passa a refletir o valor autoritativo do Autotask.
- Logic: política determinística `AT win` aplicada no read path com evidência de diffs.
- Data: sem migração; somente enriquecimento do payload de resposta com `authoritative_review`.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
