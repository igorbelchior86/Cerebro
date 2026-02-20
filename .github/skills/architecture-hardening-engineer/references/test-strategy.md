# Test Strategy (mínimo)

## Domain/Core
- Unit tests para regras e invariantes

## ViewModels críticos
- Testar: estado inicial, transições, erros, cancelamento (quando aplicável)

## Smoke checklist obrigatório (quando não há testes suficientes)
- App launch
- Home: root -> navegar -> voltar
- Ajustes: abrir/fechar, toggles essenciais
- Criar/editar/deletar transação (se tocado)
- Offline/online e sync (se tocado)
- Widgets (se tocado)
