# Decimals and dust

For anchor engineers and accountants: how 6 place source amounts become 7 place Stellar amounts without losing money.

Stellar USDC uses 7 decimals. One USDC equals 10,000,000 stroops. CCTP source chains use 6 decimals. One USDC there equals 1,000,000 base units. The conversion multiplies by 10:

```ts
import { convert6to7 } from '@anchor-cctp/core-sdk';

const { stellarAmount, dust } = convert6to7(100_000_000n);
// 100 USDC becomes 1_000_000_000n stroops, dust 0n
```

Invariants you can rely on:

* Integer and `bigint` math only. The SDK rejects `number` and float input because floats lose precision where money lives.
* It rounds down. Credited stroops plus dust never exceed the attested amount.
* Dust has an owner. Remainder routes to `dustCollectorAddress` and emits `onDustCollected`. The SDK never drops it silently.
* It rejects negative, zero, and overflow amounts with `InvalidAmountError`. It never clamps them.

For display, use `formatStellarUnits(1_000_000_000n)` which returns `"100.0000000"`. For input parsing, use `parseStellarUnits` and handle its typed error.

Next: [Forwarder and addresses](./forwarder).
