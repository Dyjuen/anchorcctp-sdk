import { checkForwarderDeployed, forwarderInstanceKeyB64 } from '../src/testnet/forwarder-check.js';

const CONTRACT = 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ';

function mockRpc(responses: unknown[]) {
  const calls: unknown[] = [];
  const queue = [...responses];
  const fetchImpl = jest.fn(async (_url: unknown, init: unknown) => {
    calls.push(JSON.parse(String((init as { body: string }).body)).method);
    const result = queue.shift();
    return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('forwarderInstanceKeyB64', () => {
  test('stable base64 head for testnet forwarder', () => {
    expect(forwarderInstanceKeyB64(CONTRACT).slice(0, 40)).toBe(
      'AAAABgAAAAE96GrFC0fq8oQP4j5IF5VRZg/RBy+6'
    );
  });
});

describe('checkForwarderDeployed', () => {
  test('entries present means deployed', async () => {
    const { fetchImpl, calls } = mockRpc([
      { latestLedger: 12345 },
      { entries: [{ key: 'k', val: 'v' }] },
    ]);
    const r = await checkForwarderDeployed({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      contractId: CONTRACT,
      fetchImpl,
    });
    expect(r).toEqual({ deployed: true, latestLedger: 12345 });
    expect(calls).toEqual(['getLatestLedger', 'getLedgerEntries']);
  });

  test('empty entries means not deployed', async () => {
    const { fetchImpl } = mockRpc([{ latestLedger: 1 }, { entries: [] }]);
    const r = await checkForwarderDeployed({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      contractId: CONTRACT,
      fetchImpl,
    });
    expect(r.deployed).toBe(false);
  });

  test('N5: RPC error throws RPC_ERROR', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(
      checkForwarderDeployed({ rpcUrl: 'https://soroban-testnet.stellar.org', contractId: CONTRACT, fetchImpl })
    ).rejects.toThrow('RPC_ERROR');
  });

  test('N5: empty entries returns deployed:false without throwing', async () => {
    const { fetchImpl } = mockRpc([{ latestLedger: 1 }, { entries: [] }]);
    const r = await checkForwarderDeployed({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      contractId: CONTRACT,
      fetchImpl,
    });
    expect(r.deployed).toBe(false);
  });

  test('N5: passes AbortSignal to fetch', async () => {
    const fetchImpl = jest.fn(async (_url: unknown, init: unknown) => {
      const signal = (init as { signal?: AbortSignal }).signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: { latestLedger: 1 } }) };
    }) as unknown as typeof fetch;
    await checkForwarderDeployed({ rpcUrl: 'https://soroban-testnet.stellar.org', contractId: CONTRACT, fetchImpl });
  });
});
