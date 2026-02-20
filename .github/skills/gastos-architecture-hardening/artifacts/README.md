# Gastos+ Architecture Hardening - Artifacts

Este diretório contém os outputs gerados pela skill de hardening de arquitetura (Architecture Hardening).

## Estrutura

### Relatório Principal
- `ARCHITECTURE_HARDENING.md` - Relatório completo de hardening de arquitetura (fonte única da verdade)

## Conteúdo do Relatório

O relatório `ARCHITECTURE_HARDENING.md` contém:

1. **Boundary Map** - Módulos/camadas, imports permitidos, direção de dependências
2. **Hardening Findings** - Achados com severidade (Blocker/High/Medium/Low) e exemplos concretos
3. **Hardening Plan** - Passos ordenados com:
   - Escopo
   - Formato esperado do diff
   - Critérios de aceite
   - Testes a adicionar/ajustar
4. **PR Gates** - Checks automatizados e checklist de PR para enforcement
5. **Patches (opcional)** - Pequenos refactors se solicitado pelo usuário

## Uso

Os arquivos neste diretório são gerados automaticamente pela skill e não devem ser editados manualmente.

### Workflow típico:
1. Skill detecta estrutura de build e módulos
2. `scripts/audit_swift_repo.sh <repo-root>` - Identifica violações comuns (opcional)
3. Skill produz boundary map e identifica violações de dependência
4. Skill gera plano de hardening ordenado
5. Skill define PR gates e critérios de aceite
6. Skill cria ARCHITECTURE_HARDENING.md completo
