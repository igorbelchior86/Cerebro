# P0-GRAPH Implementation Seed Schema Projection Query Contracts
# What changed
- The `P0-GRAPH Blueprint (Neo4j + GDS Adaptation)` now includes an explicit `Implementation seed` section to reduce ambiguity before runtime implementation.
- The guide now defines:
  - minimum node identity contract
  - minimum relationship contract
  - required property envelope on relationships
  - projection write contract
  - initial query surface
  - first concrete hint generation contract
  - first deterministic pattern rules
  - rollout-safe fallback behavior
# Why it changed
- The prior blueprint was conceptually sound but still left implementation risk in three areas: schema shape, projection semantics, and the concrete query API.
- Adding these contracts now reduces future drift during implementation and creates an executable architectural baseline for the graph layer.
# Impact (UI / logic / data)
- UI: no immediate UI change, but the future technician context panel now has a more concrete upstream hint payload contract.
- Logic: future implementation is now constrained to specific projection inputs, idempotent write behavior, and named query surfaces such as `graph.expandContext` and `graph.generateHints`.
- Data: graph projection now has a concrete first-pass schema for nodes, relationships, deterministic identity keys, ranking weights, and hint fields.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/Cerebro-Execution-Guide.md
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/architecture/2026-03-01-p0-graph-implementation-seed-schema-projection-query-contracts.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
- 2026-03-01
