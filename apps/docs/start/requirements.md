# Requirements

For anchor engineers and ops staff: what you need before `receive()` or the testnet scripts can run.

* Node.js 18 or later. The SDK works from CommonJS and ESM.
* A Stellar destination account starting with `G`. For testnet flows, fund it with testnet XLM through friendbot. The quick setup script does this for you.
* A signing path. `receive()` takes a `signer` callback such as your KMS, your sponsor service, or Freighter in the demo. Scripts may use a sponsor key from env. The SDK never accepts a raw secret as a regular param, never writes keys to disk, and never logs them.
* Outbound HTTPS to Circle Iris, Horizon, and Soroban RPC. Use the sandbox Iris URL on testnet and the production Iris URL on mainnet. See [Networks](../configuration/networks).
* Optional for the demo portal: the Freighter browser extension. See [Freighter](../demo/freighter).

Rules that always apply: keep `.env.testnet` outside git with mode 600, keep `.env.example` free of values, and keep secrets out of logs and error output. Validation rejects secret shaped keys and values.

Next: [Quick setup](./quick-setup) runs a funded testnet settlement.
