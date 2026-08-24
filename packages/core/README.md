# @anchor-cctp/core

> Production-ready TypeScript core engine for Stellar Anchors to accept USDC from 23+ CCTP-connected chains via a single function call.

[![npm version](https://img.shields.io/npm/v/@anchor-cctp/core.svg)](https://www.npmjs.com/package/@anchor-cctp/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ⚠️ Security & Non-Audit Disclaimer

> [!CAUTION]
> **Non-Audit Disclaimer (PRD §7.10):**
> This SDK is provided as-is for integration acceleration and has **not** undergone a third-party security audit. While built following strict security invariants (zero private key persistence, mandatory cryptographic attestation verification, replay guards, BigInt-only math, and allow-listed domains), integrators and custody-grade operators must review all signing paths and test thoroughly before handling substantial production value.

---

## Features

- ⚡ **One Function Integration**: `AnchorCCTP.receive()` handles polling, conversion, forwarder translation, and settlement.
- 🔐 **Zero Private Key Storage**: All transaction signing is delegated to caller-supplied callbacks or sponsor env vars.
- 🛡️ **Replay Attack Protection**: Pluggable idempotency store guards against double-crediting.
- 🔢 **Exact Decimal Math**: 6-to-7 decimal scaling using BigInt integer arithmetic with explicit dust routing.
- 🌐 **26 CCTP Domains**: Full registry mapping (Stellar = 27, Base = 6, Ethereum = 0, Arbitrum = 3, etc.).
- 📡 **Typed Lifecycle Events**: `onReceiving`, `onSettled`, `onDustCollected`, `onError`.

---

## Quickstart

### 1. Installation

```bash
npm install @anchor-cctp/core @stellar/stellar-sdk
```

### 2. Usage

```typescript
import { createAnchorCCTP } from '@anchor-cctp/core';

// Initialize SDK instance
const sdk = createAnchorCCTP({
  signer: async (xdr: string) => {
    // Sign the transaction with your anchor's service account or Freighter wallet
    return mySigningCallback(xdr);
  },
  trustline: {
    allowCreation: true,
    spendCapXlm: 2.0,
  },
});

// Listen to lifecycle events
sdk.on('onReceiving', ({ burnTxHash, status, attempt }) => {
  console.log(`[CCTP] Polling ${burnTxHash} (attempt ${attempt}): ${status}`);
});

sdk.on('onSettled', ({ amount, dust, txHash }) => {
  console.log(`[CCTP] Transfer settled! Amount: ${amount} stroops, Tx: ${txHash}`);
});

// Process an inbound cross-chain transfer
async function handleDeposit() {
  const result = await sdk.receive({
    sourceDomain: 6, // Base
    burnTxHash: '0x87a1c38e7f9b8...',
    destinationAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: 10000000n, // 10 USDC (6 decimals)
  });

  console.log('Result:', result);
}
```

---

## Lifecycle Events

| Event | Payload | Description |
|---|---|---|
| `onReceiving` | `{ burnTxHash, status, attempt, elapsedTimeMs, sourceDomain }` | Emitted on each Circle Attestation API poll interval. |
| `onSettled` | `{ amount, dust, txHash, sourceDomain, destinationAddress, timestamp }` | Emitted when USDC has been minted and credited on Stellar. |
| `onDustCollected` | `{ amount, collector, burnTxHash }` | Emitted when non-zero sub-stroop dust is routed to the collector. |
| `onError` | `{ error, burnTxHash }` | Emitted when an unrecoverable deposit failure occurs. |

---

## Supported CCTP Domains (Excerpt)

| Domain ID | Chain Name | Network Type |
|---|---|---|
| **0** | Ethereum | EVM |
| **1** | Avalanche | EVM |
| **2** | OP Mainnet | EVM |
| **3** | Arbitrum | EVM |
| **4** | Noble | Cosmos |
| **5** | Solana | SVM |
| **6** | Base | EVM |
| **7** | Polygon PoS | EVM |
| **27** | **Stellar** | **Stellar (Classic / Soroban)** |
| **37** | X Layer | EVM |

*(All 26 mainnet & testnet domains included)*

---

## License

MIT © [Mother's Grace / Stellar Indonesia](LICENSE)
