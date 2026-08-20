# TDD & Architecture Protocol

This rule governs development workflow, monorepo structure, and testing quality across the AnchorCCTP repository.

## 1. Test-Driven Development (TDD) Enforcement
- **Write the failing test first** (Red) before writing any implementation code.
- **Write minimal code** to make the test pass (Green).
- **Refactor** with all tests green.
- **Never weaken or delete tests** to make a build pass. If a test assertion is incorrect, fix it explicitly with documented rationale.
- Line coverage on `packages/core` must remain **>= 90%**.

## 2. Monorepo Dependency Isolation
- Structure follows npm workspaces:
  - `packages/core`: Pure TypeScript. Zero dependency on CLI or UI libraries.
  - `packages/cli`: Depends on `core`. Outputs valid JSON to `stdout` and human logs to `stderr`.
  - `apps/demo`: React + Vite + TailwindCSS demo with Freighter integration. Depends on `core`.
  - `docs/`: Specification drafts (`SEP-CCTP.md`), API reference, migration guide.
- **Dependency rule**: Direction is strictly one-way (`cli` → `core`, `apps/demo` → `core`). `core` must never import anything from `cli` or `apps/demo`.

## 3. Scope Boundary Invariants
The 30-day Instaward scope is strictly bounded:
- **In-Scope**:
  - `@anchor-cctp/core` (receive flow, attestation polling, forwarder address translation, 6↔7 decimal BigInt math, trustlines, typed events/errors).
  - `@anchor-cctp/cli` (`init`, `listen`, `verify`, `domains` with JSON output).
  - Testnet/Mainnet demo anchor + Freighter demo UI.
  - `SEP-CCTP.md` draft PR against `stellar/stellar-protocol`.
- **Out-of-Scope (Forbidden in this sprint)**:
  - SEP-6/24 auto-deposit triggers ("Hook Relay").
  - Anchor Platform plugins.
  - Outbound CCTP (fiat withdrawal / CCTP-out).
  - Custom Soroban routing contracts.
  - Multi-sig custody or KYC/AML compliance engines.
  - Non-Freighter wallet integrations (MetaMask Snaps, Rabby).

## 4. Code Cleanliness
- No `console.log` statements in production source files (`packages/core/src`, `packages/cli/src`). Use structured loggers or typed lifecycle events.
- All public functions and CLI commands must include concise JSDoc with runnable examples.
