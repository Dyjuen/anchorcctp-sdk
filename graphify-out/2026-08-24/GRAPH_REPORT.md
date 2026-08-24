# Graph Report - anchorcctp-sdk  (2026-08-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 68 nodes · 70 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `342a4197`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- dependencies
- package.json
- App.jsx
- scripts
- CodeGlimpse.jsx

## God Nodes (most connected - your core abstractions)
1. `scripts` - 5 edges
2. `Solution()` - 2 edges
3. `Taxonomy()` - 2 edges
4. `App()` - 2 edges
5. `AdvancedHero()` - 2 edges
6. `Background()` - 2 edges
7. `CodeGlimpse()` - 2 edges
8. `Deliverables()` - 2 edges
9. `Navbar()` - 2 edges
10. `Problem()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.15
Nodes (13): autoprefixer, devDependencies, autoprefixer, postcss, tailwindcss, @tailwindcss/postcss, vite, @vitejs/plugin-react (+5 more)

### Community 1 - "dependencies"
Cohesion: 0.15
Nodes (13): clsx, framer-motion, lucide-react, dependencies, clsx, framer-motion, lucide-react, react (+5 more)

### Community 2 - "package.json"
Cohesion: 0.18
Nodes (10): author, description, directories, doc, keywords, license, main, name (+2 more)

### Community 3 - "App.jsx"
Cohesion: 0.18
Nodes (8): App(), AdvancedHero(), Background(), Deliverables(), Navbar(), Problem(), Solution(), Taxonomy()

### Community 4 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

## Knowledge Gaps
- **25 isolated node(s):** `autoprefixer`, `tailwindcss`, `postcss`, `@tailwindcss/postcss`, `vite` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `tailwindcss`, `postcss` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._