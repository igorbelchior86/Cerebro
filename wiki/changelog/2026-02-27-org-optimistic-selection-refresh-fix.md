# Title
2026-02-27: Fix de bloqueio Org->User no caso Refresh Technologies

# What changed
- Seleção de org no frontend passou a ser otimista (estado local imediato).
- Falha de write no Autotask durante seleção de org não bloqueia abertura/listagem do modal de usuário.
- Erro de integração é mostrado como aviso operacional.

# Why it changed
- Usuário reportou que, para `Refresh Technologies`, a seleção de org não destravava listagem de users.

# Impact (UI / logic / data)
- UI: fluxo de seleção segue funcional no caso restrito reportado.
- Logic: desacoplamento entre dependência visual e write intermediário externo.
- Data: sem migração; apenas ajuste de comportamento de erro.

# Files touched
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/lessons.md`

# Date
2026-02-27
