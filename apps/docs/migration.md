# Migration guide

For anchor operators: move from custodial bridging rails to AnchorCCTP without rewriting accounting.

Condensed from `docs/migration-guide.md` in the repo. The repo file holds the full before and after backend sample.

1. Install. Run `npm install @anchor-cctp/core` for the backend and add the CLI for ops checks.
2. Publish metadata. Run `anchor-cctp init --domain 27 --usdc-issuer G... --output ./public/.well-known/stellar.toml` with your full issuer key. This advertises your forwarder and supported source domains to wallets.
3. Replace listeners. Remove bespoke chain watchers and decimal dividers. Call `createAnchorCCTP` once, pass your KMS or sponsor `signer`, then call `receive()` per deposit with burn hash, source domain, and Stellar destination.
4. Align accounting. Record 7 decimal stroops where 1 USDC equals 10,000,000. Source 6 decimal units multiply by 10. Sub stroop dust routes to your collector and emits `onDustCollected`.

| Area | Legacy rails | AnchorCCTP |
|---|---|---|
| Chains | 1 to 3 custom integrations | 30 CCTP entries out of the box |
| Finality | 10 to 30 min through a bridge | About 1 to 3 min through Iris |
| Trust | Custodial wallets or multisig | Circle burn and mint plus Soroban |
| Replay | Custom DB per chain | Built in idempotency on normalized hash |
| Errors | Mixed exceptions | Typed `AnchorCCTPError` with remediation |

Pilot with one source domain and a low cap, compare ledger totals daily, then enable the next domain. Keep legacy rails read only until totals match for a full settlement window.

Next: [Core overview](./core/overview) for the `receive()` contract, or [anchor-cctp init](./cli/init) for metadata.
