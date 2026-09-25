# Security policy

For contributors and reviewers: merge gates for money moving code.

Money moving code means `attestation/`, `decimals/`, `forwarder/`, and `trustline/`. A PR that touches those paths merges only when every box holds. An unchecked box blocks merge. State it in the PR instead of burying it in the description.

* No private key or secret accepted, stored, or logged on the money path.
* Signing delegated to a caller callback or an explicit sponsor key from env. Never hardcoded.
* Attestation checked with cryptography before any credit or settlement.
* `burnTxHash` checked against a persistent processed store first. Replay is a no op, never a double credit.
* Amount math in integer and `bigint` only. Negative, zero, and overflow inputs rejected with typed errors.
* `sourceDomain` checked against the allow list. Unknown domains rejected explicitly.
* Trustline auto creation behind explicit opt in with a required spending cap. Never silent, never unbounded.
* No secret, key, or full payload in logs or error messages.
* Crypto and Stellar deps pinned exact. `npm audit` clean or waived in writing with reason and expiry.

AnchorCCTP targets mainnet, so these gates block merge rather than advise. Testnet only helpers do not relax them.

Next: [Audit status](./audit-status) for the current verdict and waivers.
