# Keys and secrets

For anchor engineers and contributors: how signing keys move through the system.

* `receive()` never takes a secret as a regular param and never stores one. You pass a `signer` callback. Your KMS, HSM, sponsor service, or Freighter wallet signs the XDR and returns it.
* Scripts read sponsor keys from env only. `.env.testnet` stays outside git with mode 600 and never prints. `.env.example` contains keys with no values.
* Validation rejects secret shaped config keys and values. `EVM_PRIVATE_KEY` must be `0x` plus 64 hex and must come from env.
* Logs and errors go to stderr with redaction for patterns such as secret, seed, mnemonic, password, token, key, plus `S...` seed values. Stdout JSON never carries secrets.

If you need to rotate a sponsor key, update the secrets manager or env file, restart the process, and confirm no old value remains in shell history or logs.

Next: [testnet:auto](./testnet-auto) for the funded test flow.
