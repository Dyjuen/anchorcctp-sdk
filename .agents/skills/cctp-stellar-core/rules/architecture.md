# Architecture & Monorepo Boundaries

## Overview
AnchorCCTP is structured as a TypeScript monorepo using npm workspaces. The architecture enforces a strict one-way dependency graph to keep core domain logic embeddable in any Node/TS backend without UI or CLI bloat.

## Directory Structure
```
anchorcctp/
├── packages/
│   ├── core/                      # @anchor-cctp/core (Pure TypeScript domain library)
│   │   ├── src/
│   │   │   ├── receive.ts         # Public entrypoint AnchorCCTP.receive()
│   │   │   ├── attestation/       # Circle Attestation API client & polling
│   │   │   ├── decimals/          # 6↔7 conversion & BigInt dust math
│   │   │   ├── forwarder/         # CCTP forwarder contract & address translation
│   │   │   ├── trustline/         # Trustline inspection & creation logic
│   │   │   ├── domains/           # Domain ID allow-list & registry
│   │   │   ├── events/            # Typed event emitter
│   │   │   ├── errors/            # Typed domain error classes
│   │   │   └── index.ts           # Public API surface re-exports
│   │   ├── test/                  # Mirrors src/
│   │   └── package.json
│   │
│   └── cli/                       # @anchor-cctp/cli (Terminal operator tool)
│       ├── src/
│       │   ├── commands/          # init, listen, verify, domains
│       │   └── index.ts
│       ├── test/
│       └── package.json
│
├── apps/
│   └── demo/                      # React + Vite + TailwindCSS + Freighter (Demo anchor UI)
│
├── docs/                          # SEP-CCTP.md, api-reference.md, migration-guide.md
└── .agents/                       # Agent skills, rules, and knowledge graph indexes
```

## Dependency Rules
1. **One-Way Flow**: `apps/demo` → `core`, `cli` → `core`.
2. **Zero Inbound Contamination**: `packages/core` must **NEVER** import from `cli` or `apps/demo`.
3. **Public API Barrier**: External consumers only import from `packages/core/src/index.ts`. Internal sub-modules are implementation details.
4. **Environment Compatibility**: `core` must run in Node.js $\ge 18$ and support both CommonJS (CJS) and ES Modules (ESM).
