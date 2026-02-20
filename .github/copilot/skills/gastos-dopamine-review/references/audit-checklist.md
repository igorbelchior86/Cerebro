# Audit Checklist (Enterprise)

## Arquitetura / Boundaries
- Dependências unidirecionais? Há ciclos?
- Vendor SDK restrito ao módulo correto?
- UI usa protocolos vs implementações concretas?

## DI / Composition root
- Há container/factories?
- Services são construídos em Views? (anti-pattern)
- Dependências são explícitas no init?

## Estado
- Boolean soup (muitos flags conflitantes)?
- Alertas/modelos de erro consistentes?

## Concorrência
- async/await consistente?
- DispatchQueue isolado?
- UI updates no MainActor?
- Cancelamento em tarefas longas?

## Performance
- Trabalho pesado no SwiftUI `body`?
- Caches/invalidation para agregações?
- Loops/filters/reduces em render?

## Persistência / Modelos
- Mudanças em Codable compatíveis?
- Migrações/decoders considerados?
- IDs estáveis?

## Segurança/Privacidade
- Logs com dados sensíveis?
- Permissões tratadas corretamente?
- Tokens/chaves fora do código?

## Testes
- Domain/Core com unit tests?
- VMs críticas testadas?
- Smoke checklist definido?
