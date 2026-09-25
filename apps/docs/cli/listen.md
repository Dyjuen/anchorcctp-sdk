# anchor-cctp listen

For ops staff: stream inbound CCTP transfers for one Stellar account as newline delimited JSON.

```bash
anchor-cctp listen GBBD47IF6... --limit 10
```

Replace `GBBD47IF6...` with the full `G...` destination key. The stream stops after 10 events because of `--limit`.

| Flag | Use | Default |
|---|---|---|
| `<address>` | Stellar destination, full `G...` key | required |
| `--limit` | Stop after N events | no limit |
| `--rate-limit` | Max events shown per second | `5` |
| `--simulate` | Emit a labeled test lifecycle | `false` |

Stdout example, one object per line:

```json
{"event":"inbound_burn_detected","sourceChain":"Ethereum","sourceDomain":0,"amount":"100.000000","status":"attesting","timestamp":"2026-08-25T02:00:00.000Z"}
{"event":"settled","sourceChain":"Ethereum","destination":"GBBD47...","amount":"100.0000000","dust":"0","txHash":"0x8f1e...","timestamp":"2026-08-25T02:00:05.000Z"}
```

Simulated runs carry `simulate:true` and sentinel hashes. Never treat them as real settlement. See [Reading output](./reading-output) for amount shapes.

If the stream stays empty, confirm the address received a CCTP mint and that you watch the correct network. Horizon testnet and mainnet hold separate data.

Next: [domains](./domains) for the ID list.
