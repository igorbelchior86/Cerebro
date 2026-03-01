# Title
Fix de renderização dos labels dos picklists opcionais no contexto do ticket

# What changed
- O read-model de `GET /playbook/full-flow` passou a projetar `priority_label`, `issue_type_label`, `sub_issue_type_label` e `sla_label` a partir de `ticket_ssot.autotask_authoritative`.
- A tela `triage/[id]` passou a priorizar esses labels ao renderizar `Priority`, `Issue Type`, `Sub-Issue Type` e `Service Level Agreement`.
- O fallback para o ID bruto foi mantido apenas quando não existir label autoritativo disponível.

# Why it changed
- O write-path já persistia labels dos picklists, mas o payload principal da tela não os expunha.
- Como `triage/[id]` fazia fallback direto para `priority`, `issue_type`, `sub_issue_type` e `sla`, o usuário via códigos numéricos em vez dos nomes.

# Impact (UI / logic / data)
- UI: o card de contexto passa a exibir nomes legíveis para os quatro campos opcionais.
- Logic: a tela usa o label do read-model principal como fonte autoritativa de display.
- Data: sem mudanças de schema; apenas projeção e consumo dos labels já salvos no SSOT.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-01
