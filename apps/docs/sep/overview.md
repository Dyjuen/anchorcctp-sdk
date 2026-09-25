# SEP-CCTP specification

For protocol reviewers and anchor operators: the standard for inbound CCTP deposits on Stellar.

The spec defines unified `stellar.toml` metadata, Soroban forwarder call conventions, the 6 to 7 decimal rule, and mandatory attestation checks. It builds on SEP-6 and SEP-24 as a deposit rail and on SEP-38 for quotes. It changes no existing SEP behavior.

Canonical draft: `docs/SEP-CCTP.md` in the repo. Core excerpt:

```toml
[CCTP]
CCTP_DOMAIN = 27
FORWARDER_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
SUPPORTED_SOURCE_DOMAINS = [0, 1, 2, 3, 5, 6, 7]
DUST_HANDLING = "collector_sweep"
DUST_COLLECTOR_ACCOUNT = "GD..."
```

Security points in the draft: idempotency on `burnTxHash`, signature checks before credit, capped trustline sponsorship, and domain allow listing. Generate a compliant block with [anchor-cctp init](../cli/init) instead of hand editing TOML.

If you review the draft, check the lifecycle diagram, the decimal formulas, and the `stellar.toml` field table first. File spec issues against the repo with the section number.

Next: [Evidence](../evidence) for implementation records.
