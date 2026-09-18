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

## Addendum 2026-09-17 — New findings (N-series, net-new vs C/M above)

- **N1 — `_test` backdoor ships in prod bundle.** `config.ts:30,61,82`, `receive.ts:49,113-119,167-170`. Any holder of config object overrides `fetchImpl/pollAttestation/attestation/hasTrustline/createTrustline` → attestation/trustline/replay bypass. Fix: gate behind `NODE_ENV!=production` or separate test factory; strip from published `.d.ts`.
- **N2 — Emitter throw breaks settlement.** `events/index.ts:82-96` calls listeners sync, no try/catch. Throwing `onReceiving/onSettled` handler bubbles into `receive()` mid-flow (pre/post-mint) → widens C5 crash window. No max listeners → leak. Fix: per-listener try/catch + log, document sync-only, warn past N listeners.
- **N3 — `SPEND_CAP_XLM` NaN bypass (core path).** `testnet-config.ts:184` does `Number(cap)` unchecked (`scripts/testnet-auto.ts:155` validates, factory doesn't). `SPEND_CAP_XLM=abc` → `NaN` → `requiredReserve > NaN` false → cap skipped. Fix: `Number.isFinite` + `>=0` check in `createAnchorCCTPFromEnv`, throw `InvalidConfigError`.
- **N4 — `parseStellarUnits` unbounded BigInt.** `decimals/index.ts:62-73` regex allows unlimited digits → giant `BigInt` alloc DoS; negatives allowed. Fix: cap int digits (e.g. ≤18) + stroops ≤ max supply, reject negative where inappropriate.
- **N5 — Forwarder liveness false-negative.** `testnet/forwarder-check.ts:39-45` `.catch(()=>undefined)` maps network error → `deployed:false`, indistinguishable from not-deployed. `rpcUrl/contractId` unchecked (http OK, no timeout). Fix: throw distinct `RPC_ERROR` vs `NOT_FOUND`; enforce https + `AbortSignal.timeout()` + `StrKey` contract check.
- **N6 — `readAccountState` URL build unsafe.** `testnet/account.ts:28-30` interpolates `horizonUrl/address` raw — no `encodeURIComponent`, no https, no timeout (friendbot call uses encode; this doesn't). Fix: https check + encode + timeout.
- **N7 — `init` TOML injection (extends C10).** `cli/commands/init.ts:48-72` interpolates issuer/forwarder/dust raw into TOML. Quote-break (`"\nEVIL=`) → arbitrary TOML. `mkdir -p` + blind overwrite arbitrary `--output`. Fix: `StrKey` validate all three, reject quotes/newlines, restrict output path + require `--force` outside cwd.
- **N8 — CI supply-chain unpinned (extends C7).** `ci.yml:20,22` uses mutable `actions/checkout@v4`, `setup-node@v4` tags, no SHA pin, no audit gate. Fix: pin SHAs, add `npm audit --omit=dev` blocking step.
- **N9 — `testnet-auto` state TOCTOU + log forgery.** `scripts/testnet-auto.ts:32,66-72,206-208` — `--skip-burn` hash unchecked before replay-check/log/state-write; state JSON read-modify-write no lock → concurrent runs double-settle. Fix: validate `0x+64hex` upfront, atomic write/lock.
- **N10 — `listen --simulate` fake hash.** `cli/commands/listen.ts:105` uses `Math.random` txHash, no `simulate:true` marker, amount `100.000000` (6dp) vs settled `100.0000000` (7dp) → downstream may mistake for real. Fix: sentinel `0xSIM…` hash + `simulate:true` field + docs.

## Addendum 2026-09-17 — New findings (O-series, net-new vs C/M/N above)

- **O1 — Domain allowlist proto bypass [CRITICAL].** `domains/index.ts:49-50` uses `domainId in CCTP_DOMAINS` → proto-chain names pass. Verified: `isSupportedDomain('constructor'|'__proto__'|'toString'|'valueOf')` all `true`; `assertSupportedDomain` returns `function Object()` / `[object Object]` instead of throwing. Any JS caller passing unchecked JSON input bypasses allowlist. Fix: `Object.hasOwn(CCTP_DOMAINS, domainId)` + `Number.isInteger` guard; test proto strings.
- **O2 — Settled amount not bound to attestation [HIGH].** `receive.ts:79,189` — `amount` is caller-supplied, `onSettled` emits `convert6to7(amount)`; attested message never parsed. Caller claims any value → false accounting downstream. Fix: parse amount from attestation message; reject mismatch with `InvalidAmountError`.
- **O3 — `hookData` likely double-encoded [HIGH, verify on-chain].** `evm/hook.ts:20-26` builds length-prefixed bytes (probe: output `0x...0038` + ascii, `0x38` = strkey len); `burn.ts:59,122` passes it as viem `bytes` param → viem adds offset+length again. Forwarder parsing raw data gets wrong recipient → funds stuck/lost. Fix: return raw recipient bytes, let viem encode; assert against known-good testnet burn.
- **O4 — Zero addresses accepted [MEDIUM].** `forwarder/index.ts:63-94`: `0x000...000` (20-byte and 32-byte) translates to `GAAAA...WHF` (probe-confirmed). `burn.ts:46-47`: zero `burnToken` passes `ADDRESS_RE` → `planBurn` ACCEPTED (probe-confirmed). Burn-to-null + wasted gas. Fix: reject zero/empty addresses in both spots.
- **O5 — Replay key not normalized (extends C5) [HIGH].** `receive.ts:91`, `replay/index.ts:20-25` — raw `burnTxHash` as map key. `0xABC…` vs `0xabc…` vs no-`0x` → distinct keys → same transfer double-credits. Fix: normalize (lowercase, enforce `0x` + 64 hex per M1) at `receive()` entry.
- **O6 — Env URL https pin missing + substring bypass [MEDIUM-HIGH].** `testnet-config.ts:175-185`: `CIRCLE_ATTESTATION_BASE_URL` passes straight through, no https check (file path enforces, env path doesn't). `testnet-auto.ts:62-64`: `horizonUrl.includes('testnet')` → `https://evil.com/testnet?x` passes → MITM Horizon/RPC. Same for `EVM_RPC_URL` http override. Fix: reuse `isHttpsUrl` in factory; hostname allowlist in scripts.
- **O7 — Signer oracle unconstrained [MEDIUM].** `testnet-config.ts:162-172` — closure signs ANY XDR passed to it. Any code holding client reference gets arbitrary signatures. Fix: restrict signing to forwarder-mint XDR or document + require explicit confirmation.
- **O8 — `pollIntervalMs`/`maxRetries` dead params [LOW-MEDIUM].** `receive.ts:21-22` defines them, zero references in function body → caller tuning illusion, timeout surprise. Fix: wire through to attestation client or delete from type.
- **O9 — Trustline wrong-network default + cap bypass (extends C8/C9) [MEDIUM].** `trustline/index.ts:20,71`: `usdcIssuer` defaults to TESTNET issuer — mainnet caller omitting it trusts fake USDC. `:53`: `requiredReserveXlm` caller-controlled → pass `0` → `0 > cap` false → spend-cap check skipped. Fix: require explicit issuer per network; clamp `requiredReserve` (no caller override below 0.5).
- **O10 — `testnet-receive` crash + fake settlement [LOW-MEDIUM].** `scripts/testnet-receive.ts:36`: top-level `BigInt(arg(...))` throws raw `SyntaxError` on `--amount abc` outside try → non-JSON exit, breaks CLI JSON contract. Offline stub path prints `settled:true` with `SIGNED_OFFLINE_…`, no `offline:true` marker (same class as N10). Fix: validate amount upfront with JSON error; add marker.
- **O11 — Config aliasing + partial logger [LOW-MEDIUM].** `config.ts:80`: `defaultTrustline: config.trustline` holds live reference → external mutation flips guardrails post-create. `:41,50`: `isLogger` checks only `'info' in obj` → partial logger accepted → `logger.warn` TypeError at runtime. Fix: clone/freeze trustline config; validate full Logger shape.
- **O12 — `onError` emit masks original (extends N2) [LOW].** `events/index.ts:92-94` + `receive.ts:146`: throwing `onError` handler discards original `AttestationVerificationError`; async handler rejection → unhandled rejection. Fix: per-listener try/catch covers `onError` too; test it.
- **O13 — Logger value leak + browser crash [LOW].** `logger/index.ts:12-33`: key-name redaction only — `S...` seed inside a string value passes through unredacted. `:35-37`: bare `process.stderr` throws in browser bundles. Fix: redact value pattern `/^S[A-Z2-7]{55}$/`; guard sink for browser.
- **O14 — Side-effects before validation + arbitrary writes (extends N9) [LOW-MEDIUM].** `testnet-auto.ts`: friendbot funding + trustline submission run before `sourceDomain` allowlist check (receive throws late → wasted 0.5 XLM reserve). `--state`/`--log` accept arbitrary paths, no `--force` (same class as C10/N7). `testnet-deploy.ts:87-88`: write-then-`chmod 0600` leaves 0644 window under typical umask. Fix: validate domain/hash upfront; restrict output paths; `writeFileSync(path, data, { mode: 0o600 })`.
- **O15 — Caller-controlled sequence + destination-as-source [LOW-MEDIUM].** `receive.ts:27,177-180` + `forwarder/index.ts:37`: `sourceSequence` unvalidated string → `new Account(destination, seq)`; source equals destination forces recipient to sign, breaks sponsored-mint flow; stale sequence → stuck tx inside fixed 30s timebounds. Fix: validate numeric sequence; take sponsor source as explicit param, not recipient.

## Suggested fix order

1. O1 (allowlist bypass) + C1, C2, C4 (settlement integrity) + C5/O5 (replay persistence + normalization)
2. O2 (amount binding) + O3 (hook encoding proof) + C3, C8/O9 (trustline guardrails) + C6 (amount required)
3. O4, O6, O7 + C7 (pin + audit gate) + C9, C10
4. M1–M10 + O8, O10–O15 batch + regression tests per fix (TDD per AGENTS.md §1)

## Evidence commands

```
npm run lint && npm run typecheck && npm run test -- --coverage
npm audit --omit=dev
git ls-files | grep -E '^\.env|testnet'   # .env.testnet must stay untracked
ls -la .env.testnet                        # expect -rw------- (600)
rg -n "console\.(log|debug|info|warn|error)" packages/core/src packages/cli/src  # expect no hits
```
