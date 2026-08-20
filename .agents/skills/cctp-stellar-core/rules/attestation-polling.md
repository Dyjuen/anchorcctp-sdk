# Attestation Polling Specification

## Purpose
Abstracts Circle's Cross-Chain Transfer Protocol (CCTP) Attestation Service polling, verifying that a source chain burn transaction has been finalized and signed by Circle before authorizing a mint on Stellar.

## Endpoints
- **Testnet**: `https://iris-api-sandbox.circle.com/attestations/{messageHash}`
- **Mainnet**: `https://iris-api.circle.com/attestations/{messageHash}`

## State Transition & Lifecycle
1. **Source Burn**: The user burns USDC on the origin chain (e.g. Ethereum, Base, Solana).
2. **Message Hash Derivation**: The burn transaction emits a `MessageSent` event containing the raw message bytes. The SHA256 / Keccak256 hash is computed.
3. **Polling Loop**:
   - Initial delay: `2000ms`
   - Backoff multiplier: `1.5x` with random jitter ($\pm 10\%$)
   - Max poll interval cap: `15000ms`
   - Max timeout: Configurable (default `20 minutes` on mainnet, `5 minutes` on testnet).
4. **Status Evaluation**:
   - `pending`: Emit `onReceiving({ status: 'pending', attempt, elapsedTimeMs })` and continue polling.
   - `complete`: Parse the attestation signature bytes, verify structure, and proceed to minting/crediting.
   - HTTP errors ($5xx$ / network drops): Retry with backoff until timeout.
   - Terminal errors ($404$ after grace period, $400$ bad hash): Throw `AttestationNotFoundError`.

## Security Invariants
- **NEVER authorize mint or settlement on a `pending` status.**
- Always require verified `complete` signature from Circle's Iris API.
- If timeout is reached, throw `AttestationTimeoutError` with actionable diagnosis.
