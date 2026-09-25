# anchor-cctp init

For anchor operators: generate a valid `stellar.toml` CCTP block.

```bash
anchor-cctp init --domain 27 --usdc-issuer GBBD47IF6... --output ./stellar.toml
```

Replace `GBBD47IF6...` with your full Circle Stellar USDC issuer key starting with `G`.

| Flag | Use | Default |
|---|---|---|
| `--domain` | Stellar CCTP domain ID | `27` |
| `--usdc-issuer` | Circle Stellar USDC issuer, full `G...` key | required |
| `--forwarder` | Soroban forwarder contract, full `C...` ID | network default |
| `--dust-collector` | Dust sink account, full `G...` key | none |
| `--output` | Destination TOML path | `./stellar.toml` |

Stdout example:

```json
{ "success": true, "configBlock": "[[CURRENCIES]]\ncode = \"USDC\"...", "writtenPath": "./stellar.toml" }
```

The command checks every address with StrKey checksum before it writes. If it rejects your issuer, confirm you pasted the full key with no line breaks. The published schema lives in [SEP-CCTP](../sep/overview).

If `--output` points outside the current directory, confirm the path first to avoid overwriting an unrelated file.

Next: [verify](./verify) to check a burn.
