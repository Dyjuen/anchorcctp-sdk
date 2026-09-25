# anchor-cctp domains

For all users: list the CCTP domain IDs the SDK accepts.

```bash
anchor-cctp domains
```

Stdout example, shortened:

```json
[
  { "domainId": 0, "chain": "ethereum", "name": "Ethereum" },
  { "domainId": 6, "chain": "base", "name": "Base" },
  { "domainId": 27, "chain": "stellar", "name": "Stellar" }
]
```

The command prints 30 mainnet and testnet entries. The full table with types is in [Domain table](../domains/table).

The SDK rejects any ID outside this list with `INVALID_DOMAIN`. It never passes unknown domains through to Iris or the forwarder.

Next: [Domain catalogue](../domains/overview) for sourcing and safety notes.
