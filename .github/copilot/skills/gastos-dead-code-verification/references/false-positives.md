# False Positives (Dead Code)

- Tipos usados apenas por Codable/decoders/migrations
- Conformances consumidas indiretamente (protocol registries)
- Código usado apenas por WidgetKit (não aparece no app)
- Feature-flagged screens (off by default)
- Debug utilities (não shipam em release, mas “vivos” em DEBUG)
