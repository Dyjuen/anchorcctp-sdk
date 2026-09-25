# Replay protection

For anchor engineers: how the SDK stops the same burn from crediting twice.

Each `burnTxHash` acts as an idempotency key. The SDK normalizes the hash to lowercase and requires `0x` plus 64 hex characters, so `0xABC...`, `0xabc...`, and bare hex map to one entry.

* The SDK checks the store before it credits. A hash seen before returns `REPLAY_TRANSFER` and performs no second credit.
* The default store keeps data in memory. Use it for tests only. Production must inject a file or SQLite adapter or a restart will forget what settled.
* The SDK marks the hash with a `submitted` flag around the mint call and reconciles on retry, so a crash between submit and mark cannot double mint when you retry with the same hash.

If you run concurrent workers, use one shared store with atomic writes. Two separate memory stores cannot protect each other.

Next: [Events and errors](./events-errors) for the full taxonomy.
