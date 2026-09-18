# Security Review — AnchorCCTP SDK

- Date: 2026-09-17
- Scope: `packages/core/src` (receive, attestation, decimals, forwarder, trustline, replay, config, testnet-config, evm, logger), `packages/cli/src/commands`, `scripts/testnet-*.ts`, deps, secrets handling, CI
- Method: `security-review` skill checklist + AGENTS.md §2 (money-moving logic) + PRD §7
- Verdict: **NOT mergeable** for money-moving code paths until Critical items fixed

## Verdict against AGENTS.md §2 checklist

| # | Check | Status |
|---|-------|--------|
| 1 | No private key/secret accepted, stored, or logged by money path | PASS (with note: `testnet-auto.ts:85` duplicates secret read — see Medium M9) |
| 2 | Signing delegated to caller callback / sponsor-key env, never hardcoded | **FAIL** — dummy signer fallback mints with fake signature (C1) |
| 3 | Attestation cryptographically verified before credit/settlement | **FAIL** — shape-only check treated as verified (C4) |
| 4 | `burnTxHash` checked against processed store before crediting; replay = no-op | **FAIL** — in-memory default lost on restart; mark-after-mint window (C5) |
| 5 | Integer/BigInt math, never float | PASS |
| 6 | Negative/zero/overflow rejected with typed error | PARTIAL — zero/negative rejected, **no overflow cap** (M3) |
| 7 | `sourceDomain` allow-listed; unknown rejected | PARTIAL — enforced in `receive()`, **not** in CLI `verify` (M7) |
| 8 | Trustline auto-creation explicit opt-in with spending cap | **FAIL** — defaults to true (C3); cap optional/unbounded (C8) |
| 9 | No secret/key/full payload in logs or errors | PASS (with note: logger redaction misses `password\|token` — M6) |
| 10 | Pinned deps, `npm audit` clean or waived | **FAIL** — caret range on Stellar SDK; 2 high vulns; no audit in CI (C7) |

If any box can't be checked, PR not mergeable. Five boxes fail → do not ship settlement path.

## Critical (must fix before merge)

### C1 — Dummy signer fallback mints without real signature
- File: `packages/core/src/receive.ts:157-161`
- Code: `params.signer || ctx.defaultSigner || (async (xdr) => \`SIGNED_${xdr}\`)`
- Risk: caller omitting signer still gets `submitMint` "success" with bogus `txHash`. Downstream `testnet-auto` treats `res.txHash` as submittable XDR. Fake settlement records enter replay store.
- Fix: throw `MintFailedError` when no signer configured. No default. Add test: `receive()` without signer rejects with typed error.

### C2 — Trustline check silently skipped
- File: `packages/core/src/receive.ts:166-168`
- Code: `ctx._test?.hasTrustline || (async () => true)`
- Risk: production path assumes trustline exists. Credit step proceeds to nonexistent trustline; failure surfaces late as opaque mint error instead of actionable `TrustlineMissingError`.
- Fix: require explicit `hasTrustline` provider (wired to Horizon lookup). Throw `TrustlineCreationError`/config error when missing.

### C3 — Trustline auto-creation defaults to ON
- Files: `packages/core/src/testnet-config.ts:183`, `scripts/testnet-auto.ts:152`
- Code: `(env.TRUSTLINE_ALLOW_CREATION ?? 'true').toLowerCase() === 'true'`
- Risk: violates PRD §7.6 opt-in. Operator not setting var silently funds 0.5 XLM reserves per new account.
- Fix: default `false`. `?? 'false'`. Update `.env.example` comment to state opt-in. Test both defaults.

### C4 — Attestation "verification" is shape-only
- Files: `packages/core/src/attestation/index.ts:66-76`, `packages/core/src/receive.ts:136-148`
- Current: regex + length check on `message`/`signature`. Comment admits full verification deferred to forwarder contract. `receive()` treats pass as verified and emits `onSettled`.
- Risk: violates PRD §7.2 mandatory verification. Shape passes on attacker-crafted hex of right length. Settlement event fires before on-chain confirmation.
- Fix (either): (a) rename to `isWellFormedAttestation`, document forwarder as sole verifier, move `onSettled` emission to after on-chain submit confirmation; or (b) implement real ed25519/secp256k1 sig verify against Circle keys. Minimum: (a) + docs + test asserting malformed-but-long hex still rejected and `onSettled` never fires pre-submit.

### C5 — Replay protection dies on restart + crash window
- Files: `packages/core/src/replay/index.ts`, `packages/core/src/config.ts:68`, `packages/core/src/receive.ts:216-226`
- Current: default `InMemoryReplayStore`; `markProcessed` after mint + events.
- Risk: process restart wipes store → same `burnTxHash` double-credits. Crash between mint submit and `markProcessed` → retry double-mints.
- Fix: ship persistent adapter (file/SQLite), mark in-memory test-only in README/JSDoc. Add pending-state or mark-before-submit with `submitted` flag + reconciliation. Test: restart-simulated (new client, same adapter) rejects replay; crash-between-mint test.

### C6 — Silent default amount 1 USDC
- File: `packages/core/src/receive.ts:79` (`amount = 1000000n`)
- Risk: caller omitting amount credits wrong value. Amount should come from attestation/message, never default.
- Fix: make `amount` required. Fail with `InvalidAmountError` when absent. Long-term: parse amount from attestation message.

### C7 — Dependency hygiene fails
- Files: `packages/core/package.json:47` (`@stellar/stellar-sdk: ^13.1.0`), `.github/workflows/ci.yml` (no audit step)
- Current `npm audit`: 2 high — `toml <=4.1.2` (recursion + prototype pollution) via `@stellar/stellar-sdk <=15.1.0`; installed 13.3.0 affected.
- Risk: violates AGENTS.md §2 box 10 + PRD §7.8. Caret allows auto-upgrade of crypto/Stellar lib.
- Fix: pin exact (`13.3.0`, `viem 2.56.5` already pinned — keep). Add `npm audit --omit=dev` to CI as blocking step. Upgrade stellar-sdk past fixed range or file written waiver with reason + expiry.

### C8 — Spending cap optional = unbounded
- File: `packages/core/src/trustline/index.ts:54`
- Code: `if (params.spendCapXlm !== undefined && ...)` — undefined skips cap entirely.
- Risk: opt-in creation with no cap contradicts "configurable spending cap" requirement.
- Fix: require `spendCapXlm` when `allowCreation true`. Throw `TrustlineCreationError` when missing/non-finite/negative.

### C9 — Forwarder defaults to testnet
- File: `packages/core/src/forwarder/index.ts:20-23`
- Code: `resolveForwarder(undefined)` → `TESTNET_FORWARDER`
- Risk: mainnet caller omitting `network` silently targets testnet contract. Wrong-network mint.
- Fix: require explicit `network`; throw on undefined. Audit all callers (`config.ts:71` uses `config.network` possibly undefined).

### C10 — CLI `init` generates wrong/invalid TOML
- File: `packages/cli/src/commands/init.ts:49-51`
- Defaults: forwarder `CDLZ...` mismatches core `CA66...`; dust collector `GDDUST...` not valid StrKey. No validation of `--usdc-issuer/--forwarder/--dust-collector`. `--output` arbitrary path write (path traversal / overwrite).
- Fix: import `TESTNET_FORWARDER`/issuer constants from core; validate every address with `StrKey`; restrict `--output` to intended filenames/dirs or require `--force` for overwrite outside cwd.

## Medium

- **M1 — `burnTxHash` unvalidated + URL-interpolated.** `attestation/index.ts:88,162`. Add hex format check (`0x + 64 hex` for EVM; documented Stellar form otherwise) + `encodeURIComponent`. Applies to `verify` CLI and scripts too.
- **M2 — `hexToBytes` no validation.** `forwarder/index.ts:25-28`. `Buffer.from(badHex,'hex')` silently truncates. Validate charset + even length before decode; throw `ForwarderContractError` on bad input.
- **M3 — No overflow cap.** `receive.ts:86`, `decimals/index.ts:16,32` check only `>0n`. `cctpAmount*10n` unbounded. Define `MAX_CCTP_AMOUNT` (u64 or supply-derived), reject above with `InvalidAmountError`. Same for `planBurn` amount.
- **M4 — `dustCollectorAddress` never validated.** `receive.ts:191-195` resolves param→cfg→dest with no StrKey check. Validate resolved value; throw typed error.
- **M5 — Untyped address errors.** `forwarder/index.ts:65,85,90` throw generic `Error`; PRD §5.1 requires typed errors only. Add `InvalidAddressError` (code `INVALID_ADDRESS`, remediation) and use in `translateToStellar`, hook builders.
- **M6 — Logger redaction gap.** `logger/index.ts:12` pattern omits `password|token`; `testnet-config.ts:17` includes them. Align to superset (`secret|private|seed|mnemonic|password|token|key`). Add test with `password`/`token` keys.
- **M7 — CLI validation gaps.** `listen.ts`: `--rate-limit` printed never enforced; `HORIZON_URL` http allowed; `--limit NaN` poisons Horizon URL. `verify.ts`: `sourceDomain` NaN/unknown passes to API (no `assertSupportedDomain`); `txHash` format unchecked; `--base-url` https unenforced. Fix: `Number.isFinite` checks, `assertSupportedDomain`, https enforcement (reuse `parseTestnetConfig` helpers), real token-bucket throttle or document flag as display-only.
- **M8 — No fetch timeout.** Attestation polling + `readAccountState` can hang. Add `AbortSignal.timeout()` (e.g. 15s) to every outbound fetch.
- **M9 — Duplicate secret handling.** `testnet-auto.ts:85` re-derives `Keypair.fromSecret` after `createAnchorCCTPFromEnv` already validated it. Reuse validated keypair/signer; minimize secret copies in memory. Zero out references where feasible.
- **M10 — `planBurn` amount edge.** `evm/burn.ts:42` — zero/negative amount only fails incidentally via maxFee check. Add explicit `amount > 0n` + overflow check with `BurnError` code.

## Passed (keep)

- No hardcoded secrets in src/scripts. `.env.testnet` gitignored (`*` via `.env.*`), untracked, mode 600. `.env.example` contains no values.
- `parseTestnetConfig` rejects secret-like keys/values, enforces https + StrKey shapes.
- `testnet-deploy.ts` writes secret 0600, never prints value, validates public config before write.
- `EVM_PRIVATE_KEY` format-checked (`0x+64hex`), sourced from env only, never logged.
- BigInt-only money math. Domain allow-list enforced on `receive()` path.
- Structured JSON logger to stderr with redaction (modulo M6). No `console.log` in `packages/core/src` or `packages/cli/src` (hits are scripts-stderr + demo snippets, no secrets).
- CLI stdout JSON / stderr human split preserved. `executeBurn` chain pin + testnet allowlist + balance/allowance checks + exact-amount approve + receipt verification all present.
- Friendbot calls use `encodeURIComponent`. `testnet-auto` has mainnet pin + testnet host pin.

## Suggested fix order

1. C1, C2, C4 (settlement integrity) + C5 (replay persistence)
2. C3, C8 (trustline guardrails) + C6 (amount required)
3. C7 (pin + audit gate) + C9, C10
4. M1–M10 batch + regression tests per fix (TDD per AGENTS.md §1)

## Evidence commands

```
npm run lint && npm run typecheck && npm run test -- --coverage
npm audit --omit=dev
git ls-files | grep -E '^\.env|testnet'   # .env.testnet must stay untracked
ls -la .env.testnet                        # expect -rw------- (600)
rg -n "console\.(log|debug|info|warn|error)" packages/core/src packages/cli/src  # expect no hits
```
