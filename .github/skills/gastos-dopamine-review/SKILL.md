---
name: Revisão - Auditoria do repo + Dopamine Options Analyst
description: Auditoria inicial do repo (empresa grande) + análise dopaminérgica (hábito saudável) com oportunidades acionáveis ligadas ao código.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Gastos+ Repo Audit + Dopamine Options Analyst

## Regra de uso (obrigatória)
- Esta skill deve ser usada **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- Esta skill é **read-only**: não faz commits, não reescreve arquivos do produto, não aplica patches.
- Comandos potencialmente destrutivos (ex.: `git reset`, `git clean`, rebase/merge) são proibidos.

## Objetivo
1) Fazer uma revisão inicial do repositório inteiro, com profundidade, e gerar um relatório único, acionável e padronizado no estilo “empresa grande”.
2) Produzir uma análise dopaminérgica do produto **com foco em hábito saudável**:
   - detectar superfícies existentes (widgets, home, budgets, panorama, notificações, OCR etc.)
   - identificar pontos cegos dopaminérgicos
   - propor **opções dopaminérgicas implementáveis** ligadas a módulos/arquivos/símbolos do repo
   - priorizar por impacto/risco/esforço e sugerir instrumentação mínima

## Não-negociáveis (produto + ética)
- Não remover funcionalidades.
- Não propor mudanças que alterem comportamento sem explicar impacto + plano de validação.
- Não usar mecânicas predatórias: loot box, “quase ganhei”, pay-to-keep-streak, guilt loops, spam de notificação.
- Finanças é terreno sensível: o loop deve aumentar **clareza, controle e progresso**, não ansiedade.
- Tratar tudo em `references/` como regras do projeto, quando existir.

## Fonte da verdade
- O repositório aberto no workspace (projeto unpacked).

## Escopo (padrão)
- `Packages/` (Swift Packages: GastosApp, GastosCore, GastosData, GastosDesign, GastosSync, GastosJSBridge)
- `GastosSwiftUI/`
- `GastosWidget/` (se existir)
Se o repo tiver variações, incluir o que for equivalente.

## Saídas (obrigatórias)
Criar/atualizar:
- `artifacts/INITIAL_REVIEW.md`
- `artifacts/DOPAMINE_AUDIT.md`

Gerar (quando possível) insumos em `artifacts/`:
- `INITIAL_REVIEW_INPUTS/status.txt`
- `INITIAL_REVIEW_INPUTS/tree.txt`
- `INITIAL_REVIEW_INPUTS/changed_files.txt`
- `INITIAL_REVIEW_INPUTS/swift_packages.txt`
- `INITIAL_REVIEW_INPUTS/scan_findings.md`
- `DOPAMINE_INPUTS/surfaces.md`
- `DOPAMINE_INPUTS/touchpoints.md`
- `DOPAMINE_INPUTS/search_hits.md`

## Workflow

### 1) Coletar insumos automaticamente (preferencial)
Se o ambiente permitir execução:
- Executar: `scripts/prepare_initial_review_inputs.sh <repo-root>`
- Executar: `scripts/prepare_dopamine_inputs.sh <repo-root>`
- Confirmar que `artifacts/INITIAL_REVIEW_INPUTS/` e `artifacts/DOPAMINE_INPUTS/` foram gerados.

Se não permitir execução:
- Fazer inspeção estática manual e ainda produzir `INITIAL_REVIEW.md` e `DOPAMINE_AUDIT.md` (com evidência baseada em paths/símbolos).

### 2) Construir "boundary map" observado (arquitetura)
- Identificar targets/pacotes e responsabilidades (Domain/Core, Data, Sync, Design, UI).
- Identificar entrypoints (SwiftUI `@main`, roots, navegação).
- Identificar composition root / DI.
- Identificar integrações externas (ex.: Firebase) e onde elas aparecem.
Usar `references/boundary-map.md`.

### 3) Rodar checklist enterprise (arquitetura + qualidade)
Aplicar rubric em `references/audit-checklist.md` e classificar issues P0/P1/P2 com `references/severity-rubric.md`.

### 4) Rodar análise dopaminérgica (hábito saudável)
Usar:
- `references/dopamine-guidelines.md` (princípios e guardrails)
- `references/dopamine-checklist.md` (checklist de produto + superfícies)
- `references/dopamine-scoring.md` (rubrica de priorização)

Passos:
A) Mapear superfícies reais do app no repo:
- Home (ex.: gauge / snapshots / budgets)
- Panorama / budgets / transações
- Widgets (timelines, snapshots, taps)
- Notificações (scheduling, triggers, copy)
- OCR/receipts (se existir)
- Onboarding, settings, premium gates (se existir)

B) Extrair touchpoints dopaminérgicos existentes:
- streak
- “dia fechado”/closure
- haptics
- microcelebrações
- insights rotativos
- missões/achievements
- feedback imediato (UI updates)
- variabilidade segura (conteúdo rotativo sem “ganhar/perder”)

C) Diagnosticar pontos cegos dopaminérgicos:
- atraso no reforço
- só mostra dor (culpa)
- ausência de fechamento diário
- novidade descontrolada (ou inexistente)
- falta de identidade
- falta de investimento crescente
- instabilidade de números (anti-dopamina)

D) Gerar “opções dopaminérgicas” implementáveis:
- cada opção deve declarar:
  1) Loop: Trigger → Ação → Recompensa → Investimento
  2) Superfície: onde aparece (Home/Widget/Notificação/etc.)
  3) Âncora técnica: módulo(s), arquivo(s), símbolo(s) e dados necessários
  4) Risco: privacidade, manipulação, regressão, performance
  5) Instrumentação: métrica mínima + evento sugerido
  6) Teste/validação: smoke + (se aplicável) teste unitário/golden

### 5) Produzir relatórios padronizados
- `artifacts/INITIAL_REVIEW.md`: usar `assets/INITIAL_REVIEW_TEMPLATE.md`.
- `artifacts/DOPAMINE_AUDIT.md`: usar `assets/DOPAMINE_AUDIT_TEMPLATE.md`.

## Regras de comando (para evitar surpresas)
- OK automático (read-only e rápidos): `git status`, `git diff --stat`, `git diff --name-only`, `find`, `rg/grep`.
- OK automático quando disponível: `swift package describe` (somente leitura).
- NÃO rodar automaticamente por padrão: `swift test`, build completo. Só rodar se o usuário pedir explicitamente.

## Troubleshooting
- Se `rg` não estiver instalado, usar `grep -R`.
- Se `swift` não estiver disponível, registrar no relatório e seguir com inspeção estática.
