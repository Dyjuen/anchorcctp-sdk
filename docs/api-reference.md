# AnchorCCTP SDK — Full API Reference

Comprehensive reference documentation for `@anchor-cctp/core` and `@anchor-cctp/cli`.

---

## Table of Contents
1. [Core Engine (`createAnchorCCTP`)](#1-core-engine-createanchorcctp)
2. [Receive Lifecycle (`receive`)](#2-receive-lifecycle-receive)
3. [Domain Registry (`CCTP_DOMAINS`)](#3-domain-registry-cctp_domains)
4. [Decimal Arithmetic & Dust](#4-decimal-arithmetic--dust)
5. [Forwarder & Address Translation](#5-forwarder--address-translation)
6. [Trustline Management](#6-trustline-management)
7. [Replay Protection Store](#7-replay-protection-store)
8. [Circle Iris Attestation Client](#8-circle-iris-attestation-client)
9. [Lifecycle Events](#9-lifecycle-events)
10. [Error Classes & Codes](#10-error-classes--codes)
11. [CLI Commands](#11-cli-commands)

---

## 1. Core Engine (`createAnchorCCTP`)

Factory function that creates an instance of the AnchorCCTP client.

```ts
import { createAnchorCCTP, AnchorCCTP, AnchorCCTPConfig } from '@anchor-cctp/core';

const client: AnchorCCTP = createAnchorCCTP(config: AnchorCCTPConfig);
```

### `AnchorCCTPConfig` Interface
| Property | Type | Default | Description |
|---|---|---|---|
| `attestationBaseUrl` | `string` | `https://iris-api.circle.com` | Circle Iris Attestation API base endpoint. |
| `pollIntervalMs` | `number` | `2000` | Initial polling interval in milliseconds. |
| `maxRetries` | `number` | `60` | Max attempts before throwing `AttestationTimeoutError`. |
| `dustCollectorAddress`| `string` | Destination address | Stellar account designated to receive sub-stroop dust. |
| `signer` | `SignerCallback` | Simulated signer | Custom transaction signing callback `(xdr: string) => Promise<string>`. |
| `trustline` | `TrustlineConfig` | `{ allowCreation: false }` | Trustline auto-creation and reserve spend cap policy. |
| `replayStore` | `ReplayStore` | In-memory store | Custom persistence store for processed transaction hashes. |

---

## 2. Receive Lifecycle (`receive`)

Executes the atomic 4-step deposit workflow: attestation polling → cryptographic verification → trustline check/creation → forwarder mint → decimal scaling.

```ts
const result: ReceiveResult = await client.receive(params: ReceiveParams);
```

### `ReceiveParams`
| Property | Type | Required | Description |
|---|---|---|---|
| `sourceDomain` | `number` | Yes | CCTP source chain domain ID (e.g. `0` for Ethereum, `6` for Base). |
| `burnTxHash` | `string` | Yes | 32-byte hexadecimal source burn transaction hash (`0x...`). |
| `destinationAddress` | `string` | Yes | Destination Stellar public key (`G...`) or 20/32-byte EVM address. |
| `amount` | `bigint` | No (default `1000000n`) | USDC amount in source 6-decimal base units ($1 \text{ USDC} = 10^6$). |
| `allowTrustlineCreation`| `boolean` | No (default `false`) | Opt-in flag to automatically sponsor missing USDC trustlines. |
| `spendCapXlm` | `number` | No (default `2`) | Maximum XLM reserve sponsorship cap. |

### `ReceiveResult`
| Property | Type | Description |
|---|---|---|
| `amount` | `bigint` | Credited Stellar amount in 7-decimal Stroops ($10^{-7}$). |
| `dust` | `bigint` | Fraction of raw units swept to dust collector ($< 10^{-6}$). |
| `txHash` | `string` | Stellar mint transaction hash. |
| `settled` | `boolean` | `true` when transfer successfully completed. |

---

## 3. Domain Registry (`CCTP_DOMAINS`)

Official CCTP Domain ID Mapping for 26 mainnet and testnet blockchains.

```ts
import { CCTP_DOMAINS, getDomainMeta, isSupportedDomain, DomainMeta } from '@anchor-cctp/core';

const meta: DomainMeta = getDomainMeta(6); // Base: { domainId: 6, chain: 'base', name: 'Base', networkType: 'EVM' }
const isValid: boolean = isSupportedDomain(27); // true
```

---

## 4. Decimal Arithmetic & Dust

Integer math scaling between 6-decimal external CCTP chains and 7-decimal Stellar stroops.

```ts
import { convert6to7, convert7to6, formatStellarUnits, parseStellarUnits } from '@anchor-cctp/core';

// 6 to 7 decimal scaling
const { stellarAmount, dust } = convert6to7(100_000_000n); // 100 USDC -> 1_000_000_000n stroops, dust: 0n

// Format for display
const formatted: string = formatStellarUnits(1_000_000_000n); // "100.0000000"
```

---

## 5. Forwarder & Address Translation

Translates EVM hexadecimal addresses into Stellar StrKey Ed25519 addresses and submits delegated mint transactions.

```ts
import { translateToStellar, submitMint } from '@anchor-cctp/core';

const stellarAddr: string = translateToStellar('0x1234567890123456789012345678901234567890');
// Returns "GB..."
```

---

## 6. Trustline Management

Validates and creates USDC trustlines with reserve spending cap validation.

```ts
import { ensureTrustline } from '@anchor-cctp/core';

await ensureTrustline({
  destination: 'GB...',
  allowCreation: true,
  spendCapXlm: 2
});
```

---

## 7. Replay Protection Store

Idempotency tracking ensuring no burn transaction hash is credited more than once.

```ts
import { ReplayStore, SettlementRecord } from '@anchor-cctp/core';

const store = new ReplayStore();
const processed: boolean = await store.isProcessed('0xburn_hash...');
```

---

## 8. Circle Iris Attestation Client

Polls Circle Iris Attestation API with exponential backoff and cryptographic signature verification.

```ts
import { AttestationClient } from '@anchor-cctp/core';

const client = new AttestationClient({ maxRetries: 30, pollIntervalMs: 2000 });
const result = await client.pollAttestation('0xburn_hash...');
const verified = client.verifyAttestation(result.message, result.signature);
```

---

## 9. Lifecycle Events

Strongly typed lifecycle event system.

```ts
client.on('onReceiving', ({ burnTxHash, status, attempt, sourceDomain }) => { ... });
client.on('onSettled', ({ amount, dust, txHash, destinationAddress, timestamp }) => { ... });
client.on('onDustCollected', ({ amount, collector, burnTxHash }) => { ... });
client.on('onError', ({ error, burnTxHash }) => { ... });
```

---

## 10. Error Classes & Codes

All errors inherit from `AnchorCCTPError` and include structured `code` and `remediation` fields.

| Error Class | Code | Remediation |
|---|---|---|
| `InvalidDomainError` | `INVALID_DOMAIN` | Provide a supported sourceDomain (e.g. 0 for Ethereum, 6 for Base, 27 for Stellar). |
| `InvalidAmountError` | `INVALID_AMOUNT` | Ensure the amount is a positive BigInt value (> 0n). |
| `AttestationTimeoutError` | `ATTESTATION_TIMEOUT` | Increase pollTimeoutMs or retry once the source chain burn transaction has finalized. |
| `TrustlineMissingError` | `TRUSTLINE_MISSING` | Pass allowTrustlineCreation: true or establish a USDC trustline on the destination account. |
| `MintFailedError` | `MINT_FAILED` | Verify forwarder contract deployment, destination account status, or retry mint transaction. |
| `TrustlineCreationError` | `TRUSTLINE_CREATION_FAILED` | Ensure destination account is funded with sufficient XLM to cover base reserves or increase spendCapXlm. |
| `ReplayTransferError` | `REPLAY_TRANSFER` | This burn transaction has already been processed and settled. Check existing settlement records. |

---

## 11. CLI Commands

| Command | Description | Output |
|---|---|---|
| `anchor-cctp domains` | Lists 26 supported CCTP domain IDs and chain names. | JSON array to `stdout` |
| `anchor-cctp init` | Generates standard `stellar.toml` CCTP block. | JSON config summary to `stdout` |
| `anchor-cctp verify <txHash>` | Queries and verifies Circle Iris attestation status. | JSON attestation status to `stdout` |
| `anchor-cctp listen <address>` | Streams inbound CCTP transfers for a Stellar address. | NDJSON event stream to `stdout` |
