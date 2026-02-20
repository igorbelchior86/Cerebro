# Gastos+ Dead Code Verification - Artifacts

Este diretório contém os outputs gerados pela skill de verificação de código morto (Dead Code Verification).

## Estrutura

### Relatórios
- `DEAD_CODE_REPORT.md` - Relatório principal de auditoria de código morto
- `DEAD_CODE_CANDIDATES.md` - Candidatos a código morto (auto-gerados)
- `DEAD_CODE_CANDIDATES.csv` - Dados dos candidatos em formato CSV

## Classificações

Cada item no relatório deve ser classificado como:
- **Confirmed Dead Code** - Código comprovadamente morto
- **Dormant Code** - Código inativo (feature flag / roadmap)
- **Fallback / Safety Code** - Código de fallback (migrations, error paths)
- **Preview-Only Code** - Código apenas para previews (`#Preview`, mocks)
- **Test / Debug Code** - Código de teste/debug (`#if DEBUG`)
- **Legacy but Active Code** - Código legado mas ainda ativo
- **Not Proven Dead** - Não comprovado como morto

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.

### Workflow típico:
1. `scripts/dead_code_audit.sh <repo-root>` - Gera candidatos automaticamente
2. Skill mapeia entrypoints e fronteiras
3. Skill valida reachability de cada candidato
4. Skill classifica com evidência e confiança
5. Skill gera DEAD_CODE_REPORT.md com recomendações seguras
