# Checklist de inspeção visual (sem opinião)

## 1) Contexto
- [ ] Tela/rota (nome conhecido ou descrição)
- [ ] Plataforma e device (ex: iOS, iPhone 14 Pro)
- [ ] Modo (claro/escuro)
- [ ] Estado (vazio, carregando, erro, preenchido)

## 2) Tipografia
- [ ] Quantos estilos de texto aparentes existem (título, subtítulo, corpo, legenda)?
- [ ] Tamanhos relativos (ex: título ~2x corpo)
- [ ] Peso aparente (regular, semibold, bold)
- [ ] Tracking aparente (títulos grandes mais fechados, texto pequeno mais aberto)
- [ ] Truncation e quebras de linha
- [ ] Consistência de estilos repetidos

## 3) Espaçamento e ritmo
- [ ] Padding lateral predominante
- [ ] Padding vertical predominante
- [ ] Gaps recorrentes (ex: 8, 12, 16, 24)
- [ ] Ritmo vertical consistente entre seções
- [ ] Densidade (compacta vs confortável vs espaçosa)

## 4) Grid e alinhamento
- [ ] Existe uma coluna principal? Existe grid aparente?
- [ ] Itens alinham por borda esquerda/direita?
- [ ] Ícones e labels alinham entre si?
- [ ] Elementos quase alinhados (offset pequeno recorrente)
- [ ] Consistência de largura de cards, botões, inputs

## 5) Cores
- [ ] Cor dominante de fundo e superfícies
- [ ] Cores de texto (primário, secundário, desabilitado)
- [ ] Cor de ação (CTA)
- [ ] Número aproximado de cores distintas
- [ ] Uso de opacidade/transparência
- [ ] Indícios de baixo contraste

## 6) CTA (apenas fatos)
- [ ] Existe CTA primário visível?
- [ ] Onde está (topo, meio, fundo, abaixo da dobra)?
- [ ] Quantos CTAs competem entre si?
- [ ] Estados do CTA (normal, desabilitado, loading)

## 7) Componentes e padrões
- [ ] Botões: forma (raio), altura, padding, ícone
- [ ] Cards: raio, sombra, borda, espaçamento interno
- [ ] Inputs: label, placeholder, erro, helper text
- [ ] Listas: separadores, alinhamento, densidade
- [ ] Navegação: header, back, tabs, toolbar

## 8) Hipóteses para validar no código
- [ ] Liste suspeitas que precisam de confirmação no código
- [ ] Para cada hipótese: onde procurar (view, componente, estilo)
