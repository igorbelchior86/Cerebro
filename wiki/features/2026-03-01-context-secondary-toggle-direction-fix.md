# Title
Correção da direção semântica do toggle secundário no card de contexto

# What changed
- O componente `CollapseToggleButton` passou a aceitar `expandedDirection` com suporte a `down` e `up`.
- O toggle principal da seção `Context` continua usando a direção padrão (`down`).
- O toggle secundário do card de identidade/metadados opcionais passou a usar `expandedDirection="up"`.

# Why it changed
- O botão secundário fica ancorado no canto inferior direito e expande conteúdo acima dele.
- Reutilizar a mesma rotação do toggle principal criava uma semântica visual inconsistente: o ícone não apontava para a área realmente expandida.

# Impact (UI / logic / data)
- UI: o toggle secundário agora anima na direção correta em relação ao conteúdo que ele expande.
- Logic: mudança local de apresentação; sem alteração funcional.
- Data: nenhuma mudança.

# Files touched
- `apps/web/src/components/PlaybookPanel.tsx`
- `tasks/todo.md`

# Date
2026-03-01
