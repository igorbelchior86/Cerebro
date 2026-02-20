---
name: Design 01 - Visual Inspector
description: Extrator de fatos visuais de telas (sem opinião). Recebe screenshot(s), mede e descreve tipografia, espaçamentos, cores, hierarquia e padrões de layout em formato estruturado para auditoria e execução.
execution_mode: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
---

# Design - Visual Inspector

## Regra de uso (obrigatória)
- Use esta skill sempre por invocação da skill (IDE/CLI).
- Esta skill é read-only: não altera código do produto.
- Não invente fatos. Se algo não puder ser inferido com confiança pela imagem, registre como unknown e explique o porquê.
- Não avalie conformidade com a guia de design aqui. Esta skill só produz fatos e hipóteses verificáveis.

## Objetivo
Extrair fatos objetivos de screenshot(s) de UI e produzir insumos padronizados para as próximas etapas:
1) Rules Auditor (verifica regras contra a guia)
2) UI Engineer (aplica correções no código)

## Entradas
- Um ou mais arquivos de imagem de uma tela do app:
  - PNG, JPG, WEBP
- Opcional: contexto mínimo da tela
  - Nome da tela/rota
  - Device e escala (ex: iPhone 14 Pro, 3x)
  - Trecho de código relacionado (se disponível)

## Saídas (obrigatórias)
Criar ou atualizar:
- `artifacts/VISUAL_FACTS.json`
- `artifacts/VISUAL_REPORT.md`

## O que esta skill mede (sem julgar)
- Tipografia (tamanho relativo, peso aparente, número de estilos, hierarquia)
- Espaçamento (ritmo vertical aproximado, padding e gaps predominantes)
- Grid e alinhamento (colunas aparentes, alinhamentos inconsistentes, offsets recorrentes)
- Cores (contagem aproximada, cores dominantes, neutros, cores de destaque)
- Elementos de conversão (presença e posição de CTA, competição de CTAs)
- Padrões de componentes (botões, cards, inputs, listas, barras, headers)

## Workflow
### Passo 1: Inventário da imagem
1. Identifique:
   - Nome da tela (se visível)
   - Principais regiões: topo, conteúdo, rodapé
   - Componentes repetidos

2. Se houver múltiplas imagens:
   - Agrupe por fluxo (ex: lista -> detalhe -> edição)
   - Marque o estado (vazio, carregando, erro, preenchido)

### Passo 2: Medição e fatos
Use `references/visual-inspection-checklist.md` como guia.
- Meça o que for possível visualmente (aproximações são aceitas, desde que marcadas como aproximação).
- Gere:
  - uma lista de fatos observados
  - uma lista de hipóteses para validar no código quando necessário

### Passo 3: Estruturar em JSON
Preencha `VISUAL_FACTS.json` seguindo `references/visual-facts-schema.md`.

Regras:
- Sempre inclua `confidence` (0 a 1) por item.
- Sempre inclua `evidence` (descrição curta do que na imagem suporta o fato).
- Se for hipótese, marque como hipótese e reduza confiança.

### Passo 4: Relatório humano
Preencha `VISUAL_REPORT.md` usando `assets/VISUAL_REPORT_TEMPLATE.md`.

### Passo 5: Hand-off
A saída desta skill deve permitir que:
- Rules Auditor compare fatos contra a guia de design
- UI Engineer encontre rapidamente o local no código para corrigir

Inclua no relatório:
- "Locais prováveis no código" somente quando houver pista real (ex: texto literal que dá para buscar no repo)

## Critérios de qualidade
- Fatos rastreáveis: todo item tem evidência.
- Sem opinião: evitar termos subjetivos.
- Hipóteses separadas de fatos.
- JSON consistente e pronto para automação.
