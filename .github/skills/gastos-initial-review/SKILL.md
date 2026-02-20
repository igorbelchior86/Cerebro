---
name: Revisão - Auditoria do repo
description: Auditoria inicial do repo (empresa grande) -  arquitetura, boundaries, riscos, performance, testes e segurança.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Gastos+ Initial Review (Repo Auditor)

## Regra de uso (obrigatória)
- Esta skill deve ser usada **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- Esta skill é **read-only**: não faz commits, não reescreve arquivos do produto, não aplica patches.
- Comandos potencialmente destrutivos (ex.: `git reset`, `git clean`, rebase/merge) são proibidos.
- **ALINHAMENTO TÉCNICO**: Esta skill DEVE seguir rigorosamente as definições de `GastosAI-Technical-Authority.md` e `GastosAI-Design-LiquidGlass.md`.

## Objetivo
Fazer uma revisão inicial do repositório inteiro, com profundidade, e gerar um relatório único, acionável e padronizado no estilo “empresa grande” que valide a conformidade com as regras de autoridade técnica e design do projeto.

## Não-negociáveis
- Não remover funcionalidades.
- Não propor mudanças que alterem comportamento sem explicar impacto + plano de validação.
- Tratar tudo em `references/` como regras do projeto, quando existir.
- **SACRED ZONE**: O auditor deve confirmar explicitamente que nenhuma mudança não autorizada foi feita na Sacred Zone (definida em P0.3 do Operational Contract).

## Fonte da verdade
- O repositório aberto no workspace (projeto unpacked).
- `GastosAI-Technical-Authority.md` (Autoridade Técnica).
- `GastosAI-Design-LiquidGlass.md` (Sistema de Design).

## Escopo (padrão)
- `Packages/` (Swift Packages: GastosApp, GastosCore, GastosData, GastosDesign, GastosSync, GastosJSBridge)
- `GastosSwiftUI/`
Se o repo tiver variações, incluir o que for equivalente.

## Saídas (obrigatórias)
Criar/atualizar:
- `artifacts/INITIAL_REVIEW.md`

Gerar (quando possível) insumos em `artifacts/`:
- `INITIAL_REVIEW_INPUTS/status.txt`
- `INITIAL_REVIEW_INPUTS/tree.txt`
- `INITIAL_REVIEW_INPUTS/changed_files.txt`
- `INITIAL_REVIEW_INPUTS/swift_packages.txt`
- `INITIAL_REVIEW_INPUTS/scan_findings.md`

## Workflow

### 1) Coletar insumos automaticamente (preferencial)
Se o ambiente permitir execução:
- Executar: `scripts/prepare_initial_review_inputs.sh <repo-root>` (a partir do diretório desta skill)
- Confirmar que `artifacts/INITIAL_REVIEW_INPUTS/` foi gerado.

Se não permitir execução:
- Fazer inspeção estática manual e ainda produzir `INITIAL_REVIEW.md` (com evidência baseada em paths/símbolos).

### 2) Construir "boundary map" observado
- Identificar targets/pacotes e responsabilidades (Domain/Core, Data, Sync, Design, UI).
- Identificar entrypoints (SwiftUI `@main`, roots, navegação).
- Identificar composition root / DI.
- Identificar integrações externas (ex.: Firebase) e onde elas aparecem.

Usar `references/boundary-map.md` como checklist e registrar no relatório.

### 3) Rodar checklist enterprise (arquitetura + qualidade)
Aplicar rubric em `references/audit-checklist.md`:
- Arquitetura: direções de dependência e imports proibidos
- DI: criação de serviços em Views, dependências implícitas
- Estado: boolean soup, estados conflitantes, alertas
- Concorrência: Task/MainActor/DispatchQueue, cancelamento
- Performance: trabalho pesado no SwiftUI `body`, caches/invalidation
- Segurança/privacidade: logs, permissões, dados sensíveis
- Persistência: Codable/migrações, compatibilidade
- Testes: cobertura mínima por camada

### 4) Classificar issues por severidade (P0/P1/P2)
Usar `references/severity-rubric.md`. Cada issue deve ter:
- arquivo(s) e símbolo(s)
- motivo e impacto real
- correção proposta (concreta)
- plano mínimo de validação/teste

### 5) Produzir relatório padronizado
Usar `assets/INITIAL_REVIEW_TEMPLATE.md` como base e preencher integralmente:
1) Resumo executivo (10 linhas)
2) Top 15 issues (P0/P1/P2) com: arquivo(s), motivo, impacto, como corrigir
3) Quick wins (até 10)
4) Riscos de regressão e como testar
5) Recomendações de padrões (SwiftUI, ViewModel, estado, performance)
6) PR gates sugeridos (opcional, mas recomendado)

## Regras de comando (para evitar surpresas)
- OK automático (read-only e rápidos): `git status`, `git diff --stat`, `git diff --name-only`, `find`, `rg/grep`.
- OK automático quando disponível: `swift package describe` (somente leitura).
- NÃO rodar automaticamente por padrão: `swift test`, build completo, scripts longos. Só rodar se o usuário pedir explicitamente.

## Troubleshooting
- Se `rg` não estiver instalado, usar `grep -R` nos scripts.
- Se `swift` não estiver disponível, registrar no relatório e seguir com inspeção estática.
