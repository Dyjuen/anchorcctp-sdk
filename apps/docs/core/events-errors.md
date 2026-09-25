# Events and errors

For anchor engineers and ops staff: what to subscribe to and what to do when a call fails.

Subscribe to progress and settlement:

```ts
cctp.on('onReceiving', ({ burnTxHash, status, attempt, sourceDomain }) => {});
cctp.on('onSettled', ({ amount, dust, txHash, destinationAddress, timestamp }) => {});
cctp.on('onDustCollected', ({ amount, collector, burnTxHash }) => {});
cctp.on('onError', ({ error, burnTxHash }) => {});
```

Each listener runs isolated. A throwing handler logs but cannot break settlement. Handlers run synchronously, so keep them short and move heavy work to a queue.

| Error | Code | Fix |
|---|---|---|
| `InvalidDomainError` | `INVALID_DOMAIN` | Pass a supported `sourceDomain`. Examples: 0 for Ethereum, 6 for Base, 27 for Stellar. List all with `anchor-cctp domains`. |
| `InvalidAmountError` | `INVALID_AMOUNT` | Pass a positive `bigint`. Check for zero, negative, or overflow. |
| `AttestationTimeoutError` | `ATTESTATION_TIMEOUT` | Wait for source finality, confirm the Iris URL matches the network, then retry the same hash. |
| `TrustlineMissingError` | `TRUSTLINE_MISSING` | Add a USDC trustline first, or retry with creation enabled and a cap. |
| `TrustlineCreationError` | `TRUSTLINE_CREATION_FAILED` | Fund the sponsor with XLM or raise `spendCapXlm`. |
| `MintFailedError` | `MINT_FAILED` | Check forwarder deployment, destination status, and signer wiring. |
| `ReplayTransferError` | `REPLAY_TRANSFER` | Already settled. Read settlement records instead of resubmitting. |

Every error carries `message`, `code`, and `remediation`. Show `remediation` to operators. Log to stderr and keep stdout JSON clean for scripts.

Next: [CLI overview](../cli/overview) if you operate from a terminal.
