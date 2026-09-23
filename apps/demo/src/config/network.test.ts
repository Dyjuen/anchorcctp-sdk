import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadNetworkConfig } from './network.js';

const BASE = {
  VITE_NETWORK: 'testnet',
  VITE_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  VITE_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
  VITE_USDC_ISSUER: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  VITE_FORWARDER_CONTRACT_ID: 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
  VITE_ATTESTATION_URL: 'https://iris-api-sandbox.circle.com',
  VITE_STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  VITE_SIM_MODE: 'true',
};

beforeEach(() => { vi.unstubAllEnvs(); for (const [k, v] of Object.entries(BASE)) vi.stubEnv(k, v); });

describe('loadNetworkConfig', () => {
  it('parses testnet env', () => {
    const c = loadNetworkConfig();
    expect(c.network).toBe('testnet');
    expect(c.passphrase).toBe('Test SDF Network ; September 2015');
    expect(c.simMode).toBe(true);
  });
  it('rejects http horizon url', () => {
    vi.stubEnv('VITE_HORIZON_URL', 'http://evil/x');
    expect(() => loadNetworkConfig()).toThrow(/NETWORK_CONFIG.*https/i);
  });
  it('rejects bad issuer', () => {
    vi.stubEnv('VITE_USDC_ISSUER', 'NOT_AN_ADDRESS');
    expect(() => loadNetworkConfig()).toThrow(/NETWORK_CONFIG.*issuer/i);
  });
  it('rejects passphrase/network mismatch', () => {
    vi.stubEnv('VITE_STELLAR_NETWORK_PASSPHRASE', 'Public Global Stellar Network ; September 2015');
    expect(() => loadNetworkConfig()).toThrow(/NETWORK_CONFIG.*mismatch/i);
  });
});
