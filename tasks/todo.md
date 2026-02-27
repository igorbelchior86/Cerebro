# Task: Política de Org ativa com exceção para Refresh
**Status**: completed
**Started**: 2026-02-27T13:00:00-03:00

## Plan
- [x] Step 1: Diagnosticar por que User não listava após selecionar org Refresh.
- [x] Step 2: Ajustar política de listagem de Org para manter ativas + exceção Refresh.
- [x] Step 3: Validar typecheck API/Web.
- [x] Step 4: Atualizar lessons + wiki obrigatória.

## Open Questions
- Sem bloqueios; exceção aplicada por nome da org contendo `refresh` (case-insensitive).

## Progress Notes
- Skill aplicada: `workflow-orchestrator`.
- Ajuste feito em `GET /autotask/companies/search`: resultado agora inclui org quando `isActive=true` OU nome contém `refresh`.
- Verificação executada:
  - `pnpm --filter @playbook-brain/api typecheck` ✅
  - `pnpm --filter @playbook-brain/web typecheck` ✅

## Review
- What worked:
- Política preservou preferência por orgs ativas sem bloquear o MSP proprietário.
- What was tricky:
- Variabilidade de campos `isActive/isInactive` no payload de Companies.
- Time taken:
- Um ciclo curto de ajuste de política + validação + documentação.
