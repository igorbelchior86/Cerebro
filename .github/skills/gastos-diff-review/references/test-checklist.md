# Checklist de Testes (mínimo)

## Sempre que mexer em UI / navegação
- App launch
- Home root -> month -> day (se existir)
- Abrir/fechar sheets tocadas
- Ações no toolbar relacionadas

## Sempre que mexer em persistência/modelos
- Criar/editar/deletar registros básicos
- Reabrir app (cold start) e validar leitura
- Se Codable/migrations: validar decode de dados antigos (quando existir)

## Sempre que mexer em sync/vendor
- Login/logout (se aplicável)
- Sync manual (se existir)
- Offline -> online (se fluxo existir)
- Erros simulados e fallback

## Sempre que mexer em concorrência
- Cancelar tarefas (trocar de tela rapidamente)
- Verificar atualização de UI no MainActor

## Sempre que mexer em widgets
- Build do target do widget
- Timeline refresh (manual)
