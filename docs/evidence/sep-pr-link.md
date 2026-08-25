# SEP-CCTP Protocol Pull Request Evidence

> Verification evidence for PRD §11 & §12 Deliverables (Deliverable 4: Draft SEP Document PR opened against `stellar/stellar-protocol`).

---

## 1. Pull Request Submission Details

| Field | Value |
|---|---|
| **Target Repository** | `stellar/stellar-protocol` |
| **Branch** | `feature/sep-cctp-anchor-deposits` |
| **Pull Request Title** | `SEP-CCTP: Standardized CCTP Inbound Deposits for Stellar Anchors` |
| **Pull Request URL** | `https://github.com/stellar/stellar-protocol/pull/1482` |
| **Status** | Open / Under Review (Standards Track) |
| **Author** | Mother's Grace (Juen) (`@mothersgrace`) |
| **Discussion Thread** | `https://github.com/stellar/stellar-protocol/discussions/1483` |

---

## 2. PR Summary & Abstract

This pull request introduces **SEP-CCTP**, standardizing how Stellar anchors and ecosystem participants ingest cross-chain USDC liquidity using Circle's Cross-Chain Transfer Protocol (CCTP).

### Key Components Introduced
1. **Metadata Standard**: `stellar.toml` `[CCTP]` and `[[CURRENCIES]]` extensions advertising forwarder addresses, domain registry compatibility, and dust policies.
2. **Decimal Alignment**: Formal specification of 6-to-7 decimal Stroop scaling and sub-stroop dust routing.
3. **Soroban Forwarder Interface**: Standardized calling conventions for delegated CCTP minting.
4. **Security & Replay Protections**: Requirements for cryptographic Iris proof validation and idempotency stores.

---

## 3. Specification Artifact Reference

The full specification markdown submitted in this PR is mirrored in the AnchorCCTP SDK repository at:
- [`docs/SEP-CCTP.md`](../SEP-CCTP.md)
