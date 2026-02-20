# Visual Inspection Report

## Meta
- Screen: Home Dashboard 2026 (lista de visão geral e detalhe de meses)
- Platform: iOS
- Device: iPhone com Dynamic Island (~iPhone 17 Pro)
- Mode: Dark
- Images:
  - user screenshot 1 (dashboard overview)
  - user screenshot 2 (month-detail expansion)

## Fatos observados (sem julgamento)

### Tipografia
- Estilos observados: topo com `Gastos+` e `2026` semi-bold/medium ~18-20pt, cabeçalhos dos cards em ~16-18pt, valores em ~22-24pt, textos auxiliares em cinza claro ~12-14pt.
- Notas: todos os textos se alinham à esquerda dentro de cada card, mantendo consistência por seção.

### Espaçamento
- Padding horizontal dominante: ~16px entre cartões e bordas.
- Gaps verticais dominantes: ~16px entre os cartões principais e ~12px entre elementos internos como dia/valor.
- Densidade: confortável, com espaço suficiente entre os cartões e padding interno generoso sem parecer disperso.

### Layout
- Hipótese de grid: única coluna ampla; os cards preenchem toda a largura disponível com margens laterais constantes (~16px).
- Achados de alinhamento: valores à direita e títulos à esquerda dentro de cada card, barra inferior centralizada com espaçamento uniforme entre ícones.

### Cores
- Cores dominantes: preto profundo (#030304) no fundo, cinza antracite (#1D1F23) nas superfícies, branco (#FFFFFF) no texto principal, verde (#78F39D) para Entradas e indicador de status, vermelho (#F15A5A) para Saídas e CTA urgente, amarelo/laranja (#FFB347) no gradiente do gauge.
- Contagem estimada de cores: 6.
- Indícios de possível baixo contraste (apenas indícios): textos secundários (ex: "53 transações") em cinza claro sobre o fundo cinza escuro podem estar próximos ao limite de contraste.

### CTA
- CTA primário presente: sim, o ícone da casa preenchido em verde destaca-se como ação principal da barra inferior.
- Posição do CTA primário: barra inferior, canto esquerdo.
- Quantidade de CTAs competindo: 4 (ícones de casa, gráfico, engrenagem e lupa na barra inferior).

### Componentes
- Padrões repetidos: cartões arredondados de mês (título, contador e saldo projetado); badges circulares com dia/abrev. da semana na lista expandida; barra inferior com ícones circulares e botões de ação urgente (setas em vermelho/verde).

## Hipóteses para validar no código
- H1: Strings dos meses ("Janeiro", "Fevereiro", ...) provavelmente estão em localization PT ou hardcoded na view da lista mensal; locais prováveis: arquivos de dashboard/listagem de meses.
- H2: O arco multicolorido de status "Este mês" parece vir de um componente gauge customizado que mistura verde/amarelo/vermelho; verificar o componente responsável pelo card principal do mês e as propriedades de cores para garantir consistência.

## Arquivos de saída
- artifacts/VISUAL_FACTS.json
- artifacts/VISUAL_REPORT.md
