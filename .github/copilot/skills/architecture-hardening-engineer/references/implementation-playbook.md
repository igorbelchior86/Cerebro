# Implementação (Playbook)

## Padrões alvo (empresa grande)
- Protocolos em Domain/Core
- Implementações em Data/Sync
- Wiring em Composition Root (AppContainer)
- Views nunca instanciam serviços concretos

## Refactor seguro (ordem)
1) Criar protocolo no Core
2) Criar implementação no módulo correto
3) Injetar no container/factory
4) Trocar call sites para usar protocolo
5) Remover dependências incorretas (imports/back edges)
6) Adicionar testes mínimos

## Boolean soup -> estado modelado
- Substituir múltiplos Bool por `enum Operation` e `ViewState`
- Um único source of truth para overlay/alerts

## Async/await
- Preferir async/await end-to-end
- Isolar `DispatchQueue` em adaptadores legados
- Atualizações de UI no MainActor
