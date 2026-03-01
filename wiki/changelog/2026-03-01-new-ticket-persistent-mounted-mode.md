# New Ticket Persistent Mounted Mode
# What changed
- A rota `/triage/[id]` parou de alternar entre dois `return`s exclusivos para ticket e draft.
- A shell de ticket e a shell de `New Ticket` agora permanecem montadas ao mesmo tempo, e o código só alterna a visibilidade (`display`) entre elas.
- O modo draft inline foi encapsulado em `draftModeLayer`, preservando o bridge de dismiss/seleção/criação já implementado.

# Why it changed
- Mesmo sem `router.push`, ainda havia reconstrução visual porque React desmontava uma árvore inteira e montava outra quando `isDraftMode` mudava.
- O remount vinha do `return` condicional, não mais da navegação.

# Impact (UI / logic / data)
- UI: entrar e sair de `New Ticket` não desmonta mais a árvore React de cada workspace; a troca fica mais imediata e estável.
- Logic: o estado das duas workspaces permanece vivo enquanto a página estiver aberta; a alternância agora é apenas de visibilidade.
- Data: sem mudança de backend; custo adicional de memória/efeitos no frontend porque a workspace de draft fica pré-montada.

# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx

# Date
- 2026-03-01
