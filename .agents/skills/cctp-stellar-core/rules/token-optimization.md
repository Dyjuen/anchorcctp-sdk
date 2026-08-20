# Token Optimization & Graph Knowledge Retrieval

## Why Knowledge Graph Retrieval Saves Tokens
1. **Context Bloat**: Reading dozens of raw source files, markdown specs, and configs consumes $50\text{k}–100\text{k}+$ tokens per request.
2. **Graph-Indexed Retrieval (Graphify)**: Graphify extracts structural ASTs, dependencies, and semantic relations into a deterministic graph (`graphify-out/graph.json`).
3. **Efficiency Gain**: Querying graph nodes and paths reduces token consumption by up to **71.5x** compared to loading full raw files repeatedly.

## Graph Retrieval Protocols
- Use `/graphify` or Graphify CLI queries to inspect connections between modules before large refactors.
- Query targeted paths: `graphify query "<concept>"` or `graphify path "<sourceNode>" "<targetNode>"`.
- Use progressive disclosure: Load only relevant rule sub-modules under `.agents/skills/*/rules/*.md` instead of full monolith documents.
