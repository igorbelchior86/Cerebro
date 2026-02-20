---
name: Revisão - Auditoria de código morto
description: Auditoria com evidência de código morto em Swift/SwiftUI. Gera candidatos, valida reachability e produz relatório padronizado (enterprise), sem remover funcionalidade.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Dead Code Verification (Auditor)

## Regra de uso (obrigatória)
- Esta skill deve ser usada **sempre por invocação da skill** (IDE/CLI).
- Se scripts existirem nesta pasta, **o agente deve executá-los** como parte do workflow (sem pedir que o usuário rode comandos).
- Se o ambiente não permitir execução de comandos, a skill deve **degradar graciosamente**: fazer a auditoria por inspeção estática do código e ainda produzir o relatório.

## Propósito
Classificar candidatos a “código morto” com evidência, minimizando risco de regressão. Esta skill **não apaga código**.

## Não-negociáveis
- Não remover funcionalidade, a menos que o usuário peça explicitamente.
- Nunca rotular como “morto” sem evidência.
- Em dúvida: classificar como **Not Proven Dead**.

## Fonte da verdade
- O repositório aberto no workspace (projeto unpacked).

## Saídas (obrigatórias)
- Criar/atualizar `artifacts/DEAD_CODE_REPORT.md`.
- Criar/atualizar `artifacts/DEAD_CODE_CANDIDATES.md` e `artifacts/DEAD_CODE_CANDIDATES.csv` quando possível.

## Classificações (obrigatórias)
Cada item deve ser exatamente um:
- **Confirmed Dead Code**
- **Dormant Code** (feature flag / roadmap)
- **Fallback / Safety Code** (migrations, error paths)
- **Preview-Only Code** (`#Preview`, mocks)
- **Test / Debug Code** (`#if DEBUG`, testes)
- **Legacy but Active Code**
- **Not Proven Dead**

## Workflow

### 1) Mapear entrypoints e fronteiras
Identificar, com paths:
- Entrypoints do app (SwiftUI `@main`, root, tabs/routers)
- Entrypoints de WidgetKit (providers/config)
- Targets/pacotes e responsabilidades (Domain/Core, Data, Sync, Design, UI)
- Composition root / DI (onde dependências são criadas)

Registrar isso no relatório.

### 2) Gerar candidatos automaticamente (preferencial)
Se o ambiente permitir execução:
- Executar: `scripts/dead_code_audit.sh <repo-root>`
- Garantir que os artefatos foram gerados em `artifacts/`:
  - `DEAD_CODE_CANDIDATES.md`
  - `DEAD_CODE_CANDIDATES.csv`

Se não permitir execução:
- Fazer triagem manual (busca por referências e wiring de DI) e criar os arquivos mesmo assim.

### 3) Validar reachability (provar que está vivo)
Para cada candidato:
- Procurar caminhos de runtime:
  - NavigationStack destinations, sheets, toolbar actions
  - Deep links / URL handlers / notificações
  - Wiring no composition root / factories
  - Widget timeline usage/imports
  - Conditional compilation

Se existe caminho: classificar como **Legacy but Active** (ou outra apropriada).

### 4) Burden of proof para “Confirmed Dead”
Só classificar como Confirmed Dead se atender **pelo menos 2**:
- Sem referências no repo (excluindo comentários) **e**
- Não criado/injetado por factories/DI **e**
- Não usado por widgets/extensions **e**
- Não é decode/migration compatibility **e**
- Não é fallback de erro/deep link/feature flag

Se não satisfaz: **Not Proven Dead** (ou Dormant/Fallback se houver evidência).

### 5) Evidência por item (obrigatório)
Para cada item incluir:
- Path(s)
- Symbol(s)
- Classificação
- Confiança (High/Medium/Low)
- Evidência (como foi verificado)
- Próxima ação segura (sem delete por default)

### 6) Recomendar ação segura
- Confirmed Dead: recomendar remoção **apenas** como PR separada, seguindo `assets/SAFE_DELETION_CHECKLIST.md`.
- Outros: recomendar documentação, quarantine, testes, ou mover atrás de flag.

## Formato do relatório (obrigatório)
Use o template: `assets/DEAD_CODE_REPORT_TEMPLATE.md`.

## Falsos positivos comuns
Ver `references/false-positives.md`.
