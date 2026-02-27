# P2-GRAPH Blueprint (Neo4j + GDS) para Cerebro
# What changed
- Foi definido um blueprint arquitetural para introduzir uma camada de grafo madura (`Neo4j + Graph Data Science`) no roadmap P2 do Cerebro.
- O blueprint descreve projeção de grafo tenant-scoped a partir do SSOT, pacote inicial de algoritmos (`Louvain`, `PageRank`, `Shortest Path`, `Node Similarity`), contrato de hints, rollout progressivo e métricas operacionais.
- A proposta mantém `Postgres` como source of truth e posiciona o grafo como camada analítica/read-only para cross-referencing e causal hints.
# Why it changed
- Era necessário formalizar uma base técnica mais madura para engine de cross-referencing, além da fusão atual, com foco em produção de resultados, auditabilidade e segurança multi-tenant.
# Impact (UI / logic / data)
- UI: previsão de exposição read-only de `graph_hints` no contexto técnico em fase posterior (P2).
- Logic: adiciona pipeline de projeção idempotente e algoritmos de grafo como suporte de decisão, sem alterar política de ação automática atual.
- Data: introduz contrato de hints com metadados de algoritmo/proveniência e exige chaves tenant-scoped em nós/arestas.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/Cerebro-Execution-Guide.md
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/architecture/2026-02-26-p2-graph-blueprint-neo4j-gds.md
# Date
- 2026-02-26
