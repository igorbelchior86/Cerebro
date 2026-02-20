# Gastos+ Initial Review - Artifacts

Este diretório contém os outputs gerados pela skill de auditoria inicial do repositório.

## Estrutura

- `INITIAL_REVIEW.md` - Relatório principal de auditoria inicial
- `INITIAL_REVIEW_INPUTS/` - Insumos coletados automaticamente pelo script de preparação
  - `status.txt` - Status do git e mudanças
  - `tree.txt` - Estrutura de diretórios do projeto
  - `changed_files.txt` - Lista de arquivos modificados
  - `swift_packages.txt` - Inventário de Swift Packages
  - `scan_findings.md` - Achados de scans heurísticos (imports, prints, force unwraps, etc.)

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.
Para regenerar, execute o script de preparação a partir do diretório raiz da skill.
