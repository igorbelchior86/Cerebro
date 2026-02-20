# Architecture Hardening Engineer - Artifacts

Este diretório contém os outputs gerados pela skill de engenharia de hardening (Architecture Hardening Engineer).

## Estrutura

### Relatórios e Logs
- `HARDENING_EXECUTION.md` - Log de execução completo (checklist + próximos passos)
- `HARDENING_PLAN_EXTRACT.md` - Plano extraído do relatório do auditor
- `HARDENING_BASELINE.md` - Scan de baseline (antes das mudanças)
- `HARDENING_POST.md` - Scan pós-mudanças (para comparação)
- `HARDENING_REPORT_PATH.txt` - Path para o relatório do auditor (gerado por find_hardening_report.sh)

## Dependência do Auditor

Esta skill depende do output do **gastos-architecture-hardening** (auditor).

O arquivo de input esperado é:
- `../gastos-architecture-hardening/artifacts/ARCHITECTURE_HARDENING.md`

Se este arquivo não existir, a skill instrui a execução do auditor primeiro.

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.

### Workflow típico:
1. `scripts/find_hardening_report.sh <repo-root>` - Localiza o relatório do auditor
2. `scripts/extract_plan.sh <repo-root>` - Extrai o plano do relatório
3. `scripts/baseline_checks.sh <repo-root>` - Gera baseline antes das mudanças
4. Skill executa o plano em passos PR-sized
5. `scripts/post_checks.sh <repo-root>` - Gera scan pós-mudanças
6. Skill cria HARDENING_EXECUTION.md com log completo
