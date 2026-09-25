# Core overview

For anchor engineers: the one engine the CLI and demo share.

[`@anchor-cctp/core-sdk`](https://www.npmjs.com/package/@anchor-cctp/core-sdk) holds the full settlement pipeline. The CLI and the demo portal pass params into it and render results. They add no separate settlement logic, so all three agree on the same transfer.

```ts
import { createAnchorCCTP } from '@anchor-cctp/core-sdk';

const cctp = createAnchorCCTP({
  dustCollectorAddress: 'G...',
  trustline: { allowCreation: false, spendCapXlm: 2 },
  signer: async (xdr) => signWithKms(xdr),
});

cctp.on('onReceiving', ({ burnTxHash, status, attempt }) => {
  console.error(`Polling ${burnTxHash}: ${status} attempt ${attempt}`);
});

cctp.on('onSettled', ({ amount, dust, txHash }) => {
  console.error(`Settled ${amount} stroops dust ${dust} tx ${txHash}`);
});

cctp.on('onDustCollected', ({ amount, collector }) => {
  console.error(`Dust ${amount} to ${collector}`);
});

cctp.on('onError', ({ error, burnTxHash }) => {
  console.error(`Failed ${burnTxHash}: ${error.code}`);
});

await cctp.receive({
  sourceDomain: 6,
  burnTxHash: '0x...',
  destinationAddress: 'G...',
  amount: 1_000_000n,
});
```

Notes for use: keep auto creation off unless you mean to sponsor reserves. Inject a persistent replay store in production because the default in memory store forgets on restart. The public API is only what `src/index.ts` re exports. Folders like `attestation/` and `forwarder/` are internal.

Next: [Install and usage](./install-usage) for config, then [Attestation](./attestation), [Decimals](./decimals-dust), [Forwarder](./forwarder), [Trustlines](./trustline), [Replay](./replay).
