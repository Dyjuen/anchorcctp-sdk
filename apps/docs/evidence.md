# Evidence

For reviewers and milestone owners: proof that each deliverable runs.

A milestone closes when its artifacts exist, not when code merges. PRD section 12 defines the set. Artifacts live in `docs/evidence/` in the repo.

* CLI 4 command JSON output log, `cli-commands.log`
* Core testnet `receive()` execution log, `core-testnet-receive.log`
* Coverage report at or above 90 percent, `coverage-report.html` and `test-coverage-report.md`
* Demo deployment plus live `stellar.toml`, `demo-deploy.md`
* SEP protocol PR link, `sep-pr-link.md`
* Mainnet and testnet end to end record, `mainnet-e2e.md`

When you open a PR, link the evidence file or log excerpt that matches the claim. If an artifact is missing, the milestone stays open.

Next: start a new integration at [What is AnchorCCTP](../overview/what) or [Quick setup](../start/quick-setup).
