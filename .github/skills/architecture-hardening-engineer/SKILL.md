---
name: Hardening - Engenheiro/Executor
description: Executa o plano do Arquiteto de hardening (enterprise) - lê o output do auditor, aplica refactors em passos pequenos, adiciona testes e instala PR gates sem quebrar funcionalidade.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Architecture Hardening Engineer (Implementer)

## Relação com o Arquiteto/Auditor (obrigatório)
Esta skill é a continuação direta do **Arquiteto de hardening** (auditor). fileciteturn8file0

### Input principal desta skill (onde procurar)
O Engenheiro deve começar **sempre** lendo este arquivo (gerado pelo auditor):
- `../gastos-architecture-hardening/artifacts/ARCHITECTURE_HARDENING.md`

Se esse arquivo não existir:
- instruir a execução do Arquiteto/Auditor para gerá-lo, e **parar** (não adivinhar plano).

> Regra: o Engenheiro não inventa prioridades. Ele executa o que o Arquiteto definiu.

## Regra de uso (obrigatória)
- Use esta skill **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- Esta skill pode **modificar o código**, mas deve seguir guardrails de segurança e manter comportamento.
- Não executar operações destrutivas de git (reset/clean/rebase) automaticamente.

## Objetivo
Transformar o plano do auditor em mudanças reais no código, com padrão “empresa grande”:
- refactors PR-sized, reversíveis
- testes mínimos adicionados
- PR gates instalados
- evidência de validação (build/test/smoke checklist)

## Não-negociáveis
- Não remover funcionalidades sem pedido explícito.
- Não misturar “refactor arquitetural” com feature nova na mesma etapa.
- Sempre manter o projeto compilável ao final de cada passo (ou deixar o repo claramente em estado falho com instrução de rollback).
- Cada passo deve ter **aceite** e **validação**.

## Saídas (obrigatórias)
Criar/atualizar:
- `artifacts/HARDENING_EXECUTION.md` (log de execução + checklist + próximos passos)

Gerar (quando possível):
- `artifacts/HARDENING_BASELINE.md` (scan pré)
- `artifacts/HARDENING_POST.md` (scan pós)
- `artifacts/HARDENING_PLAN_EXTRACT.md` (plano extraído do relatório do auditor)

## Workflow (end-to-end)

### 0) Localizar e extrair o plano do auditor (obrigatório)
- Executar: `scripts/find_hardening_report.sh <repo-root>`
- Executar: `scripts/extract_plan.sh <repo-root>`
- Se o plano não puder ser extraído, registrar no `HARDENING_EXECUTION.md` e parar.

### 1) Criar baseline (antes de mexer)
Executar `scripts/baseline_checks.sh <repo-root>` e salvar em `artifacts/HARDENING_BASELINE.md`.

Conteúdos mínimos do baseline:
- imports proibidos (vendor em UI, UI em Domain)
- prints fora de DEBUG
- DispatchQueue espalhado
- heurística de “heavy work in SwiftUI body”
- lista de arquivos tocados pelo plano (se disponível)

### 2) Executar o plano em passos pequenos (PR-sized)
Para cada passo do plano (na ordem do auditor):
- **Escopo**: arquivos/módulos que serão tocados
- **Diff shape esperado** (ex.: “extrair protocol”, “mover implementação”, “criar factory”)
- **Aceite**: o que deve ser verdade ao final
- **Validação**: mínimo de build/test/smoke

Implementação:
- aplicar refactor mantendo comportamento
- se precisar criar uma nova camada, preferir:
  - Protocolos em Domain/Core
  - Implementações em Data/Sync
  - Wiring apenas na Composition Root (AppContainer/factories)
- substituir boolean soup por estado modelado quando for parte do passo
- padronizar concorrência (async/await; DispatchQueue isolado)
- mover agregações pesadas para caches/VMs fora do `body`

### 3) Testes mínimos (obrigatório quando tocar fluxo crítico)
Regra:
- se mexer em Domain/Core: adicionar unit tests
- se mexer em fluxo crítico (Home/Ajustes/transações/sync): adicionar ao menos testes de VM ou smoke checklist documentado

O que escrever:
- atualizar `docs/codex/HARDENING_EXECUTION.md` com:
  - quais testes foram adicionados
  - como rodar
  - o que foi smoke-tested manualmente

### 4) Instalar PR gates (se o plano incluir)
- Criar scripts/gates em `scripts/` do repo ou `tools/` (conforme padrão do projeto)
- Atualizar documentação do gate e como rodar localmente
- Registrar no execution log

### 5) Rodar checks pós (obrigatório)
Executar `scripts/post_checks.sh <repo-root>` e salvar em `artifacts/HARDENING_POST.md`.
Comparar baseline vs pós:
- reduziu violações?
- não criou novas violações?

### 6) Produzir o Execution Log final (obrigatório)
Usar `assets/HARDENING_EXECUTION_TEMPLATE.md` e preencher:
- passos executados
- diffs principais (resumo)
- riscos e mitigação
- validação (testes + smoke)
- próximos passos (o que faltou)

## Guardrails de segurança (obrigatórios)
- Mudanças devem ser pequenas e revertíveis.
- Se um passo ficar grande demais, quebrar em subpassos internos e registrar.
- Não “renomear o mundo” (mass rename) a menos que o plano exija.
- Evitar mudanças de formatação sem necessidade.

## Troubleshooting
- Se build/test não estiver disponível no ambiente: documentar claramente que a validação foi estática + smoke checklist sugerida.
- Se o relatório do auditor não existe: instruir execução do Arquiteto e parar.
