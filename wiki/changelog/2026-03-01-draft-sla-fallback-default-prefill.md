# Draft SLA Fallback Default Prefill
# What changed
- Ajustado o helper `pickDraftDefaultOption` em `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx` para que `serviceLevelAgreement` use a primeira opção ativa como fallback quando o provider não expõe um default detectável.

# Why it changed
- No tenant atual, o Autotask carrega SLA padrão na UI, mas a metadata consumida pelo Cerebro nem sempre marca esse default explicitamente.
- O comportamento anterior só preenchia SLA automaticamente se houvesse `isDefault` explícito ou exatamente uma única opção ativa, deixando o campo vazio em casos válidos.

# Impact (UI / logic / data)
- UI: o draft de New Ticket passa a exibir SLA preenchido por padrão com mais consistência.
- Logic: o prefill de `serviceLevelAgreement` agora segue um fallback determinístico alinhado ao comportamento operacional do Autotask.
- Data: o payload de criação passa a ter maior chance de carregar `serviceLevelAgreementID` sem intervenção manual quando o catálogo não expõe default explícito.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `wiki/changelog/2026-03-01-draft-sla-fallback-default-prefill.md`

# Date
- 2026-03-01
