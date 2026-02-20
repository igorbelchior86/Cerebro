# Gastos+ Initialization Review - Artifacts

Este diretório contém os outputs gerados pela skill de auditoria de inicialização.

## Estrutura

- `INITIAL_REVIEW.md` - Relatório principal de auditoria de inicialização
- `INITIALIZATION_REVIEW_INPUTS/` - Insumos coletados automaticamente pelo script de preparação
  - `status.txt` - Status do git e mudanças
  - `tree.txt` - Estrutura de diretórios
  - `changed_files.txt` - Arquivos modificados
  - `entrypoints.md` - Pontos de entrada da aplicação
  - `lifecycle_hits.md` - Ocorrências de lifecycle do SwiftUI
  - `startup_hotspots.md` - Potenciais gargalos de inicialização
  - `vendor_imports.md` - Imports de SDKs externos

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.
Para regenerar, execute o script de preparação a partir do diretório raiz da skill.
