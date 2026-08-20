---
name: graphify
description: Turn any codebase, docs, and configs into a queryable knowledge graph to navigate architecture, extract AST relationships, and achieve up to 71.5x token savings per query.
trigger: /graphify
---

# Graphify — Knowledge Graph & Token Optimizer

Turn this codebase and documentation into a deterministic, queryable knowledge graph.

## Purpose
- **71.5x Token Reduction**: Query specific architecture nodes and relationship paths without reading raw source files repeatedly.
- **Deterministic AST & Concept Graph**: Local tree-sitter AST extraction for TypeScript, Rust, Python, Go, and configs.
- **Audit & Topology**: Generates `graphify-out/` containing `graph.html`, `graph.json`, and `GRAPH_REPORT.md`.

## Commands & Usage

```bash
# 1. Build knowledge graph on current workspace
graphify .

# 2. Query concepts or architecture paths (BFS/DFS)
graphify query "what connects attestation polling to destination credit?"
graphify path "attestation_polling" "forwarder_contract"

# 3. Incremental update (processes only changed files)
graphify . --update

# 4. Generate report only without heavy visualization
graphify . --no-viz
```

## Graph Output Artifacts
- `graphify-out/graph.json`: Machine-readable graph of all functions, classes, specs, and edges.
- `graphify-out/GRAPH_REPORT.md`: God nodes, central modules, cross-file connections.
- `graphify-out/graph.html`: Interactive visual graph for browser inspection.
