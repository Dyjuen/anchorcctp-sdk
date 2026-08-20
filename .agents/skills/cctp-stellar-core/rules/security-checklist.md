# Security Checklist for PR & Code Reviews

Verify this checklist on every commit and PR modifying money-moving logic in `packages/core` (`attestation/`, `decimals/`, `forwarder/`, `trustline/`, `receive.ts`):

- [ ] **Zero Private Key Handling**: No secret keys are accepted, stored, persisted, or logged.
- [ ] **Caller Delegation**: Signing is delegated to caller callbacks or runtime service-account env vars.
- [ ] **Mandatory Verification**: Attestation is cryptographically verified with status `complete` prior to any credit/mint step.
- [ ] **Replay Protection**: The `burnTxHash` is verified against an idempotency store. Replays return existing settlement state without double-crediting.
- [ ] **Integer / BigInt Math**: All token conversions and dust math strictly use `BigInt`. No floats or `number`.
- [ ] **Amount Boundary Checks**: Negative (`< 0n`), zero (`=== 0n`), or integer overflow amounts are rejected with typed `InvalidAmountError`.
- [ ] **Domain Allow-List**: `sourceDomain` is verified against the official registry; unknown domains are rejected with `InvalidDomainError`.
- [ ] **Trustline Auto-Creation Cap**: Auto-creating trustlines requires explicit `allowTrustlineCreation: true` and adheres to a strict reserve spending cap (e.g. `2.0 XLM`).
- [ ] **Sanitized Diagnostics**: No secret keys, signatures, or raw payloads are output in stdout, logs, or error traces.
- [ ] **Pinned Security Dependencies**: Crypto and Stellar SDK dependencies are pinned to exact versions with clean `npm audit`.
