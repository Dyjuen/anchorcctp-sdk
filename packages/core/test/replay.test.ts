import { ReplayStore, SettlementRecord } from '../src/replay/index.js';

describe('Replay Guard & Idempotency Store', () => {
  it('marks and checks processed transactions in memory', async () => {
    const s = new ReplayStore();
    expect(await s.isProcessed('0x1')).toBe(false);
    expect(await s.getRecord('0x1')).toBeNull();

    const record: SettlementRecord = {
      burnTxHash: '0x1',
      txHash: '0xm',
      amount: 10000000n,
      dust: 0n,
      timestamp: new Date().toISOString(),
    };

    await s.markProcessed('0x1', record);
    expect(await s.isProcessed('0x1')).toBe(true);
    const retrieved = await s.getRecord('0x1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.txHash).toBe('0xm');
    expect(retrieved!.amount).toBe(10000000n);
  });

  it('supports custom pluggable store adapter', async () => {
    const customMap = new Map<string, SettlementRecord>();
    const customAdapter = {
      isProcessed: async (h: string) => customMap.has(h),
      markProcessed: async (h: string, r: SettlementRecord) => {
        customMap.set(h, r);
      },
      getRecord: async (h: string) => customMap.get(h) || null,
    };

    const s = new ReplayStore(customAdapter);
    expect(await s.isProcessed('0x2')).toBe(false);

    await s.markProcessed('0x2', { burnTxHash: '0x2', txHash: '0xcustom' });
    expect(await s.isProcessed('0x2')).toBe(true);
    expect(customMap.get('0x2')?.txHash).toBe('0xcustom');
  });
});
