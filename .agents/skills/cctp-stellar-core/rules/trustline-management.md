# Trustline Inspection & Management

## The Stellar Trustline Requirement
A Stellar account cannot hold or receive any non-native asset (such as USDC) until it explicitly establishes a **Trustline** to the asset issuer account.

## Inspection & Verification Flow
1. Fetch account balances from Horizon RPC `loadAccount(destinationAddress)`.
2. Inspect `balances` array for an entry where `asset_code === 'USDC'` and `asset_issuer === USDC_ISSUER_ADDRESS`.
3. If trustline exists: Proceed directly with mint and settlement.

## Guarded Auto-Creation Protocol
Creating a trustline requires an on-chain transaction that consumes:
- Account base reserve: `0.5 XLM`
- Transaction fee: `100–1000 stroops`

### Rules:
1. **Never Create Silently**: Auto-creation must be explicitly opted into via `allowTrustlineCreation: true`.
2. **Spending Cap Enforcement**: A maximum reserve limit `maxTrustlineReserveXlm` must be configured (e.g. `2.0 XLM`). If the required reserve exceeds the cap, abort with `TrustlineCapExceededError`.
3. **Missing Trustline Error**: If `allowTrustlineCreation: false` and trustline is absent, immediately throw `TrustlineMissingError` with remediation instructions for the anchor or user.
