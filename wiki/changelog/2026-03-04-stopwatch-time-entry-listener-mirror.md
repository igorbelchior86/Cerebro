# Stopwatch listener + mirror (PSA-confirmed)
# What changed
- Implementado fluxo primário de envio externo com `time_entry` antes de `create_comment_note` na tela de triagem.
- Adicionado listener de status de comando para espelhar no frontend o tempo realmente salvo pelo PSA (estado `pending/synced/error`).
- Timer/stopwatch adicionado no `ChatInput`, no rodapé à direita (lado oposto da toolbar), com controles `Start/Pause/Reset`.
- Resultado de `time_entry` no backend foi enriquecido com metadados confirmados (`worked_hours`, `worked_minutes`, `billable_hours`) e projeção para `domain_snapshots` do workflow inbox.
- Contrato de comando do frontend foi expandido para aceitar `command_type: 'time_entry'`.
- Testes de gateway/core foram atualizados para cobrir espelhamento de time entry.

# Why it changed
- O objetivo é adotar `New Time Entry` como ação primária no fluxo externo e refletir no Cerebro a verdade final do PSA, sem heurística local de arredondamento.

# Impact (UI / logic / data)
- UI:
  - Novo componente visual de timer no `ChatInput` footer-right.
  - Exibição do estado de sincronização com PSA (`Awaiting`, `Synced`, `Error`).
- Logic:
  - `handleSendMessage` externo envia `time_entry` primeiro e passa a ouvir confirmação de status para atualizar o timer.
  - Ao receber confirmação `completed`, o timer reinicia automaticamente para o próximo bloco de trabalho.
- Data:
  - Sem migração de banco.
  - `domain_snapshots` do inbox recebe campos de mirror do último time entry (`last_time_entry_*`) para leitura canônica no frontend.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/components/ChatInput.tsx`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts`
- `apps/api/src/services/orchestration/ticket-workflow-core.ts`
- `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts`
- `apps/api/src/__tests__/services/ticket-workflow-core.test.ts`
- `tasks/todo.md`

# Date
- 2026-03-04
