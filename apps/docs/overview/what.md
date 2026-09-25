# What is AnchorCCTP

For anchor engineers, ops staff, and contributors: one place to accept USDC from other chains on Stellar.

AnchorCCTP is a TypeScript SDK, a CLI, and a reference demo that settle Circle CCTP deposits to Stellar. You call `receive()` with a source burn hash and a Stellar destination. The SDK polls Circle Iris, checks the attestation, ensures the trustline, submits the mint through the Soroban forwarder, and converts 6 decimal units to 7 decimal stroops.

```ts
import { createAnchorCCTP } from '@anchor-cctp/core-sdk';

const cctp = createAnchorCCTP({
  dustCollectorAddress: 'GDDUSTCOLLECTOR00000000000000000000000000000000000000000000',
  trustline: { allowCreation: true, spendCapXlm: 2 },
  signer: async (xdr) => mySigningService.sign(xdr),
});

const settlement = await cctp.receive({
  sourceDomain: 6, // Base
  burnTxHash: '0x87a1c38e7f9b841a05234917f8a1290348719283471029834710928347109283',
  destinationAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  amount: 10_000_000n, // 10 USDC in 6 decimal base units
});
```

Result: `settlement.amount` holds stroops credited on Stellar, `settlement.dust` holds remainder sent to the dust collector, `settlement.txHash` holds the Stellar mint hash.

## What it is not

* Not a bridge UI. The demo portal shows one integration. Use the SDK in your backend.
* Not outbound CCTP, not SEP-6/24 auto deposit, not custody, not KYC or AML. See [Why it exists](./why).
* Not audited. You must review signing paths before you handle real value. See [Security](../security/overview).

## The three pieces

| Piece | Package | Use it when you |
|---|---|---|
| Core SDK | `@anchor-cctp/core-sdk` | Settle deposits inside a Node or TypeScript backend with `receive()` |
| CLI | `@anchor-cctp/cli` | Check domains, verify a burn, stream transfers, or generate `stellar.toml` from a terminal |
| Demo and spec | `apps/demo`, `SEP-CCTP.md` | Copy the Freighter flow or publish CCTP metadata for wallets |

The CLI and demo call the same core code, so a transfer checked in one tool matches the result in the others.

Next: read [Why it exists](./why) for the five problems this removes, or jump to [Try it in one command](../start/try-it) if you want output now.
