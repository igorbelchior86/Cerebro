# Task: Sidebar toggle Global/Personal com slider e dropdown de queues

**Status**: completed
**Started**: 2026-02-25

## Plan
- [x] Step 1: Localizar componentes da sidebar esquerda e estado atual de filtros/lista
- [x] Step 2: Reduzir altura dos cards de métricas (active/done/average) para abrir espaço visual
- [x] Step 3: Adicionar slider/toggle Global vs Personal na metade inferior da sidebar
- [x] Step 4: Manter layout atual em Personal e criar layout Global com dropdown de queues
- [x] Step 5: Verificar comportamento/build e atualizar wiki

## Open Questions
- Origem de dados real das queues do Autotask ainda não existe; assumir lista mock/local temporária para UI.
- Filtragem real por ticket assigned/queue será simulada com dados existentes até o layer Autotask ser implementado.

## Progress Notes
- Sidebar localizada em `/apps/web/src/components/ChatSidebar.tsx`.
- `Personal` mantém tabs (`all/processing/done/failed`) + botão de hide suppressed.
- `Global` substitui a barra de tabs por dropdown de filas (UI pronta para integrar com Autotask).
- Filtros por técnico/fila usam campos opcionais (`assigned_resource_*`, `queue*`) com fallback para comportamento atual quando o backend ainda não envia esses campos.
- `apps/web` `typecheck` passou.
- `eslint` pontual não pôde rodar porque o projeto não possui configuração ESLint detectável no `apps/web`.

## Review
(filled after completion)
- What worked: mudança ficou toda concentrada no `ChatSidebar`, sem tocar na estrutura geral da página.
- What was tricky: implementar modo Global/Personal sem quebrar o payload atual (`/email-ingestion/list`) que ainda não expõe queue/assignee.
- Time taken: curto
