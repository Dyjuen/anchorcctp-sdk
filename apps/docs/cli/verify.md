# anchor-cctp verify

For ops staff: check whether a source burn has a Circle attestation. This command reads state only. It never moves funds.

```bash
anchor-cctp verify 0x3a4b... --source-domain 0
```

Replace `0x3a4b...` with the full `0x` plus 64 hex burn hash. Use `--source-domain 0` for Ethereum, `6` for Base, and so on.

| Flag | Use | Default |
|---|---|---|
| `<txHash>` | Source burn hash, `0x` plus 64 hex | required |
| `--source-domain` | Source CCTP domain ID from the allow list | `0` |
| `--base-url` | Circle Iris API URL, must use https | mainnet or sandbox per network |
| `--max-retries` | Poll attempts before giving up | `30` |
| `--poll-interval` | Start interval in ms for backoff | `1000` |

Stdout example:

```json
{ "txHash": "0x3a4b...", "attested": true, "status": "complete", "sourceDomain": 0, "destinationDomain": 27, "mintTxHash": "0xdef..." }
```

`attested: false` with `pending` means the burn has not finalized. Wait and run the same command again. Only a verified `complete` attestation authorizes settlement inside `receive()`.

If the command rejects the hash, check the `0x` prefix and length. If it rejects the domain, run [domains](./domains) for valid IDs.

Next: [listen](./listen) to stream transfers for an account.
