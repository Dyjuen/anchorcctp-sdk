import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
  getNetworkPassphrase: vi.fn(),
  isAllowed: vi.fn().mockResolvedValue(true),
  setAllowed: vi.fn(),
}));

import * as freighterApi from '@stellar/freighter-api';
import {
  connectFreighter,
  signWithFreighter,
  getAccountBalances,
} from './freighter.js';

const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const TESTNET_PASS = 'Test SDF Network ; September 2015';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(freighterApi.isAllowed).mockResolvedValue(true as any);
  vi.mocked(freighterApi.getNetworkPassphrase).mockResolvedValue(TESTNET_PASS);
});
afterEach(() => { vi.unstubAllGlobals?.(); vi.unstubAllEnvs?.(); });

describe('connectFreighter', () => {
  it('returns explicit not-installed state instead of a fake mock account', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: false } as any);
    const res = await connectFreighter();
    expect(res.connected).toBe(false);
    expect(res.address).toBeNull();
    expect(res.error).toMatch(/install/i);
  });

  it('returns simulated sandbox state when allowSimulated is true and Freighter not installed', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: false } as any);
    const res = await connectFreighter({ allowSimulated: true });
    expect(res.connected).toBe(true);
    expect(res.address).toBe(G);
    expect(res.isSimulated).toBe(true);
  });

  it('surfaces user-decline as disconnected with reason', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: true } as any);
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: '', error: 'declined' } as any);
    const res = await connectFreighter();
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/denied|declined/i);
  });

  it('throws when isConnected resolves with error string', async () => {
    vi.mocked(freighterApi.isConnected).mockResolvedValue({ isConnected: true, error: 'browser lock' } as any);
    const res = await connectFreighter();
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/browser lock/i);
  });
});

describe('signWithFreighter', () => {
  it('throws typed error on rejection instead of returning xdr', async () => {
    vi.mocked(freighterApi.signTransaction).mockResolvedValue({ signedTxXdr: '', error: 'rejected' } as any);
    await expect(signWithFreighter('AAAA')).rejects.toThrow(/rejected/i);
  });

  it('returns signedTxXdr on success', async () => {
    vi.mocked(freighterApi.signTransaction).mockResolvedValue({ signedTxXdr: 'SIGNED_XDR_BLOB', error: '' } as any);
    const result = await signWithFreighter('AAAA');
    expect(result).toBe('SIGNED_XDR_BLOB');
  });

  it('passes custom passphrase to signTransaction', async () => {
    vi.mocked(freighterApi.getNetworkPassphrase).mockResolvedValue('Public Global Stellar Network ; September 2015');
    const spy = vi.mocked(freighterApi.signTransaction).mockResolvedValue({ signedTxXdr: 'OK', error: '' } as any);
    await signWithFreighter('AAAA', 'Public Global Stellar Network ; September 2015');
    expect(spy).toHaveBeenCalledWith('AAAA', { networkPassphrase: 'Public Global Stellar Network ; September 2015' });
  });

  it('throws on network passphrase mismatch', async () => {
    vi.mocked(freighterApi.getNetworkPassphrase).mockResolvedValue('Wrong Network ; September 2015');
    await expect(signWithFreighter('AAAA')).rejects.toThrow(/Network mismatch/i);
  });
});

describe('getAccountBalances', () => {
  it('parses Horizon balances for an address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balances: [{ asset_type: 'native', balance: '10.5' }] }),
    }));
    const b = await getAccountBalances(G, 'https://horizon-testnet.stellar.org');
    expect(b[0].balance).toBe('10.5');
  });

  it('throws actionable error when account unfunded (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getAccountBalances('GUNFUNDED' + 'A'.repeat(48), 'https://horizon-testnet.stellar.org')).rejects.toThrow(/unfunded/i);
  });

  it('throws generic error on non-404 failure (500)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getAccountBalances(G, 'https://horizon-testnet.stellar.org')).rejects.toThrow(/Horizon request failed \(500\)/);
  });

  it('rejects non-https horizon urls before fetching', async () => {
    vi.stubGlobal('fetch', vi.fn());
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
