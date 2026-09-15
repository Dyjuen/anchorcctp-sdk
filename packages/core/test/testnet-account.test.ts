import { readAccountState } from '../src/testnet/account.js';

const ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const ADDR = 'G' + 'A'.repeat(55);

function mockFetchOnce(status: number, body: unknown) {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('readAccountState', () => {
  test('missing account returns exists:false', async () => {
    const st = await readAccountState({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      address: ADDR,
      fetchImpl: mockFetchOnce(404, { type: 'https://stellar.org/horizon-errors/not_found' }),
    });
    expect(st).toEqual({ exists: false, funded: false, hasTrustline: false, usdcBalance: '0' });
  });

  test('funded account without trustline', async () => {
    const st = await readAccountState({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      address: ADDR,
      fetchImpl: mockFetchOnce(200, {
        account_id: ADDR,
        balances: [{ asset_type: 'native', balance: '100.0000000' }],
      }),
    });
    expect(st).toEqual({ exists: true, funded: true, hasTrustline: false, usdcBalance: '0' });
  });

  test('account with USDC trustline reports balance', async () => {
    const st = await readAccountState({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      address: ADDR,
      usdcIssuer: ISSUER,
      fetchImpl: mockFetchOnce(200, {
        account_id: ADDR,
        balances: [
          { asset_type: 'native', balance: '99.5000000' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: ISSUER, balance: '5.2500000' },
        ],
      }),
    });
    expect(st).toEqual({ exists: true, funded: true, hasTrustline: true, usdcBalance: '5.2500000' });
  });

  test('non-404 HTTP error throws', async () => {
    await expect(
      readAccountState({
        horizonUrl: 'https://horizon-testnet.stellar.org',
        address: ADDR,
        fetchImpl: mockFetchOnce(500, {}),
      })
    ).rejects.toThrow('Horizon account read failed: 500');
  });
});