# Safe Deletion Checklist (PR separada)

## Regras
- Remoção de código deve ser uma PR separada.
- Proibido misturar com feature/refactor funcional.

## Antes de remover
- [ ] Identificar entrypoints afetados (app + widgets)
- [ ] Confirmar que não é usado por decode/migrations
- [ ] Confirmar que não é fallback de erro
- [ ] Rodar build + testes

## Testes mínimos
- [ ] App launch
- [ ] Navegação Home (root -> month -> day)
- [ ] Ajustes (abrir/fechar, toggles básicos)
- [ ] Widget (se existir target): build + timeline refresh (manual)

## Rollback
- [ ] Plano: revert da PR
