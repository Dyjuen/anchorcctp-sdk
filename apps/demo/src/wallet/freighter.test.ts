import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
}));

import * as freighterApi from '@stellar/freighter-api';
import {
  connectFreighter,
  signWithFreighter,
  getAccountBalances,
  checkNetworkMatch,
} from './freighter.js';

const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

beforeEach(() => vi.resetAllMocks());

describe('connectFreighter', () => {
  it('returns explicit not-installed state instead of a fake mock account', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: false } as any);
    const res = await connectFreighter();
    expect(res.connected).toBe(false);
    expect(res.address).toBeNull();
    expect(res.error).toMatch(/install/i);
  });

  it('surfaces user-decline as disconnected with reason', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: true } as any);
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: '', error: 'declined' } as any);
    const res = await connectFreighter();
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/declined/i);
  });
});

describe('signWithFreighter', () => {
  it('throws typed error on rejection instead of returning xdr', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: true } as any);
    vi.mocked(freighterApi.signTransaction).mockResolvedValue({ signedTxXdr: '', error: 'rejected' } as any);
    await expect(signWithFreighter('AAAA')).rejects.toThrow(/rejected/i);
  });
});

describe('checkNetworkMatch', () => {
  it('flags mismatch between wallet network and expected passphrase', async () => {
    vi.mocked(freighterApi.getNetwork).mockResolvedValue({ networkPassphrase: 'Public Global Stellar Network ; September 2015' } as any);
    await expect(checkNetworkMatch('Test SDF Network ; September 2015')).rejects.toThrow(/network mismatch/i);
  });
});

describe('getAccountBalances', () => {
  it('parses Horizon balances for an address', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balances: [{ asset_type: 'native', balance: '10.5' }] }),
    }) as any;
    const b = await getAccountBalances(G, 'https://horizon-testnet.stellar.org');
    expect(b[0].balance).toBe('10.5');
  });

  it('throws actionable error when account unfunded (404)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
    await expect(getAccountBalances('GUNFUNDED' + 'A'.repeat(48), 'https://horizon-testnet.stellar.org')).rejects.toThrow(/unfunded/i);
  });

  it('rejects non-https horizon urls before fetching', async () => {
    await expect(getAccountBalances(G, 'http://evil/x')).rejects.toThrow(/https/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('secret hygiene tripwire', () => {
  it('wallet module never mentions secret material', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./freighter.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/secret|mnemonic|seed\s*:/i);
  });
});
