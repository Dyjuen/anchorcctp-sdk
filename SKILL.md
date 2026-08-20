---
name: cctp-stellar-integration
description: Use this skill whenever implementing or reviewing code that touches Circle's CCTP (Cross-Chain Transfer Protocol) on Stellar — attestation polling, forwarder/address translation, 6-to-7 decimal USDC conversion, domain ID mapping, or trustline handling. Applies to packages/core and any code that calls into it.
---

# CCTP ↔ Stellar Integration Skill

Domain reference for the AnchorCCTP SDK. Load this before writing or reviewing anything in
`packages/core/src/{attestation,decimals,forwarder,domains,trustline}`.

## 1. Domain ID Mapping

CCTP identifies chains by integer "domain," not chain ID. Stellar's domain is **27**.
The mapping table (`domains/`) must be data-driven (JSON/const map), not hardcoded per call
site, and must reject any `sourceDomain` not present in the table (see AGENTS.md security
checklist).

```ts
// shape, not the literal values — verify current IDs against Circle's published table
// before hardcoding, they occasionally add new chains
export const CCTP_DOMAINS: Record<number, { chain: string; name: string }> = {
  0: { chain: "ethereum", name: "Ethereum" },
  27: { chain: "stellar", name: "Stellar" },
  // ...23+ entries total
};
```

**Pitfall:** don't assume domain IDs are stable across Circle's testnet vs mainnet config —
verify against the live Circle docs at implementation time, not from memory or old snapshots.

## 2. Decimal Conversion (7 ↔ 6)

Stellar-native USDC uses 7 decimal places; CCTP-minted USDC uses 6. Converting 6→7 is exact
(multiply by 10), but the *remainder* only becomes relevant when converting values that
originated with sub-6-decimal precision or when splitting a Stellar-side amount back down —
in practice here, the "dust" is any leftover unit that can't be cleanly represented in the
target precision after rounding in a chosen direction.

**Rules:**
- Always use integer/BigInt arithmetic. Never `Number` or floating point — floats lose
  precision exactly at the boundary that matters for money.
- Decide and document a single rounding direction (round down, dust goes to collector) —
  never round in a way that could mint more than was actually attested.
- Dust is a first-class, tracked value — emitted via `onDustCollected`, not silently dropped.

```ts
// pseudocode shape
function convert6to7(amountBase6: bigint): { stellarAmount: bigint; dust: bigint } {
  const stellarAmount = amountBase6 * 10n;
  const dust = 0n; // 6->7 is exact; dust arises on other conversion paths — verify per direction
  return { stellarAmount, dust };
}
```

Write the property-based test first: for any valid input, `stellarAmount + dust` must never
exceed what was actually attested/minted.

## 3. Forwarder Contract / Address Translation

CCTP messages carry destination addresses as 32-byte values (EVM-style, left-padded). Stellar
`G...` addresses need translation through the CCTP forwarder contract before a mint targets a
real Stellar account.

**Checklist when implementing this module:**
- Never construct or trust a raw 32-byte→G... mapping outside the forwarder contract's own
  translation — don't reimplement address derivation by hand, it's a correctness and security
  risk if the encoding is ever wrong.
- Validate the decoded G... address is well-formed (valid Stellar strkey, correct checksum)
  before using it as a credit target.
- Log the forwarder call's tx hash for every translation, for audit trail — but never log
  private keys involved in signing that call.

## 4. Attestation Polling

Circle's Attestation API returns a message + attestation once the source-chain burn is
finalized. This is typically 5–15 minutes on mainnet, faster on some testnets.

**Implementation rules:**
- Poll with exponential backoff and a hard `maxRetries` / max-duration cap — don't poll
  forever on a burn that will never attest (wrong tx hash, wrong domain, etc.).
- Treat `pending` and `complete` as the only two states to act on; anything else (including
  HTTP errors) is a retryable-or-terminal-error decision, not a silent continue.
- **Never treat a `pending` or unverified response as sufficient to credit an account.** Only
  a fully verified `complete` attestation authorizes settlement — this is the single most
  important security invariant in the whole SDK.
- Write the test for "attestation never arrives" (timeout path) before the happy path — it's
  the case most likely to be skipped and most likely to cause a stuck/duplicate-processing bug.

## 5. Trustline Handling

A Stellar account must have a trustline to the USDC asset before it can receive it.

- Check trustline existence first; only attempt creation if genuinely absent.
- Trustline creation is a transaction that requires XLM reserve + a signer — this must go
  through the same opt-in, capped, explicitly-authorized path as any other signing operation
  (see AGENTS.md §2). Don't auto-create trustlines by default.
- Surface a clear typed error (`TrustlineCreationError` / `TrustlineMissingError`) rather than
  failing the whole `receive()` call with a generic exception, so callers can decide how to
  handle it (prompt the user, auto-create, or abort).

## 6. Common Pitfalls Checklist (use in code review)

- [ ] Any float/`Number` used for amount math? → reject, must be BigInt/integer.
- [ ] Any credit issued before attestation is confirmed `complete` and verified? → reject.
- [ ] Any address used for crediting that wasn't produced by the forwarder contract's own
      translation path? → reject.
- [ ] Any domain ID used that isn't checked against the allow-list? → reject.
- [ ] Any trustline created without the explicit opt-in/cap flag? → reject.
- [ ] Any burn tx hash processed without a replay/idempotency check? → reject.
