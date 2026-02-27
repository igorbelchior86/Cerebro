# Title
Fix: Tech só atualiza no Cerebro após confirmação de sucesso no Autotask

# What changed
- `refreshWorkflowCommandFeedback` agora retorna resultado estruturado (`ok`, `uxState`, `detail`).
- `submitTechAssignmentById` só aplica `contextOverrides.tech` quando o comando de assignment está `completed`.
- Em estados `pending`, `retrying` ou `failed`, a UI não altera Tech localmente e mantém mensagem de estado/erro.

# Why it changed
- Havia disparidade de confiança: em alguns casos o Cerebro mostrava novo Tech sem write confirmado no Autotask.
- Isso criava split-brain visual (`dois técnicos`) e comprometia a confiança do operador.

# Impact (UI / logic / data)
- UI: valor de Tech deixa de ser otimista; passa a refletir confirmação autoritativa.
- Logic: gate explícito de sincronização evita commit local prematuro.
- Data: sem mudanças de schema.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
