# Forwarder Contracts & Address Translation

## Address Formatting Discrepancy
- **EVM Chains**: Use 20-byte hex addresses padded to 32 bytes (e.g. `0x0000000000000000000000001234567890abcdef...`).
- **Stellar Accounts**: Use 32-byte Ed25519 public keys encoded as Base32 strkeys starting with `G` with CRC16 checksum (e.g. `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`).

## Forwarder Contract Role
Circle's CCTP on Stellar utilizes a **Soroban Forwarder Contract** to bridge between 32-byte CCTP message format and native Stellar account addresses / trustlines.

## Implementation Guidelines
1. **Never Hand-Derive Raw Keys**: Do not write custom byte manipulation that bypasses Stellar's official `StrKey` encoding validation.
2. **StrKey Validation**:
   - Verify destination addresses using `@stellar/stellar-sdk` `StrKey.isValidEd25519PublicKey(address)`.
   - Reject malformed addresses with `InvalidAddressError`.
3. **Soroban Contract Invocations**:
   - The SDK calls the forwarder contract on Stellar testnet/mainnet using the simulated transaction RPC endpoint (`simulateTransaction` $\rightarrow$ `sendTransaction`).
   - Transaction fees and sequence numbers must be fetched live from Horizon / Soroban RPC.
