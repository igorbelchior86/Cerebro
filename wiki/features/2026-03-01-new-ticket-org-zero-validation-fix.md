# Title
Correção de validação para `org 0` no create do new ticket

# What changed
- A validação do botão verde em `triage/home` deixou de tratar `companyId = 0` como ausente.
- A checagem foi alterada de teste por truthiness para teste explícito de tipo numérico.

# Why it changed
- `0` é falsy em JavaScript.
- A validação anterior usava `if (!companyId)`, então bloqueava a criação mesmo quando `org 0` era um valor válido no fluxo.

# Impact (UI / logic / data)
- UI: a mensagem de erro incorreta deixa de aparecer quando a organização selecionada tem id `0`.
- Logic: o create aceita `companyId = 0` como válido.
- Data: o payload de criação continua o mesmo; apenas a validação local foi corrigida.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `tasks/todo.md`

# Date
2026-03-01
