# Title
Sidebar esquerda: ordenação cronológica e divisores sticky por data

# What changed
- A lista de tickets visíveis na sidebar passou a ser ordenada por `created_at` em ordem decrescente (mais recente no topo).
- A renderização da lista passou a agrupar tickets por dia com cabeçalhos sticky.
- Cabeçalhos usam rótulos `Today`, `Yesterday` e, para datas antigas, formato mês+dia.
- Novas chaves de i18n foram adicionadas para os rótulos de data.

# Why it changed
- Era necessário garantir leitura cronológica clara do intake e facilitar navegação em volume alto com separadores de data fixos no scroll.

# Impact (UI / logic / data)
- UI: sidebar com blocos por data e cabeçalhos sticky, mantendo cards existentes.
- Logic: ordenação determinística por `created_at` antes da renderização.
- Data: sem alteração de schema, payload ou persistência.

# Files touched
- `apps/web/src/features/chat/sidebar/useSidebarState.ts`
- `apps/web/src/features/chat/sidebar/ChatSidebar.tsx`
- `apps/web/messages/en.json`

# Date
2026-03-03
