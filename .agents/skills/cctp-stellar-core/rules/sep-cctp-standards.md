# SEP-CCTP Specification Guidelines

## Standards Process
`SEP-CCTP` is a Stellar Ecosystem Proposal submitted as a draft PR to `github.com/stellar/stellar-protocol`.

## Specification Goals
1. Standardize cross-chain CCTP deposit descriptors in `stellar.toml`.
2. Provide standard metadata schemas for anchor wallets and applications to route CCTP transfers natively.
3. Establish a standard for remainder dust accounting and collection across Stellar anchors.

## Required Sections in `docs/SEP-CCTP.md`
- **Preamble**: RFC header (SEP, Title, Author, Status: Draft).
- **Motivation & Problem**: The 7-to-6 decimal mismatch, forwarder contract requirement, and missing deposit abstraction for 37+ live Stellar anchors.
- **Specification Details**: Transfer lifecycle, API interfaces, forwarder address mappings, trustline handling.
- **Security Considerations**: Double-spend / replay prevention, fee reserve caps, unverified attestation risks.
- **Backwards Compatibility**: Seamless interoperability with SEP-6 and SEP-24 anchor deposit flows.
