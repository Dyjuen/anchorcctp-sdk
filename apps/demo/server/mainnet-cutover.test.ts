import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function parseExample(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^(VITE_\w+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

describe('mainnet cutover (env-only)', () => {
  it('mainnet template points at mainnet everywhere', () => {
    const e = parseExample(new URL('../.env.mainnet.example', import.meta.url));
    expect(e.VITE_NETWORK).toBe('mainnet');
    expect(e.VITE_HORIZON_URL).toBe('https://horizon.stellar.org');
    expect(e.VITE_FORWARDER_CONTRACT_ID).toBe('CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T');
    expect(e.VITE_USDC_ISSUER).toBe('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    expect(e.VITE_STELLAR_NETWORK_PASSPHRASE).toBe('Public Global Stellar Network ; September 2015');
    expect(e.VITE_SIM_MODE).toBe('false');
    expect(e.VITE_ATTESTATION_URL).toBe('https://iris-api.circle.com');
  });
  it('testnet template stays testnet', () => {
    const e = parseExample(new URL('../.env.testnet.example', import.meta.url));
    expect(e.VITE_NETWORK).toBe('testnet');
    expect(e.VITE_SIM_MODE).toBe('true');
  });
});
