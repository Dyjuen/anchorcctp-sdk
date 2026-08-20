---
name: cctp-stellar-core
description: Comprehensive domain rules and engineering standards for AnchorCCTP SDK - attestation polling, decimal math, forwarder contracts, trustlines, domain registry, events, errors, TDD, security, and SEP-CCTP specs.
---

# CCTP ↔ Stellar Core Engineering Skill

Comprehensive reference and rules for building, reviewing, and testing the AnchorCCTP SDK.

## Granular Rules Reference

This skill is organized into modular rule files under `rules/`:

| Rule File | Description |
|---|---|
| [`rules/architecture.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/architecture.md) | Monorepo structure, package boundaries, one-way dependencies |
| [`rules/attestation-polling.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/attestation-polling.md) | Circle Attestation API polling, backoff, jitter, timeouts |
| [`rules/decimals-and-dust.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/decimals-and-dust.md) | 6 ↔ 7 decimal math, BigInt integer arithmetic, dust sweep |
| [`rules/forwarder-contracts.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/forwarder-contracts.md) | EVM 32-byte vs Stellar G... strkeys, Soroban forwarder calls |
| [`rules/domain-registry.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/domain-registry.md) | CCTP domain ID mapping table (Stellar = 27, Ethereum = 0, etc.) |
| [`rules/trustline-management.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/trustline-management.md) | Trustline checking, opt-in creation, spending cap reserve rules |
| [`rules/event-emitter.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/event-emitter.md) | Typed events (`onReceiving`, `onSettled`, `onDustCollected`) |
| [`rules/error-handling.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/error-handling.md) | Standardized typed error hierarchy & actionable remediations |
| [`rules/security-checklist.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/security-checklist.md) | Non-negotiable security checklist for money-moving logic |
| [`rules/testing-tdd.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/testing-tdd.md) | TDD Red-Green-Refactor loop & $\ge 90\%$ line coverage |
| [`rules/cli-contracts.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/cli-contracts.md) | CLI commands (`init`, `listen`, `verify`, `domains`) JSON schema |
| [`rules/sep-cctp-standards.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/sep-cctp-standards.md) | SEP-CCTP RFC specification drafting guidelines |
| [`rules/stellar-toml.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/stellar-toml.md) | `stellar.toml` CCTP metadata extension format |
| [`rules/replay-protection.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/replay-protection.md) | Idempotency store & double-credit prevention |
| [`rules/freighter-integration.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/freighter-integration.md) | Freighter wallet connection, signing, and balance refresh |
| [`rules/token-optimization.md`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/.agents/skills/cctp-stellar-core/rules/token-optimization.md) | Graphify AST & knowledge graph retrieval for token efficiency |
