# Trustlines

For anchor engineers: why a deposit can fail before any mint, and how to handle it.

A Stellar account must trust the USDC issuer before it can hold USDC. The SDK checks first:

```ts
await ensureTrustline({ destination: 'G...', allowCreation: true, spendCapXlm: 2 });
```

Behavior:

* If the trustline exists, the SDK continues to mint.
* If it is missing and you set `allowCreation: true` with `spendCapXlm`, the SDK creates it and charges reserves within your cap.
* If it is missing and you left creation off, the SDK throws `TrustlineMissingError`. The error includes a remediation string. You decide: ask the user to add the trustline, enable creation, or abort.

Auto creation defaults to off and the cap is required when you enable it. Sponsoring reserves spends real XLM, so creation stays explicit and bounded.

If creation throws `TRUSTLINE_CREATION_FAILED`, check that the sponsor account holds enough XLM and that your cap covers the 0.5 XLM base reserve per trustline.

Next: [Replay protection](./replay) for idempotency.
