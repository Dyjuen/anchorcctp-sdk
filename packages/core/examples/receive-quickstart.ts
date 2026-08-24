import { createAnchorCCTP, getDomainMeta } from '../src/index.js';

async function main() {
  const domain = getDomainMeta(6); // Base
  process.stderr.write(`Configuring deposit from ${domain.name} (${domain.chain})...\n`);

  const sdk = createAnchorCCTP({
    dustCollectorAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    trustline: {
      allowCreation: true,
      spendCapXlm: 2.0,
    },
    signer: async (xdr: string) => {
      process.stderr.write(`Signing transaction XDR payload...\n`);
      return `SIGNED_EXAMPLE_TX_HASH_${Date.now()}`;
    },
  });

  sdk.on('onReceiving', (event) => {
    process.stderr.write(`[Receiving] Polling status: ${event.status}\n`);
  });

  sdk.on('onSettled', (event) => {
    process.stderr.write(`[Settled] Transfer complete: ${event.amount} stroops, tx: ${event.txHash}\n`);
  });

  // Example execution with mock test data
  process.stderr.write('AnchorCCTP SDK example ready.\n');
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
