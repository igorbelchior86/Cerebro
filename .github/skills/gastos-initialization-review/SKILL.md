---
name: Revisão - Auditoria de inicialização
description: Auditoria de inicialização do app (cold start, warm start e resume) com foco em arquitetura, performance, concorrência e reentradas.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Gastos+ Initialization Review (Startup Auditor)

## Regra de uso (obrigatória)
- Use esta skill **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- Esta skill é **read-only**: não altera arquivos do produto nem cria commits.
- Comandos destrutivos (ex.: `git reset`, `git clean`, rebase/merge) são proibidos.
- **ALINHAMENTO TÉCNICO**: Esta skill deve validar o bootstrap do app conforme `GastosAI-Technical-Authority.md` e respeitar a **Sacred Zone** (AppStore, AppBootstrapRepository).

## Objetivo
Revisar o repositório com foco exclusivo no caminho crítico de inicialização do app, garantindo integridade dos componentes de bootstrap e conformidade com os padrões de autoridade técnica.
- **Cold start** (processo nasce do zero)
- **Warm start** (processo existe, mas reconstrói UI/estado)
- **Resume** (volta do background e reexecuta gatilhos de lifecycle)

## Não-negociáveis
- Não remover funcionalidades.
- Não recomendar mudanças que alterem comportamento sem: impacto + mitigação + plano de validação.
- Foco em: primeira renderização, trabalho no main thread, reentradas, idempotência e cancelamento.
- **SACRED ZONE (Bootstrap)**: Mudanças em `AppStore.swift` e `AppBootstrapRepository.swift` são bloqueadas (P0.3).

## Fonte da verdade
- O repositório aberto no workspace (projeto unpacked).
- `GastosAI-Technical-Authority.md` (Bootstrap & Persistence governance).
- `GastosAI-Design-LiquidGlass.md` (Splash & Initial UI).

## Escopo a inspecionar (padrão)
- App entrypoint (`@main`, App struct) e primeira tela apresentada.
- Composition root / DI (onde dependências são construídas).
- Lifecycle: `scenePhase`, `onAppear`, `.task`, `init`, observers, `@StateObject`.
- Reentradas: background/resume, deep links, notificações, tab reselect.
- `Packages/` (Core/Data/Sync/Design/App/JSBridge) e `GastosSwiftUI/` (ou equivalentes).
- WidgetKit targets (se existirem).

## Saídas (obrigatórias)
Criar/atualizar:
- `artifacts/INITIAL_REVIEW.md`

Gerar (quando possível) insumos em:
- `artifacts/INITIALIZATION_REVIEW_INPUTS/`

## Workflow

### 1) Coletar insumos automaticamente (preferencial)
Se o ambiente permitir execução:
- Executar: `scripts/prepare_initialization_review_inputs.sh <repo-root>` (a partir do diretório desta skill)
- Confirmar geração de `artifacts/INITIALIZATION_REVIEW_INPUTS/`.

Se não permitir execução:
- Fazer inspeção estática manual e ainda produzir o relatório, citando paths/símbolos como evidência.

### 2) Mapear a sequência de startup (cold/warm/resume)
Construir uma linha do tempo observada (ou “provável”), indicando:
- ponto de entrada (`@main`)
- wiring de DI/container
- primeira render (primeira tela)
- side-effects: `onAppear`, `.task`, observers
- inicialização de vendors e IO (disk/network)
- reentradas em resume

### 3) Identificar gargalos e riscos típicos
Aplicar checklist em `references/startup-checklist.md`:
- trabalho pesado no **main thread** antes da primeira render
- init de vendor SDK no caminho crítico
- sync/network no cold start sem necessidade
- agregações pesadas em SwiftUI `body` na primeira tela
- ViewModel fazendo trabalho pesado em `init`
- múltiplos `onAppear/.task` reexecutando sem guard/cancelamento
- observers duplicando no resume
- `scenePhase` sem debouncing/idempotência
- decode/IO pesado no cold start

### 4) Classificar issues por severidade (P0/P1/P2)
Usar `references/severity-rubric.md`.
Cada issue deve ter:
- arquivo(s)/símbolo(s)
- cenário (cold/warm/resume)
- impacto (UI blocked, jank, bateria, repetição, race)
- correção concreta e segura
- validação mínima (como provar a melhoria)

### 5) Produzir relatório padronizado
Usar `assets/INITIAL_REVIEW_TEMPLATE.md` e preencher:
1) Resumo executivo (10 linhas)
2) Top 15 issues de inicialização (P0/P1/P2) com: arquivo(s), motivo, impacto (cold/warm/resume), como corrigir
3) Quick wins focados em startup (até 10)
4) Riscos de regressão e como testar (cold/warm/resume)
5) Recomendações de padrões (SwiftUI lifecycle, ViewModel, estado, performance e concorrência)

## Regras de comando
- OK automático (read-only e rápidos): `git status`, `git diff --stat`, `find`, `rg/grep`, `swift package describe` (somente leitura).
- Não rodar automaticamente por padrão: build completo, `swift test`, profiling/Instruments. Só rodar se o usuário pedir explicitamente.

## Formato do relatório (obrigatório)
Gerar `artifacts/INITIAL_REVIEW.md` usando o template em `assets/INITIAL_REVIEW_TEMPLATE.md`.

## Falsos positivos comuns
Ver `references/false-positives.md`.
