# Install and usage

For anchor engineers: add the SDK to a backend and run `receive()`.

```bash
npm install @anchor-cctp/core-sdk
```

```ts
import { createAnchorCCTP } from '@anchor-cctp/core-sdk';

const cctp = createAnchorCCTP({
  attestationBaseUrl: 'https://iris-api.circle.com',
  pollIntervalMs: 2000,
  maxRetries: 60,
  dustCollectorAddress: process.env.ANCHOR_DUST_COLLECTOR!,
  trustline: { allowCreation: true, spendCapXlm: 2 },
  signer: async (xdr: string) => signWithKms(xdr),
  replayStore: myPersistentStore,
});
```

Field guide:

* `attestationBaseUrl`. Use the sandbox URL on testnet, the production URL on mainnet. The value must match the network you settle on.
* `pollIntervalMs` and `maxRetries`. Start of backoff and hard stop for Iris polling.
* `dustCollectorAddress`. A `G...` account that receives sub stroop remainder.
* `trustline`. `allowCreation: false` is the safe default. Set true only when you accept the XLM reserve cost, and always set `spendCapXlm`.
* `signer`. Your callback receives XDR and returns signed XDR. Example: KMS, HSM, or Freighter.
* `replayStore`. Pass a file or database adapter in production. The built in memory store suits tests only.

This snippet is typechecked in CI against `AnchorCCTPConfig`. If the config shape changes, the docs build fails instead of showing stale fields.

If `receive()` throws `TrustlineMissingError`, either fund the trustline first or enable creation with a cap. If it throws `AttestationTimeoutError`, the burn has not finalized or the hash is wrong.

Next: [Attestation](./attestation) for polling behavior.
