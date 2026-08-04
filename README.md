# AnchorCCTP SDK

Accept USDC from any CCTP-connected chain in one function call. AnchorCCTP SDK is an open-source TypeScript SDK and CLI that lets any Stellar anchor accept USDC deposits from Ethereum, Solana, Base, Arbitrum, and 20+ other CCTP-connected chains — abstracting decimal conversion, forwarder contracts, attestation polling, and trustline management.

Circle's CCTP went live on Stellar in May 2026. Today, every anchor must independently navigate Stellar's 7-decimal USDC vs CCTP's 6-decimal format, the forwarder contract for G... address translation, Circle Attestation API polling, domain ID mapping (Stellar = 27), and trustline management for inbound USDC. The AnchorCCTP SDK replaces weeks of custom engineering with a single `receive()` call.

## Packages

| Package | Description |
|---|---|
| [`@anchor-cctp/core`](https://www.npmjs.com/package/@anchor-cctp/core) | Core SDK — single public API: `AnchorCCTP.receive(params)` |
| [`@anchor-cctp/cli`](https://www.npmjs.com/package/@anchor-cctp/cli) | CLI tool wrapping the core SDK for scriptable integration |

## Quick Start

```bash
npm install @anchor-cctp/core
```

```ts
import { AnchorCCTP } from '@anchor-cctp/core';

const cctp = new AnchorCCTP({
  rpc: 'https://soroban-mainnet.stellar.org',
  dustCollector: 'G...', // remainder dust collector address
});

cctp.receive({
  burnTxHash: '0x...',       // CCTP burn tx hash from source chain
  sourceDomain: 0,            // Ethereum
  destinationAddress: 'G...', // Stellar anchor address
  onReceiving: (e) => log(e),   // attestation found, mint pending
  onSettled: (e) => credit(e),  // USDC credited to settlement address
  onDustCollected: (e) => log(e),
});
```

What happens under the hood:

1. Polls the Circle Attestation API (configurable retry/backoff) until the mint attestation is ready
2. Calls the CCTP forwarder contract to translate the EVM 32-byte address to a Stellar G... address
3. Converts CCTP 6-decimal USDC to Stellar 7-decimal, routing the remainder dust to the configured dust-collector address
4. Detects the USDC trustline and creates it via the Stellar SDK if missing
5. Credits the settled USDC to the destination address and emits typed events

## CLI

```bash
npm install -g @anchor-cctp/cli

# Generate a stellar.toml CCTP config block
anchor-cctp init

# Stream inbound CCTP transfers to an address (JSON output)
anchor-cctp listen GC...

# Verify whether a CCTP burn has been minted on Stellar
anchor-cctp verify 0x<txHash>

# List all supported CCTP domains
anchor-cctp domains
```

All output is JSON for scriptability.

## SEP-CCTP Spec

[`SEP-CCTP.md`](docs/SEP-CCTP.md) is a SEP-style proposal defining how anchors advertise CCTP deposit support in stellar.toml — `currencies[].cctp.methods`, `currencies[].cctp.source_chains`, `currencies[].cctp.min_amount`, and required stellar.toml fields, with backward compatibility for existing SEP-1 parsers. Proposed as a pull request to [stellar/stellar-protocol](https://github.com/stellar/stellar-protocol).

## Demo Anchor

Live mainnet demo at [anchorcctp.io](https://anchorcctp.io): connect Freighter, initiate a CCTP USDC deposit from any supported chain, and watch the full lifecycle — source-chain burn → attestation → Stellar mint → SDK processing → dust collection → USDC credited to your wallet.

## Development

```bash
git clone https://github.com/Dyjuen/anchorcctp-sdk.git
cd anchorcctp-sdk
npm install
npm run dev
```

## License

MIT
