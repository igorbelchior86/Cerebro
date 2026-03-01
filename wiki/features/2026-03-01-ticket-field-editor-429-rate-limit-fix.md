# Title
Fix 429 nos editores opcionais de metadata do ticket

# What changed
- O endpoint `GET /autotask/ticket-field-options` passou a aceitar o query param `field` para carregar apenas um picklist por vez.
- Quando não há `field`, o backend deixou de buscar os quatro catálogos em paralelo e passou a carregá-los sequencialmente.
- `triage/home` e `triage/[id]` agora fazem cache local dos catálogos de `Priority`, `Issue Type`, `Sub-Issue Type` e `Service Level Agreement`.
- A filtragem por texto digitado passou a ser local no frontend, sem novo request ao Autotask a cada alteração do campo de busca.

# Why it changed
- Os quatro editores opcionais estavam tratando picklists estáticos como autocomplete remoto.
- Isso disparava leituras repetidas ao abrir o modal e em cada tecla digitada, excedendo o limite de threads simultâneas da API do Autotask e gerando erro 429.

# Impact (UI / logic / data)
- UI: os modais continuam iguais visualmente, mas deixam de falhar ao digitar na busca.
- Logic: a carga de metadata ficou lazy, por campo, e reaproveita cache local por sessão da tela.
- Data: não houve mudança de schema; apenas redução de chamadas externas e preservação dos mesmos valores de picklist.

# Files touched
- `apps/api/src/routes/autotask.ts`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-01
