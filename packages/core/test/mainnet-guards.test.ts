import { receive } from '../src/receive.js';
import { createAnchorCCTPFromEnv } from '../src/testnet-config.js';

const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

test('mainnet without usdcIssuer throws before polling', async () => {
  const { client } = createAnchorCCTPFromEnv({
    STELLAR_NETWORK: 'mainnet',
    STELLAR_DESTINATION: G,
    FORWARDER_CONTRACT_ID: 'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T',
  } as Record<string, string>);
  await expect(client.receive({
    sourceDomain: 0,
    burnTxHash: '0x' + 'ab'.repeat(32),
    destinationAddress: G,
    amount: 1000000n,
  })).rejects.toThrow(/usdcIssuer.*mainnet/i);
});

test('SOROBAN_RPC_URL http rejected', () => {
  expect(() => createAnchorCCTPFromEnv({
    STELLAR_DESTINATION: G, SOROBAN_RPC_URL: 'http://evil/x',
  } as Record<string, string>)).toThrow(/SOROBAN_RPC_URL.*https/i);
});
