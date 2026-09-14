import { createAnchorCCTP } from '../packages/core/src/config.js';

const burnTxHash = process.argv[2] || process.env.CIRCLE_TESTNET_BURN_TX || '';
const destinationAddress =
  process.argv[3] ||
  process.env.STELLAR_TESTNET_DESTINATION ||
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

if (!burnTxHash) {
  console.error(
    JSON.stringify({
      error: 'Missing burnTxHash. Usage: tsx scripts/testnet-receive.ts <burnTxHash> <G...>',
      code: 'MISSING_ARGUMENT',
    }),
  );
  process.exit(1);
}

const sdk = createAnchorCCTP({
  attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
  signer: async (xdr) => {
    console.error(
      `[SIGN] XDR len ${xdr.length} — sign with funded testnet key off-SDK`,
    );
    return `SIGNED_OFFLINE_${xdr.slice(0, 16)}`;
  },
});

const before = Date.now();
const res = await sdk.receive({
  sourceDomain: 6,
  burnTxHash,
  destinationAddress,
  amount: 1000000n,
});
console.log(
  JSON.stringify({
    settled: res.settled,
    amount: res.amount.toString(),
    dust: res.dust.toString(),
    txHash: res.txHash,
    elapsedMs: Date.now() - before,
  }),
);
