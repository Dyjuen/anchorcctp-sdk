# Domain catalogue overview

For anchor engineers and contributors: where domain IDs come from and how the SDK guards them.

Each entry traces to the Circle published CCTP table and to `CCTP_DOMAINS` in `@anchor-cctp/core-sdk`. The CLI reads the same table, so `anchor-cctp domains` and the SDK always agree. A chain missing from that table is out of scope until Circle adds it.

Stellar is 27. Lookups use the table directly at each call site instead of hardcoded IDs. Validation rejects prototype names such as `constructor` or `__proto__`, so JSON input cannot bypass the allow list.

If you add a chain, update the table, add tests for lookup and rejection, and confirm `anchor-cctp domains` prints the new entry.

Next: [Domain table](./table) for IDs, chains, and decimal places.
