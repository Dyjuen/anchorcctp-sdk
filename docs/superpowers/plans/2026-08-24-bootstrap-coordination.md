# AnchorCCTP SDK — Bootstrap & Cross-Track Coordination

> Shared context for both dev tracks. Read this FIRST, then your track file:
> - Dev A (core): `2026-08-24-dev-a-core.md`
> - Dev B (cli/demo/docs/ci): `2026-08-24-dev-b-cli-demo-docs.md`

**Goal:** Finish AnchorCCTP SDK to meet all PRD §2.1 Definition-of-Done metrics.

**Architecture:** npm-workspaces monorepo. `core` is pure TS, zero CLI/UI deps. One-way deps: `cli` → `core`, `apps/demo` → `core`. `core` never imports `cli` or `demo`.

**Tech Stack:** TypeScript 5.7 (`NodeNext`), Jest + ts-jest, `@stellar/stellar-sdk` ^13.1.0 (pinned in `core`), execa (cli tests), React + Vite + Tailwind (`apps/demo`), `@stellar/freighter-api`.

**Spec:** `PRD.md` v1.0. Rules: `AGENTS.md`, `.agents/rules/{security-invariants,tdd-and-architecture,prd-scope}.md`, `.agents/skills/cctp-cli-contracts/SKILL.md`.

---

## Global Constraints (apply to EVERY task, both tracks)

- **TDD mandatory:** failing test first (confirm red) → minimal impl (green) → refactor green. Never weaken/delete a test. `core` coverage ≥90% (lines/branches/functions/statements). CI gate: `lint && typecheck && test --coverage`.
- **No private keys ever:** `core` takes a caller-supplied signing callback `(xdr: string) => Promise<string>` (returns signed base64 XDR) or sponsor key via env var. Never accept/store/log a secret; never log full tx payloads.
- **Attestation verification mandatory:** never credit/settle on unverified or non-`complete` Circle response; verify signature + message hash first.
- **Replay protection:** track processed `burnTxHash`; re-`receive()` of a processed hash = safe no-op / returns existing record, never double-credit.
- **BigInt only** for decimal/amount/dust math. Reject `<0n`, `===0n`, overflow with `InvalidAmountError`. No `number`/float.
- **Domain allow-listing:** reject unknown `sourceDomain` with `InvalidDomainError`.
- **Trustline guardrails:** auto-creation opt-in flag + configurable XLM spending cap; if absent and flag off → `TrustlineMissingError`.
- **Typed errors only** (no generic `Error`): `AttestationTimeoutError`, `MintFailedError`, `TrustlineCreationError`, `TrustlineMissingError`, `InvalidDomainError`, `ReplayTransferError`, `InvalidAmountError`.
- **No `console.log` in `core`/`cli` src** — use structured JSON logger (errors → `error`/`code`/`remediation`; human context → stderr for CLI).
- **Direction:** `core` never imports `cli` or `apps/demo`. Public API = only `core/src/index.ts` re-exports. New `core` module → same-named test under `packages/core/test/`.

---

## Current Repo State (already built — do NOT rebuild)

- `core/src/errors/index.ts`: has `AnchorCCTPError` (base), `InvalidDomainError`, `InvalidAmountError`, `AttestationTimeoutError`, `TrustlineMissingError`. **MISSING:** `MintFailedError`, `TrustlineCreationError`, `ReplayTransferError`.
- `core/src/domains/index.ts`: `DomainMeta`, `CCTP_DOMAINS` (only 8 entries), `isSupportedDomain`, `assertSupportedDomain`. **MISSING:** 18 more domains; `getDomainMeta`.
- `core/src/decimals/index.ts`: `convert6to7`, `convert7to6` + tests. Usable as-is.
- `cli/src/index.ts`: `domains` command only. **MISSING:** `init`, `listen`, `verify`.
- `apps/demo`: **marketing landing page** (React/Tailwind/JSX). **MUST be replaced** with Freighter CCTP demo UI (PRD §4.1 Deliverable 3).
- Not yet present: `receive.ts`, `attestation/`, `forwarder/`, `trustline/`, `events/`, `replay/`, `logger/`, `config.ts`.

---

## Authoritative CCTP Domain Table (Circle mainnet; testnet shares same IDs)

Stellar = **27**. Encode exactly this in `domains/index.ts` (Task A0):

| domain | chain | name | networkType |
|---|---|---|---|
| 0 | ethereum | Ethereum | EVM |
| 1 | avalanche | Avalanche | EVM |
| 2 | optimism | OP Mainnet | EVM |
| 3 | arbitrum | Arbitrum | EVM |
| 5 | solana | Solana | SVM |
| 6 | base | Base | EVM |
| 7 | polygon | Polygon PoS | EVM |
| 10 | unichain | Unichain | EVM |
| 11 | linea | Linea | EVM |
| 12 | codex | Codex | EVM |
| 13 | sonic | Sonic | EVM |
| 14 | worldchain | World Chain | EVM |
| 16 | sei | Sei | EVM |
| 18 | xdc | XDC | EVM |
| 19 | hyperevm | HyperEVM | EVM |
| 21 | ink | Ink | EVM |
| 22 | plume | Plume | EVM |
| 25 | starknet | Starknet | EVM |
| 27 | stellar | Stellar | Stellar |
| 28 | edge | EDGE | EVM |
| 29 | injective | Injective | EVM |
| 30 | morph | Morph | EVM |
| 31 | pharos | Pharos | EVM |
| 32 | cronos | Cronos | EVM |
| 37 | xlayer | X Layer | EVM |

(26 domains — matches "23+ chains" in PRD §1.)

---

## Cross-Track Handoffs (do these TOGETHER / in lockstep)

These are the only places the two tracks must synchronize. Everything else is parallel.

| # | What must be done together | Owner(s) | Blocks |
|---|---|---|---|
| H1 | **Repo scaffold alignment:** agree root `tsconfig.base.json`, `jest.config.js` coverage scope (currently only `packages/core`). Dev B's cli tests need jest to cover `packages/cli` too — update root `jest.config.js` projects + `coverageThreshold` together. | A + B | B0, A14 |
| H2 | **Public type contracts freeze:** A8/A9 define `AnchorCCTPConfig`, `ReceiveResult`, `createAnchorCCTP`, event payloads. B must consume exactly these. Freeze names after A9 lands; B2/B3 import from `core`. | A defines, B consumes | B2, B3 |
| H3 | **CLI `domains` command** already exists (cli) but `core` domains incomplete (A0). B1 (`init`) depends on A0's `getDomainMeta`. A0 must merge before B1 runs. | A0 → B1 | B1 |
| H4 | **`AttestationClient`** (A4) is the shared dependency for B2 (`verify`). A4 merges before B2. | A4 → B2 | B2 |
| H5 | **`receive()` + events** (A9) feed B3 (`listen`) and B7 (demo). A9 merges before B3/B7 finalize. | A9 → B3, B7 | B3, B7 |
| H6 | **Integration test fixtures** (A12) and **testnet execution log** (A16) are referenced as evidence by B8/B14. Coordinate the testnet account + `.env.example` secrets so neither track commits keys. | A + B | B8, B14 |
| H7 | **npm publish** (A15 core, B6 cli) must use consistent version + `publishConfig`. Agree version bump timing in Week 4. | A + B | release |
| H8 | **Final coverage gate** (A14) + **CI** (B12) must agree on thresholds and that CI runs both `core` and `cli` coverage. | A + B | CI green |

**Day-1 parallel start (no blocking deps):** A0, A1, A2, A3 (core foundations) ∥ B0 (cli scaffold), B1 setup using existing `CCTP_DOMAINS` (will be replaced by A0 output), B7 demo scaffold, B9/B11/B12 docs/CI drafting.

---

## Out of Scope (binding — do NOT implement, PRD §4.2 / prd-scope.md)

SEP-6/24 auto-deposit ("Hook Relay"), Anchor Platform plugin, outbound CCTP (CCTp-out), custom Soroban routing contracts, multi-sig/KYC/AML, non-Freighter wallets, on-chain indexer, formal audit. If a request touches these, flag it — don't silently build.
