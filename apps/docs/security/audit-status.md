# Audit status

For integrators and reviewers: what review exists today and what is still open.

* No third party audit. The SDK ships as is for integration speed under PRD section 7.10. Review all signing paths and test before you handle substantial value.
* Internal review: `docs/SECURITY-REVIEW.md` in the repo. Current verdict is not mergeable for money moving paths until critical items close, including signer fallback, shape only verification wording, in memory replay default, trustline defaults, and dep hygiene.
* Waivers: `docs/AUDIT-WAIVERS.md` in the repo. One entry covers `toml` at or below 4.1.2 through pinned `@stellar/stellar-sdk 13.3.0`. That code parses `stellar.toml` only, sits outside the hot path, and takes no attacker input. Revisit on the v17 migration.
* Supported versions: 1.0.x. Report vulnerabilities privately to denardyjuen@gmail.com. Do not open public issues with payloads, hashes tied to funds, or keys attached.

If any item above is unclear, read the linked review file in full before you integrate.

Next: [Evidence](../evidence) for logs and coverage artifacts.
