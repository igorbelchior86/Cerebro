# Title
Fix de labels históricos ausentes para picklists opcionais no contexto

# What changed
- A tela `triage/[id]` passou a resolver localmente os labels de `Priority`, `Issue Type`, `Sub-Issue Type` e `Service Level Agreement` quando o payload do ticket chega apenas com IDs.
- O carregamento desses catálogos é lazy e sequencial: só ocorre quando há ID sem label e apenas uma vez por sessão da tela.
- O valor exibido no card de contexto agora é derivado em render a partir da seguinte ordem: override local, label do payload, label resolvido do cache de picklist, ID bruto.

# Why it changed
- Tickets antigos, como `T20260226.0033`, já existiam antes da persistência de labels no SSOT e continuavam chegando à tela apenas com IDs numéricos.
- A correção anterior cobria apenas tickets cujo payload já possuía os labels autoritativos; faltava tratar o cenário histórico.

# Impact (UI / logic / data)
- UI: o card de contexto passa a mostrar nomes legíveis também para tickets antigos.
- Logic: a tela deriva labels a partir de catálogos locais, sem duplicar estado e sem depender de write-back automático.
- Data: nenhuma mudança de schema; nenhum write novo no provider. Apenas leitura lazy dos catálogos quando necessário.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-03-01
