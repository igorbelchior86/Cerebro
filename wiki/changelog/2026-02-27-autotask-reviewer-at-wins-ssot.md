# Title
2026-02-27: AT wins em divergência Cerebro x Autotask (reviewer layer)

# What changed
- `playbook/full-flow` ganhou overlay autoritativo do Autotask para campos críticos.
- Payload inclui `authoritative_review` com lista de divergências detectadas.
- Frontend limpa overrides locais divergentes para impedir persistência visual de estado stale.

# Why it changed
- Eliminar disparidades como “Cerebro mostra Igor enquanto AT mostra Stu” e reforçar confiança de SSOT.

# Impact (UI / logic / data)
- UI: passa a convergir automaticamente para o valor do Autotask em caso de conflito.
- Logic: read-repair determinístico no caminho de leitura.
- Data: sem alteração estrutural em tabelas.

# Files touched
- `apps/api/src/routes/playbook.ts`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`

# Date
2026-02-27
