# @anchor-cctp/cli

> Terminal command suite for Stellar anchor CCTP integration.

## Installation

```bash
npm install -g @anchor-cctp/cli
# or run with npx
npx @anchor-cctp/cli --help
```

---

## Output Conventions

- **`stdout`**: Clean, machine-readable JSON (or NDJSON for streaming).
- **`stderr`**: Human diagnostics, progress logs, spinners, and debug info.
- **Exit Codes**: `0` on success, non-zero (`1`) on error.
- **Errors**: Structured JSON error object with `error`, `code`, and actionable `remediation` message.

---

## Commands

### 1. `anchor-cctp domains`

Lists all 26 supported CCTP domain IDs and chain mappings.

```bash
anchor-cctp domains
```

#### Output (stdout JSON)
```json
[
  {
    "domainId": 0,
    "chain": "ethereum",
    "name": "Ethereum",
    "networkType": "EVM"
  },
  {
    "domainId": 1,
    "chain": "avalanche",
    "name": "Avalanche",
    "networkType": "EVM"
  },
  {
    "domainId": 6,
    "chain": "base",
    "name": "Base",
    "networkType": "EVM"
  },
  {
    "domainId": 27,
    "chain": "stellar",
    "name": "Stellar",
    "networkType": "Stellar"
  }
]
```

---

### 2. `anchor-cctp init`

Generates standard `stellar.toml` CCTP configuration block for anchor operators.

```bash
anchor-cctp init --domain 27 --usdc-issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --output ./stellar.toml
```

#### Options
| Flag | Description | Default |
|---|---|---|
| `--domain` | Stellar CCTP Domain ID | `27` |
| `--usdc-issuer` | Circle Stellar USDC Issuer Public Key | `GBBD47...` |
| `--forwarder` | Soroban Forwarder Contract ID | `CDLZFC3...` |
| `--dust-collector`| Dust Sink Account Address | `GDDUST...` |
| `--output` | Destination TOML file path | `./stellar.toml` |

#### Output (stdout JSON)
```json
{
  "success": true,
  "configBlock": "[[CURRENCIES]]\ncode = \"USDC\"...",
  "writtenPath": "./stellar.toml"
}
```

---

### 3. `anchor-cctp verify <txHash>`

Checks the burn-to-mint Iris attestation status for a source chain transaction hash.

```bash
anchor-cctp verify 0x3a4b... --source-domain 0
```

#### Options
| Flag | Description | Default |
|---|---|---|
| `<txHash>` / `--tx-hash` | Source chain burn transaction hash | *(Required)* |
| `--source-domain` | Source CCTP domain ID | `0` |
| `--base-url` | Circle Iris Attestation API URL | `https://iris-api.circle.com` |
| `--max-retries` | Maximum polling attempts | `30` |
| `--poll-interval` | Initial poll interval in milliseconds | `1000` |

#### Output (stdout JSON)
```json
{
  "txHash": "0x3a4b...",
  "attested": true,
  "status": "complete",
  "sourceDomain": 0,
  "destinationDomain": 27,
  "attestation": "0x...",
  "message": "0x..."
}
```

---

### 4. `anchor-cctp listen <address>`

Streams real-time inbound CCTP transfers targeting a Stellar address as newline-delimited JSON (NDJSON).

```bash
anchor-cctp listen GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --limit 10
```

#### Options
| Flag | Description | Default |
|---|---|---|
| `<address>` / `--address` | Stellar destination public key (G...) | *(Required)* |
| `--limit` | Exit stream after receiving N events | `Infinity` |
| `--rate-limit` | Maximum events emitted per second | `5` |
| `--simulate` | Emit simulated test transfer lifecycle | `false` |

#### Output (stdout NDJSON)
```json
{"event":"inbound_burn_detected","sourceChain":"Ethereum","sourceDomain":0,"amount":"100.000000","status":"attesting","timestamp":"2026-08-25T02:00:00.000Z"}
{"event":"settled","sourceChain":"Ethereum","destination":"GBBD47...","amount":"100.0000000","dust":"0","txHash":"0x8f1e...","timestamp":"2026-08-25T02:00:05.000Z"}
```

---

## License

MIT © Mother's Grace (Juen)
