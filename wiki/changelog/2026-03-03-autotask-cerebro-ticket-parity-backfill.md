# Title
Paridade AT/Cerebro de tickets via backfill contínuo no poller

# What changed
- O poller de Autotask passou a executar reconciliação histórica (backfill) além do polling incremental.
- Adicionado cursor persistido por tenant em `.run/autotask-parity-state.json`.
- Backfill roda por janelas de tempo (`createDate`) e divide janelas densas de forma adaptativa para reduzir truncamento por `MaxRecords`.
- Ingestão continua idempotente no workflow (`processAutotaskSyncEvent`) com `provenance.source='autotask_reconcile'`.
- O singleton de runtime ativa a paridade por padrão com `AUTOTASK_PARITY_ENFORCED=true` (configurável por env).

# Why it changed
- O fluxo anterior buscava apenas tickets criados na última hora (`createDate > now-1h`, limite 50), o que não garantia que todos os tickets existentes no AT aparecessem no Cerebro.
- A necessidade operacional é paridade completa de chamados entre AT e Cerebro.

# Impact (UI / logic / data)
- UI: o inbox do Cerebro passa a convergir para o conjunto completo de tickets existentes no AT (por tenant).
- Logic: o poller agora tem dois estágios: backfill histórico + polling incremental.
- Data: novo arquivo de estado runtime `.run/autotask-parity-state.json`; sem mudança de schema SQL.

# Files touched
- `apps/api/src/services/adapters/autotask-polling.ts`
- `tasks/todo.md`

# Date
2026-03-03
