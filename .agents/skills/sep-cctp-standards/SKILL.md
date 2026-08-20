---
name: sep-cctp-standards
description: Specification guidelines for drafting SEP-CCTP (Stellar Ecosystem Proposal) and integrating CCTP metadata into stellar.toml.
---

# SEP-CCTP Standards Skill

Load this skill when drafting `docs/SEP-CCTP.md` or configuring `stellar.toml`.

## 1. Specification Objective
Standardize how Stellar anchors advertise and accept cross-chain CCTP deposits without requiring manual bespoke routing per anchor.

## 2. Proposed `stellar.toml` Extension Format
The standard defines a `[[CCTP_DEPOSIT_ENDPOINTS]]` or `[CCTP]` block in the anchor's `stellar.toml`:

```toml
[CCTP]
CCTP_DOMAIN = 27
FORWARDER_ADDRESS = "CA... (Soroban forwarder contract address)"
SUPPORTED_SOURCE_DOMAINS = [0, 1, 2, 3, 6, 7, 5]
DUST_HANDLING = "collector_sweep"
DUST_COLLECTOR_ACCOUNT = "GD... (Stellar dust sink account)"
```

## 3. SEP Document Sections (`docs/SEP-CCTP.md`)
1. **Preamble**: RFC-style header (SEP Number, Title, Authors, Status, Created date).
2. **Abstract**: High-level problem and solution summary.
3. **Specification**:
   - Transfer lifecycle (Source Burn -> Circle Attestation -> Forwarder Resolution -> Stellar Mint & Trustline -> Credit).
   - Decimal conversion standard (6 to 7 decimal alignment and dust sweep accounting).
   - `stellar.toml` metadata schema.
4. **Security Considerations**:
   - Replay attack mitigation via message hash tracking.
   - Guarded trustline reserves and fee sponsorship.
   - Protection against unverified/pending attestation attacks.
5. **Backwards Compatibility**: Integration with existing SEP-6/SEP-24 infrastructure.
