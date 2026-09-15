# AnchorCCTP SDK

> Accept USDC from any CCTP-connected blockchain on Stellar with a single function call.

AnchorCCTP is a production-grade TypeScript SDK, CLI, and Anchor integration suite enabling Stellar anchors and wallets to ingest cross-chain USDC liquidity seamlessly from Ethereum, Base, Solana, Arbitrum, Avalanche, Polygon, and 20+ other chains using Circle's Cross-Chain Transfer Protocol (CCTP).

---

## Key Capabilities

- **Universal CCTP Routing**: Built-in registry covering all 30 mainnet and testnet CCTP domains.
- **Automated Decimal Alignment**: Lossless 6-to-7 decimal integer scaling ($10^{-6} \to 10^{-7}$) with sub-stroop dust routing.
- **Cryptographic Attestation & Replay Protection**: Automatic Iris proof polling, cryptographic signature verification, and idempotency store.
- **Deterministic Address Translation**: Automatic translation between EVM 20/32-byte hexadecimal addresses and Stellar Ed25519 public keys (`G...`).
- **Trustline Management**: Opt-in USDC trustline inspection and creation with strict XLM reserve spending caps.
- **Machine-Readable CLI**: 4 CLI commands (`init`, `listen`, `verify`, `domains`) emitting clean JSON/NDJSON.

---

## Monorepo Architecture

```
anchorcctp-sdk/
├── packages/
│   ├── core/              # @anchor-cctp/core-sdk Engine (98%+ test coverage)
│   └── cli/               # @anchor-cctp/cli terminal command suite (96%+ test coverage)
├── apps/
│   └── demo/              # Interactive Freighter-integrated CCTP deposit portal
└── docs/
    ├── SEP-CCTP.md        # Standard proposal draft for Stellar ecosystem anchors
    ├── api-reference.md   # Full TypeScript API reference
    ├── migration-guide.md # Migration guide for existing anchors
    └── evidence/          # Verification logs, test receipts, and deployment proofs
```

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@anchor-cctp/core-sdk`](./packages/core) | `1.0.0` | Core SDK Engine — single async function `receive()` |
| [`@anchor-cctp/cli`](./packages/cli) | `1.0.0` | Scriptable CLI suite for terminal & DevOps automation |
| [`apps/demo`](./apps/demo) | `1.0.0` | Freighter-connected React web deposit portal |

---

## Quick Start (Core SDK)

### Installation

```bash
npm install @anchor-cctp/core-sdk
```

### TypeScript Usage

```ts
import { createAnchorCCTP } from '@anchor-cctp/core-sdk';

// 1. Instantiate the SDK client
const cctp = createAnchorCCTP({
  dustCollectorAddress: 'GDDUSTCOLLECTOR00000000000000000000000000000000000000000000',
  trustline: {
    allowCreation: true,
    spendCapXlm: 2,
  },
});

// 2. Subscribe to real-time deposit events
cctp.on('onReceiving', ({ burnTxHash, status, attempt }) => {
  console.log(`[Attesting] ${burnTxHash} (Attempt ${attempt})...`);
});

cctp.on('onSettled', ({ amount, dust, txHash, destinationAddress }) => {
  console.log(`[Settled] Credited ${amount} stroops to ${destinationAddress} (Tx: ${txHash})`);
});

// 3. Receive cross-chain USDC in a single call
const settlement = await cctp.receive({
  sourceDomain: 0, // Ethereum
  burnTxHash: '0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
  destinationAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  amount: 100_000_000n, // 100 USDC (6-decimals)
});

console.log('Stellar Credited Amount:', settlement.amount); // 1_000_000_000n stroops (7-decimals)
```

---

## CLI Usage

```bash
# Install globally or run with npx
npm install -g @anchor-cctp/cli

# 1. Generate stellar.toml CCTP configuration block
anchor-cctp init --domain 27 --usdc-issuer GBBD47IF6... --output ./stellar.toml

# 2. List supported CCTP domains
anchor-cctp domains

# 3. Verify Iris attestation status for a source transaction hash
anchor-cctp verify 0x9a8f4c...

# 4. Stream real-time inbound CCTP transfers for a Stellar address (NDJSON)
anchor-cctp listen GBBD47IF6... --limit 10
```

## testnet:auto (Phase 1)

Fresh testnet account → settled USDC in one command. Flow: env identity → fund check (friendbot) → forwarder liveness → trustline ensure (opt-in, capped) → receive() → Soroban prepare/send → balance-delta assert → receipt JSON on stdout.

```bash
# One command: pass an external EVM burn tx hash
npm run testnet:auto -- --skip-burn 0xABC123... --amount 1000000 --source-domain 6

# Full lifecycle
npm run testnet:deploy                          # 1. create account + .env.testnet
source .env.testnet                             # 2. load secret into env
npm run testnet:auto -- --skip-burn 0xABC123...  # 3. receive + balance-delta receipt
```

Burn hash supplied externally via `--skip-burn` (EVM burn automation = Full phase, below). Requires `STELLAR_DESTINATION` + `STELLAR_SECRET` (real Keypair submitter). Balance-delta receipt emitted on stdout as JSON.

## testnet:auto (Full)

Self-serve burn: omit `--skip-burn` → script burns on Base Sepolia itself, then settles.

```bash
# 1. Base Sepolia ETH (gas) via coinbase/alchemy faucet
# 2. Base Sepolia USDC via faucet.circle.com → your EVM address
# 3. EVM key into .env.testnet (NEVER commit): EVM_PRIVATE_KEY=0x...
env (cat .env.testnet) npm run testnet:auto -- --amount 1000000 --log docs/evidence/testnet-auto.log
```

Flow: chain-pin (testnet allowlist only) → gas/USDC checks → approve-if-needed (exact amount) → `depositForBurnWithHook` (mintRecipient + destinationCaller = forwarder, recipient in hookData) → Iris attest → Phase 1 settle → balance-delta receipt with `evmBurnTxHash`. `--skip-burn` path unchanged. Crash after burn but before settle → resume with `--skip-burn <evmBurnTxHash-from-log>` (re-run would burn again).

---

## Documentation & Standards

- 📄 [**API Reference**](docs/api-reference.md): Complete technical specifications for classes, methods, and configurations.
- 🚀 [**Migration Guide**](docs/migration-guide.md): Guide for anchors migrating to AnchorCCTP.
- 📜 [**SEP-CCTP Specification Draft**](docs/SEP-CCTP.md): Stellar Ecosystem Proposal draft for CCTP deposit standard.
- 🧪 [**Verification Evidence**](docs/evidence/):
  - [CLI 4-Command Output Log](docs/evidence/cli-commands.log)
  - [Demo Deployment & Live stellar.toml](docs/evidence/demo-deploy.md)
  - [SEP Protocol PR Link](docs/evidence/sep-pr-link.md)
  - [Mainnet / Testnet E2E Evidence](docs/evidence/mainnet-e2e.md)

---

## Quality & Security

- **Strict TDD**: All behaviors accompanied by isolated unit and integration tests.
- **Coverage**: ≥90% line and branch coverage across core and CLI packages.
- **Security Guardrails**: No stored private keys, cryptographic verification of all Iris proofs, integer-only BigInt arithmetic, strict spending caps on sponsored trustline creation.

---

## Development

```bash
git clone https://github.com/Dyjuen/anchorcctp-sdk.git
cd anchorcctp-sdk
npm install
npm test
npm run build
```

---

## License

MIT © Mother's Grace (Juen)
