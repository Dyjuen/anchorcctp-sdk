# Domain table

For anchor engineers and ops staff: the IDs to pass as `sourceDomain`.

Source of truth: `CCTP_DOMAINS` in `packages/core/src/domains/index.ts`. This page mirrors it. If `anchor-cctp domains` prints something different, file a bug with both outputs.

| Domain | Chain | Name | Type |
|---|---|---|---|
| 0 | ethereum | Ethereum | EVM, 6 places |
| 1 | avalanche | Avalanche | EVM, 6 places |
| 2 | op-mainnet | OP Mainnet | EVM, 6 places |
| 3 | arbitrum | Arbitrum | EVM, 6 places |
| 4 | noble | Noble | Cosmos, 6 places |
| 5 | solana | Solana | SVM, 6 places |
| 6 | base | Base | EVM, 6 places |
| 7 | polygon | Polygon PoS | EVM, 6 places |
| 27 | stellar | Stellar | Stellar, 7 places |
| 37 | x-layer | X Layer | EVM, 6 places |

The CLI prints all 30 mainnet and testnet entries. Use it for the live list:

```bash
anchor-cctp domains | jq '.[] | select(.domainId==6)'
```

Pass the integer ID exactly. The SDK rejects unknown IDs with `INVALID_DOMAIN`.

Next: [Configuration overview](../configuration/overview) for env and flags.
