# Security Invariants for Money-Moving Logic

This rule is **ALWAYS ON** when writing, reviewing, or refactoring any code in `packages/core` or `packages/cli` (especially `attestation/`, `decimals/`, `forwarder/`, `trustline/`, `receive.ts`).

## 1. Zero Private Key Exposure
- The SDK **must never accept, store, persist, or log** private keys or secrets.
- All transaction signing (trustline creation, mint submissions) must either:
  - Be delegated to a caller-supplied signing callback (`(xdr: string) => Promise<string>`), OR
  - Be performed via a service/sponsor key provided securely via environment variables at runtime.
- Never write secrets, keys, or full transaction payloads to logs or error messages.

## 2. Mandatory Attestation Verification
- **Never credit a destination account or report settlement based on an unverified / pending Circle response.**
- Settlement is only authorized when Circle's Attestation API returns status `complete` and the attestation signature and message hash are verified.

## 3. Replay Protection (Idempotency)
- Every transfer must be uniquely tracked by its `burnTxHash` (or equivalent CCTP message hash).
- Re-executing `receive()` with an already-processed `burnTxHash` must be a safe, idempotent no-op or return the existing settlement record, **never double-crediting**.

## 4. Integer & BigInt Arithmetic for Decimals
- **Never use floating point (`number`) for token amount conversions or dust arithmetic.**
- All 6 ↔ 7 decimal conversions must use `BigInt` or integer arithmetic to eliminate float rounding precision exploits.
- Reject negative (`< 0n`), zero (`=== 0n`), or overflowing amounts with typed errors.

## 5. Domain ID Allow-Listing
- All incoming transfers must have their `sourceDomain` checked against the official CCTP domain registry.
- Any unrecognized domain ID must be rejected immediately with `InvalidDomainError`.

## 6. Guarded Trustline Auto-Creation
- Trustline auto-creation involves XLM reserve consumption.
- It must **always be behind an explicit opt-in flag** with a configurable spending cap (e.g. max XLM spent), never silent or unbounded.
- If the flag is not set and a trustline is absent, fail with a typed `TrustlineMissingError`.

## 7. Strict Typed Errors & Sanitized Output
- Never throw generic `Error` or unhandled exceptions. Use specific typed error classes:
  - `AttestationTimeoutError`
  - `MintFailedError`
  - `TrustlineCreationError`
  - `TrustlineMissingError`
  - `InvalidDomainError`
  - `ReplayTransferError`
  - `InvalidAmountError`
