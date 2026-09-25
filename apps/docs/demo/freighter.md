# Freighter

For wallet integrators: sign mint XDRs in the browser without exposing secrets.

The portal uses `@stellar/freighter-api` for three tasks: connect the wallet, sign the mint XDR the SDK prepares, and refresh balances after settlement.

Flow: the app requests connection, the SDK builds the forwarder call, Freighter shows the signing prompt, the user approves, the app submits, then the UI polls status and updates the balance. Secrets stay in the wallet. They never reach the app server or the SDK.

If connection fails, confirm the extension is installed, unlocked, and set to the same network as your Horizon and RPC URLs. If signing fails, confirm the source account holds enough XLM for fees and reserves.

Next: [Vercel API](./vercel-api) for server routes.
