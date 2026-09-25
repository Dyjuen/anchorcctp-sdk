# Configuration overview

For anchor engineers and ops staff: where each setting lives.

| Need | `receive()` | CLI | testnet:auto |
|---|---|---|---|
| Network endpoints for Iris, Horizon, RPC | config or env | flags or env | `.env.testnet` |
| `dustCollectorAddress` | required field | `--dust-collector` on init | env var |
| Signing | `signer` callback | none, CLI never settles | `STELLAR_SECRET` in env |
| Trustline opt in plus cap | `allowTrustlineCreation` plus `spendCapXlm` | display only | `TRUSTLINE_ALLOW_CREATION`, default false |
| Replay store | inject a persistent adapter | none | file state through `--state` |

Defaults that protect you: trustline creation stays off until you enable it, the replay default is memory only for tests, and network must be explicit. The SDK throws instead of guessing testnet when `network` is missing.

Next: [Networks](./networks) for URLs, [Keys](./keys) for secrets, [testnet:auto](./testnet-auto) for the script flow.
