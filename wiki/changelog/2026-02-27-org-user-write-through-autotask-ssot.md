# Title
2026-02-27: Org/User agora persistem no Autotask e no Cerebro

# What changed
- Adicionado endpoint `PATCH /autotask/ticket/:ticketId/context` para write de contexto de ticket.
- Endpoint faz:
  - update em Autotask (`companyID`, `contactID`)
  - refresh de entidades relacionadas (company/contact)
  - upsert em `ticket_ssot` para persistir estado canônico.
- Frontend de `Edit Org` e `Edit User` passou a executar esse endpoint em vez de alterar apenas estado local.

# Why it changed
- Corrigir comportamento reportado: alteração visual sem efeito real no Autotask e sem persistência após refresh.

# Impact (UI / logic / data)
- UI: valores de Org/User deixam de ser efêmeros.
- Logic: edição de contexto com write path autorizado.
- Data: `ticket_ssot` atualizado para manter consistência do `playbook/full-flow`.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
