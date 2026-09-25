# Quick setup

For anchor engineers: from empty directory to a funded testnet settlement. Time: about 10 minutes after you install dependencies.

macOS, Linux, and Windows PowerShell:

```bash
npm install -g @anchor-cctp/cli
anchor-cctp domains
npm run testnet:deploy
```

`testnet:deploy` creates a testnet account, writes `.env.testnet` with mode 600, and never commits it. Load it, then run settlement against an external burn hash:

```bash
source .env.testnet
npm run testnet:auto -- --skip-burn 0xABC123... --amount 1000000 --source-domain 6
```

On PowerShell, load the env vars manually instead of `source`. Replace `0xABC123...` with a full `0x` plus 64 hex burn hash from Base Sepolia testnet.

What the command does, in order: it loads your env identity, checks friendbot funding, checks forwarder liveness, ensures the trustline only if you opted in with a cap, calls `receive()`, sends through Soroban, asserts the balance delta, and prints a receipt JSON to stdout.

Expected stdout: a receipt with `settled: true`, credited `amount` in stroops, `dust`, and `txHash`. Progress and diagnostics go to stderr so you can pipe stdout to `jq`.

If you burned yourself and the process crashed before settle, resume with the hash from the log. Do not start a second burn:

```bash
npm run testnet:auto -- --skip-burn <evmBurnTxHash-from-log>
```

Common fixes: missing `STELLAR_SECRET` means you skipped the `source` step. `TRUSTLINE_MISSING` means you left auto creation off and the destination has no USDC trustline. Attestation timeout usually means the source burn has not finalized yet, so wait and retry with the same hash.

Next: [testnet:auto](../configuration/testnet-auto) explains both phases, and [Keys](../configuration/keys) explains secret handling.
