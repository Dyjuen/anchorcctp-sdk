# Dev B — CLI, Demo, Docs, CI Task Plan

> Companion to `2026-08-24-bootstrap-coordination.md` (read first for global constraints, domain table, current state, handoffs H1–H8).
> Track: **Dev B**. Tags: `dev-b-cli-demo`. CLI tests need root `jest.config.js` updated to cover `packages/cli` (coordinate H1 with Dev A).

## File Structure (this track)
```
packages/cli/
  src/index.ts              (extend: route init/listen/verify/domains)
  src/commands/init.ts      (new)
  src/commands/verify.ts    (new)   <- needs A4
  src/commands/listen.ts    (new)   <- needs A9
  src/commands/domains.ts   (extract from index.ts)
  test/helpers.ts           (new) execa runner
  test/*.test.ts
  package.json              (add bin, execa, scripts)
  README.md                 (new)
apps/demo/                  (REPLACE marketing page)
  package.json src/App.tsx src/wallet/freighter.ts src/components/* vite.config.ts index.html
docs/
  SEP-CCTP.md api-reference.md migration-guide.md README links
  evidence/ (cli-commands.log, demo-deploy.md, sep-pr-link.md, mainnet-e2e.md)
.github/workflows/ci.yml    (new)
```

---

### Task B0: CLI package scaffolding + execa test harness

**Files:** Modify `packages/cli/package.json`; Create `packages/cli/test/helpers.ts`
**Interfaces:** Consumes `@anchor-cctp/core` (existing `CCTP_DOMAINS` usable pre-A0). (H1: agree jest coverage scope with A.)

- [ ] **Step 1: Write failing test**
```ts
import { runCli } from './helpers.js';
test('domains command emits valid JSON array to stdout', async () => {
  const { stdout, code } = await runCli(['domains']);
  expect(code).toBe(0);
  expect(Array.isArray(JSON.parse(stdout))).toBe(true);
});
```
- [ ] **Step 2: Run → FAIL** (no dist / no execa).
- [ ] **Step 3: Implement** — add `bin: { "anchor-cctp": "./dist/index.js" }`, pin `execa` devDep, `build: tsc`, `test: jest`. `helpers.ts` wraps `execa('node', ['dist/index.js', ...args])` → `{ stdout, stderr, code }`. Keep existing `domains` command working.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "chore(cli): scaffold bin + execa functional test harness"`

### Task B1: `init` command (stellar.toml CCTP block)

**Files:** Create `packages/cli/src/commands/init.ts`; Extract `packages/cli/src/commands/domains.ts`; Modify `packages/cli/src/index.ts`; Test `packages/cli/test/init.test.ts`
**Interfaces:** Consumes `core` `CCTP_DOMAINS`/`getDomainMeta` (H3: needs A0 merged). Flags `--domain`, `--usdc-issuer`, `--output`.

- [ ] **Step 1: Write failing test**
```ts
import { runCli } from './helpers.js';
import { readFileSync } from 'fs';
test('init writes stellar.toml CCTP block', async () => {
  const out = '/tmp/cctp-test-stellar.toml';
  const { stdout, code } = await runCli(['init', '--domain', '27', '--usdc-issuer', 'GBISSUER', '--output', out]);
  expect(code).toBe(0);
  const o = JSON.parse(stdout);
  expect(o.success).toBe(true);
  expect(readFileSync(out, 'utf8')).toContain('CURRENCIES');
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — `init.ts` builds `[[CURRENCIES]]` TOML CCTP block (per `cctp-cli-contracts` skill contract), writes to `--output` (default `./stellar.toml`), prints `{ success, configBlock, writtenPath }` JSON to stdout. Validate domain via `getDomainMeta` (unknown → typed error JSON + non-zero exit).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(cli): init command generates stellar.toml CCTP block"`

### Task B2: `verify` command (attestation status)

**Files:** Create `packages/cli/src/commands/verify.ts`; Modify `index.ts`; Test `packages/cli/test/verify.test.ts`
**Interfaces:** Consumes `core` `AttestationClient` (H4: needs A4). Args `<txHash>`.

- [ ] **Step 1: Write failing test** — point `CIRCLE_ATTESTATION_BASE_URL` at a local fixture server or inject; assert JSON `{ txHash, attested, status, sourceDomain, destinationDomain: 27, mintTxHash? }`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — call `AttestationClient.pollAttestation(txHash)`; map to `verify` JSON contract (attested = status complete; destinationDomain always 27). Errors → `{ error, code, remediation }` JSON + non-zero exit.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(cli): verify command checks burn→mint attestation"`

### Task B3: `listen` command (NDJSON event stream)

**Files:** Create `packages/cli/src/commands/listen.ts`; Modify `index.ts`; Test `packages/cli/test/listen.test.ts`
**Interfaces:** Consumes `core` `AnchorCCTP` events + `receive` (H5: needs A9). Args `<address>`.

- [ ] **Step 1: Write failing test** — assert NDJSON lines `{ event, sourceChain, sourceDomain, amount, status, timestamp }` and `{ event: "settled", ..., dust, txHash }`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — subscribe to `AnchorCCTP` events for `<address>`; emit newline-delimited JSON to stdout; human progress to stderr. Rate-limit guardrail (PRD §7.7): cap inbound event processing rate, log to stderr.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(cli): listen streams NDJSON inbound CCTP events"`

### Task B4: CLI functional test sweep + JSON-contract assertions

**Files:** Modify `packages/cli/test/*.test.ts`

- [ ] **Step 1: Add** per-command tests: non-zero exit + `{ error, code, remediation }` on bad input; `domains` shape matches `cctp-cli-contracts` skill.
- [ ] **Step 2: Run → PASS.**
- [ ] **Step 3: Commit** — `git commit -m "test(cli): full command contract + error-shape coverage"`

### Task B5: CLI README + capture 4-command JSON evidence

**Files:** Create `packages/cli/README.md`; Create `docs/evidence/cli-commands.log`

- [ ] **Step 1: Write** CLI README (all 4 commands, flags, JSON output examples).
- [ ] **Step 2: Run** all 4 commands; capture stdout JSON → `docs/evidence/cli-commands.log` (PRD §12).
- [ ] **Step 3: Commit.**

### Task B6: npm publish cli (H7 with A15)

**Files:** Modify `packages/cli/package.json` (`files: ["dist"]`, `bin`, `publishConfig`).

- [ ] **Step 1: `npm run build`** → dist with shebang `#!/usr/bin/env node`.
- [ ] **Step 2: `npm publish --dry-run`.`
- [ ] **Step 3: (Week 4) `npm publish --access public`.`

### Task B7: Demo app rebuild — Freighter CCTP UI (replace marketing page)

**Files:** Rewrite `apps/demo/` — `package.json` (add `@stellar/freighter-api` pinned, `@anchor-cctp/core` dep, `@vitejs/plugin-react`, `react`, `react-dom`, `tailwindcss`), `src/App.tsx`, `src/wallet/freighter.ts`, `src/components/*`, `vite.config.ts`, `index.html`
**Interfaces:** Consumes `@anchor-cctp/core` `createAnchorCCTP` + `receive` + events (H5: needs A9). One-way dep: `demo` → `core`.

- [ ] **Step 1: Write failing test** — `freighter.ts` `connectWallet(): Promise<{ address: string }>`; assert happy + error states render.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — full CCTP deposit lifecycle UI: connect Freighter → pick source chain (from `core` domains) → show `receive()` progress (onReceiving/onSettled/onDustCollected) → error states (trustline missing, attestation timeout) with remediation.
- [ ] **Step 4: `npm run build:demo` → success.**
- [ ] **Step 5: Commit** — `git commit -m "feat(demo): Freighter-integrated CCTP deposit UI (lifecycle + error states)"`

### Task B8: Demo deploy + live `stellar.toml` (H6 with A)

**Files:** Deploy config + `apps/demo/public/stellar.toml` (or root `stellar.toml` at live URL)

- [ ] **Step 1: Generate** `stellar.toml` via `anchor-cctp init` (B1) for demo anchor.
- [ ] **Step 2: Deploy** demo to public URL; confirm `stellar.toml` reachable.
- [ ] **Step 3: Save** URL + `stellar.toml` → `docs/evidence/demo-deploy.md`.

### Task B9: `SEP-CCTP.md` specification draft

**Files:** Create `docs/SEP-CCTP.md`

- [ ] **Step 1: Write** SEP draft: CCTP deposit flow, `stellar.toml` `[[CURRENCIES]]` CCTP extension, forwarder/domain conventions, signature. Align with `cctp-cli-contracts` `init` block.
- [ ] **Step 2: Commit** — `git commit -m "docs: SEP-CCTP specification draft"`

### Task B10: `SEP-CCTP.md` draft PR to stellar/stellar-protocol

- [ ] **Step 1: Fork** `stellar/stellar-protocol`, open PR with `docs/SEP-CCTP.md`. Capture PR link → `docs/evidence/sep-pr-link.md`. (Deliverable = PR opened, not merged — PRD §11.)

### Task B11: API reference + migration guide + root README

**Files:** Create `docs/api-reference.md`, `docs/migration-guide.md`, root `README.md`

- [ ] **Step 1: Write** API reference (every public `core` export), migration guide, root README linking packages + demo + SEP.

### Task B12: CI workflow (H1 + H8 with A14)

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 1: Write** CI: install (committed lockfile), `npm run lint`, `npm run typecheck`, `npm test -- --coverage` (fail <90% core), `npm audit` (clean or waived in writing). Secrets via GitHub Actions secrets only (PRD §7.9).
- [ ] **Step 2: Commit** — `git commit -m "ci: lint + typecheck + coverage gate + audit"`

### Task B13: Security re-check across CLI + demo

- [ ] **Step 1: Verify** AGENTS.md §2 checklist on B-track code: no keys logged, signing delegated, domain allow-list, trustline opt-in. Fix gaps; commit.

### Task B14: Mainnet E2E demo + 3–5 min video (H6 with A)

**Files:** `docs/evidence/mainnet-e2e.md`

- [ ] **Step 1: Rehearse** full flow on testnet (A16).
- [ ] **Step 2: Execute** 1 real mainnet `receive()` with small USDC; capture tx hash + video. Save evidence.
