---
name:  Revisão - Diffs
description: Revisão de diffs no estilo PR reviewer (empresa grande) - riscos, regressões, performance, arquitetura e testes.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Gastos+ Diff Review (PR Reviewer)

## Regra de uso (obrigatória)
- Esta skill deve ser usada **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- O agente pode executar comandos **read-only** automaticamente (ex.: `git diff`, `git status`, `rg`, `swift test`).
- Comandos potencialmente destrutivos (ex.: `git reset`, `git clean`, rebase/merge, alterações em massa) **não são permitidos** nesta skill.

## Objetivo
Revisar alterações no repo como se fosse um PR reviewer de empresa grande:
- detectar riscos de regressão e edge cases
- checar performance, concorrência, consistência arquitetural e estilo do projeto
- exigir plano de validação e testes para mudanças sensíveis
- produzir um relatório padronizado e acionável

## Não-negociáveis
- Não remover funcionalidades.
- Não aplicar alterações automaticamente.
- Se identificar risco P0/P1, exigir testes/validação explícitos antes de “merge”.
- Tratar `references/` como regras do projeto, quando existir.

## Fonte da verdade
- O repositório aberto no workspace (projeto unpacked).

## Saídas (obrigatórias)
Criar/atualizar:
- `artifacts/DIFF_REVIEW.md`

Gerar (quando possível) artefatos de apoio:
- `artifacts/DIFF.patch` (unified diff consolidado)
- `artifacts/DIFF.stat` (estatísticas)
- `artifacts/CHANGED_FILES.txt`

## Workflow

### 1) Preparar insumos (preferencial: automático)
Se o ambiente permitir execução:
- Executar: `scripts/prepare_diff_inputs.sh <repo-root>` (a partir do diretório desta skill)
- Confirmar geração em `artifacts/`:
  - `DIFF.patch`
  - `DIFF.stat`
  - `CHANGED_FILES.txt`

Se não permitir execução:
- Obter diff do working tree por inspeção (staged + unstaged) e ainda gerar o relatório.

### 2) Entender intenção
Extrair do diff:
- quais módulos/telas/serviços foram afetados
- se a mudança é refactor, bugfix, feature, performance, ou infra
- se a mudança altera: regras de negócio, persistência, sync, navegação, permissões, pagamentos, ou dados do usuário

Registrar em “Resumo do que mudou”.

### 3) Revisão por arquivo (objetiva)
Para cada arquivo modificado:
- resumir impacto
- apontar riscos (regressão, crash, dados, UX)
- checar consistência com arquitetura do repo (camadas, DI, boundaries)
- checar concorrência (MainActor, cancelamento, async/await vs DispatchQueue)
- checar performance (especialmente SwiftUI `body` e agregações)
- sugerir correções concretas (não “opiniões”)

Sempre que possível, referenciar trechos/linhas aproximadas usando `DIFF.patch`.

### 4) Classificar problemas por severidade (P0/P1/P2)
Usar `references/severity-rubric.md`.

### 5) Exigir validação e testes
Para mudanças sensíveis, adicionar um checklist mínimo de validação:
- build + unit tests
- smoke manual em fluxos-chave
- widget targets (se aplicável)
- migrações/decoders (se modelos mudaram)

Use `references/test-checklist.md`.

### 6) Patch sugerido (opcional)
Se existir uma correção pequena e óbvia:
- sugerir patch **separado** no relatório (trecho de diff)
- NÃO aplicar automaticamente
- se o repo usar pasta de patches, pode escrever em `artifacts/patches/<nome>.patch`

## Formato do relatório (obrigatório)
Use o template: `assets/DIFF_REVIEW_TEMPLATE.md`.
