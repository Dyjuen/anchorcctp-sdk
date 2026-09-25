# Networks

For anchor engineers and ops staff: which URLs belong to which network.

The SDK has no cross network defaults. You pin the network explicitly on every path.

Testnet:

* Iris sandbox: `https://iris-api-sandbox.circle.com`
* Horizon: `https://horizon-testnet.stellar.org`
* Soroban RPC: `https://soroban-testnet.stellar.org`
* Testnet forwarder contract. `testnet-auto` also pins testnet hosts to block host substitution.

Mainnet:

* Iris: `https://iris-api.circle.com`
* Mainnet Horizon and RPC endpoints
* Mainnet forwarder contract. If you omit `network`, the SDK throws instead of falling back to testnet.

Set `CIRCLE_ATTESTATION_BASE_URL` explicitly and keep it consistent with the network you settle on. The full variable list is in `.env.example`.

If attestation calls fail with TLS or 404 errors, you likely mixed sandbox and mainnet URLs. Align all three endpoints to one network and retry.

Next: [Keys](./keys) for secret handling.
