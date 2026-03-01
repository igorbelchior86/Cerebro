# P0-GRAPH Blueprint BR-ACC Reference and Analytic Primitives
# What changed
- The `P0-GRAPH Blueprint (Neo4j + GDS Adaptation)` in `Cerebro-Execution-Guide.md` was refined to add explicit graph-first analytical primitives for Cerebro.
- The blueprint now states that `BR/ACC Open Graph` (`https://github.com/World-Open-Graph/br-acc`) is a conceptual reference for graph-first cross-referencing, bounded traversal, pattern detection, and probabilistic signals.
- The guide now clarifies that `br-acc` is not a direct implementation target; only its algorithmic approach is being used as inspiration.
- The blueprint now adds explicit primitives for:
  - bounded neighborhood expansion
  - operational pattern rules
  - composite relevance scoring
  - cross-source entity resolution
- The guide now also defines initial user-facing hint classes such as hidden dependency, blast radius, repeated incident cluster, and similar resolved incident beyond lexical match.
# Why it changed
- The prior blueprint already defined the graph platform shape, but it did not explicitly capture the graph-first correlation primitives that make a cross-reference engine useful in practice.
- This refinement aligns the Cerebro roadmap with the intended use of graph analytics for MSP troubleshooting: correlating `Autotask`, `Ninja`, and `IT Glue` signals into advisory evidence.
- The change also records the `br-acc` reference in the correct scope: conceptual/algorithmic inspiration rather than raw engine adoption.
# Impact (UI / logic / data)
- UI: no immediate runtime change, but the planned hint surface is now more explicit about the types of graph hints that should appear in technician context.
- Logic: the blueprint now requires the future graph layer to combine traversal, pattern rules, scoring, and entity resolution instead of relying only on standalone graph algorithms.
- Data: future graph projection now explicitly expects operational weighting fields (`severity`, `recency_weight`, `frequency_weight`, `relation_role`) and deterministic identity stitching keys (`canonical_user_key`, `canonical_device_key`, `canonical_org_key`).
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/Cerebro-Execution-Guide.md
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/architecture/2026-03-01-p0-graph-blueprint-bracc-reference-and-analytic-primitives.md
- /Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md
# Date
- 2026-03-01
