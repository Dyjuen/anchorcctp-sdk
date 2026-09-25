# Attestation polling

For anchor engineers: how the SDK waits for Circle Iris and decides when to proceed.

When a user burns USDC on the source chain, Circle Iris signs a mint proof after finality. On mainnet this often takes 5 to 15 minutes. On testnets it is usually faster.

The SDK follows four rules:

* It polls with exponential backoff plus jitter and stops at `maxRetries`. It never polls forever on a hash that will never attest.
* It acts only on a verified `complete` attestation. A `pending` response means wait and poll again.
* It never treats a pending or unverified response as settlement. Verification runs before any mint call. This is the invariant that protects funds.
* It validates `burnTxHash` format before it builds the request URL, encodes the hash, and applies a fetch timeout to every call.

Tune per deployment with `pollIntervalMs` and `maxRetries` in config, or per call with `receive()` overrides.

If you see `ATTESTATION_TIMEOUT`, confirm the source transaction succeeded and finalized, confirm you used the matching Iris base URL for the network, then retry with the same hash. Do not create a second burn.

Next: [Decimals and dust](./decimals-dust) for amount math.
