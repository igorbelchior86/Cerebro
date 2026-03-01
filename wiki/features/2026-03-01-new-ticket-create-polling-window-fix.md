# Title
Correção da janela de polling no create assíncrono do new ticket

# What changed
- O botão verde de create no `New Ticket` passou a esperar mais tempo pelo resultado do comando assíncrono.
- O polling agora continua por uma janela maior e só interrompe cedo quando encontra estado terminal real:
  - `completed`
  - `failed`
  - `dlq`
  - `rejected`
- Estados intermediários como `accepted` e `processing` deixam de ser tratados como erro prematuro.

# Why it changed
- O fluxo de `workflow/commands` responde com `202 accepted`, então o create é assíncrono por natureza.
- A implementação anterior fazia poucas checagens curtas e transformava um processamento normal em erro de UI.

# Impact (UI / logic / data)
- UI: reduz falso erro de “still processing” logo após clicar no check verde.
- Logic: o frontend respeita melhor o ciclo de vida assíncrono do comando de create.
- Data: sem mudança de payload; apenas ajuste de polling/espera no cliente.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-01
