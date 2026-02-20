# Heurísticas e falsos positivos comuns

- `DispatchQueue` em adaptadores legados pode ser aceitável, mas deve ser isolado.
- Código “sem referência direta” pode ser acionado via:
  - DI factories / registries
  - WidgetKit providers
  - Codable/decoders/migrations
  - Deep links / handlers de notificações
- Mudanças pequenas em models podem quebrar decode silenciosamente (P0 se persistência real).
