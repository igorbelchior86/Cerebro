# Gastos+ Diff Review - Artifacts

Este diretório contém os outputs gerados pela skill de revisão de diffs.

## Estrutura

- `DIFF_REVIEW.md` - Relatório principal de revisão do diff
- `DIFF.patch` - Diff consolidado (staged + unstaged) em formato unified
- `DIFF.stat` - Estatísticas do diff (git status, numstat, etc.)
- `CHANGED_FILES.txt` - Lista de arquivos modificados
- `patches/` - Patches sugeridos (opcional, quando aplicável)

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.
Para regenerar, execute o script de preparação a partir do diretório raiz da skill.
