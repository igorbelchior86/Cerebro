# Stopwatch visível em todas as superfícies de ticket
# What changed
- Corrigido o bug de visibilidade do timer: ele estava implementado apenas em `triage/[id]` e não aparecia em `triage/home`.
- `triage/home` agora renderiza o timer no mesmo slot `footerRightContent` do `ChatInput` (rodapé direito, oposto à toolbar), com `Start/Pause/Reset`.
- Ajustada a chave de persistência do timer na página de ticket existente para usar o `ticket_id` canônico (`data.session.ticket_id`) quando disponível, evitando acoplamento a identificador de rota intermediário.

# Why it changed
- Garantir comportamento consistente: ao abrir ticket (novo ou existente), o timer precisa estar presente independente da tela/rota usada para trabalhar o ticket.

# Impact (UI / logic / data)
- UI:
  - Timer visível em `triage/home` e `triage/[id]`.
- Logic:
  - Persistência do timer por chave de ticket em ambas as telas (`localStorage`).
- Data:
  - Sem migrações de banco.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`

# Date
- 2026-03-04
