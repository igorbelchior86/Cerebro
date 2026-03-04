# Sidebar chronological ordering deterministic
# What changed
- A sidebar passou a usar um resolvedor explícito de cronologia (`resolveTicketChronology`) para ordenar tickets em Personal e Global.
- A ordenação agora segue precedência determinística:
  1. `created_at` canônico válido
  2. data derivada do `ticket_number` no padrão `TYYYYMMDD.*`
  3. itens sem data ficam no final
- Em empate, o comparador usa presença de timestamp canônico e sequência do ticket (`.NNNN`) para manter ordenação estável e mais recente no topo.

# Why it changed
- O comparador anterior dependia apenas de `Date.parse(created_at)`. Quando o timestamp não era parseável/ausente, a UI caía na ordem de chegada do array, gerando inversões aparentes entre tickets antigos e recentes.

# Impact (UI / logic / data)
- UI: lista da sidebar (Personal/Global) mantém ordem cronológica decrescente consistente.
- Logic: algoritmo de sort robusto para diferentes formatos/parcialidade de dados de data.
- Data: sem alteração de schema ou contratos de API.

# Files touched
- apps/web/src/features/chat/sidebar/utils.ts
- apps/web/src/features/chat/sidebar/useSidebarState.ts
- tasks/todo.md

# Date
- 2026-03-04
