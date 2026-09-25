# testnet:auto

For anchor engineers: run a funded testnet settlement with one command.

The script has two modes.

Phase 1, external burn. You supply a burn hash from elsewhere:

```bash
npm run testnet:auto -- --skip-burn 0xABC123... --amount 1000000 --source-domain 6
```

Steps: the script loads env identity, checks friendbot funding, checks forwarder liveness, ensures the trustline only if you opted in with a cap, calls `receive()`, sends through Soroban, asserts the balance delta, and prints a receipt JSON to stdout. It needs `STELLAR_DESTINATION` plus `STELLAR_SECRET`.

Full, self serve burn. You omit `--skip-burn` and the script burns on Base Sepolia itself:

```bash
npm run testnet:auto -- --amount 1000000 --log docs/evidence/testnet-auto.log
```

Steps: it pins the chain to the testnet allow list, checks gas and USDC, approves the exact amount, calls `depositForBurnWithHook` with the forwarder as recipient and caller, waits for Iris, then settles as in Phase 1 and includes `evmBurnTxHash` in the receipt. It needs Base Sepolia ETH for gas, testnet USDC from the Circle faucet, and `EVM_PRIVATE_KEY` in `.env.testnet`.

Recovery: if the process crashes after the burn but before settle, resume with the hash from the log. Running again without `--skip-burn` would burn a second time:

```bash
npm run testnet:auto -- --skip-burn <evmBurnTxHash-from-log>
```

Next: [Verify the install](../install/verify) for CI checks.
