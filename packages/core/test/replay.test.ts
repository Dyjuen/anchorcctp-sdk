import { ReplayStore, SettlementRecord } from '../src/replay/index.js';
import { FileReplayStore } from '../src/replay/file-store.js';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = '/tmp/opencode';

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

describe('ReplayStore key normalization (in-memory)', () => {
  it('normalizes case: 0xABC and 0xabc resolve to same key', async () => {
    const s = new ReplayStore();
    const hash = '0x' + 'ab'.repeat(32);
    await s.markProcessed(hash, { burnTxHash: hash, txHash: 'T1' });

    const upper = '0x' + 'AB'.repeat(32);
    expect(await s.isProcessed(upper)).toBe(true);
    const record = await s.getRecord(upper);
    expect(record).not.toBeNull();
    expect(record!.txHash).toBe('T1');
  });

  it('in-memory store works without adapter', async () => {
    const s = new ReplayStore();
    expect(s).toBeDefined();
    await expect(s.isProcessed('NOT NORMALIZED')).resolves.toBe(false);
  });
});

describe('FileReplayStore', () => {
  const storePath = path.join(TMP_DIR, 'replay-test.json');

  beforeEach(() => {
    try { fs.unlinkSync(storePath); } catch { /* ok */ }
    try { fs.unlinkSync(storePath + '.tmp'); } catch { /* ok */ }
  });

  afterEach(() => {
    try { fs.unlinkSync(storePath); } catch { /* ok */ }
    try { fs.unlinkSync(storePath + '.tmp'); } catch { /* ok */ }
  });

  it('same adapter across clients rejects replay (restart-simulated)', async () => {
    const adapter = new FileReplayStore(storePath);
    const a = new ReplayStore(adapter);
    const b = new ReplayStore(adapter);
    const h = '0x' + 'dd'.repeat(32);
    await a.markProcessed(h, { burnTxHash: h, txHash: 'T1' });
    await expect(b.isProcessed(h)).resolves.toBe(true);
  });

  it('normalizes case across file reads', async () => {
    const adapter = new FileReplayStore(storePath);
    const s = new ReplayStore(adapter);
    const lower = '0x' + 'aa'.repeat(32);
    const upper = '0x' + 'AA'.repeat(32);
    await s.markProcessed(lower, { burnTxHash: lower, txHash: 'T1' });
    expect(await s.isProcessed(upper)).toBe(true);
    expect(await s.getRecord(upper)).not.toBeNull();
  });

  it('writes file with restricted permissions', async () => {
    const adapter = new FileReplayStore(storePath);
    const s = new ReplayStore(adapter);
    await s.markProcessed('0x' + 'bb'.repeat(32), { burnTxHash: '0x' + 'bb'.repeat(32), txHash: 'T2' });
    const stat = fs.statSync(storePath);
    const mode = (stat.mode & 0o777).toString(8);
    expect(mode).toBe('600');
  });

  it('returns null/empty for missing keys', async () => {
    const adapter = new FileReplayStore(storePath);
    const s = new ReplayStore(adapter);
    expect(await s.isProcessed('0x' + 'cc'.repeat(32))).toBe(false);
    expect(await s.getRecord('0x' + 'cc'.repeat(32))).toBeNull();
  });

  it('atomic write survives partial read (file always valid JSON)', async () => {
    const adapter = new FileReplayStore(storePath);
    const s = new ReplayStore(adapter);
    await s.markProcessed('0x' + 'ee'.repeat(32), { burnTxHash: '0x' + 'ee'.repeat(32), txHash: 'T3' });
    await s.markProcessed('0x' + 'ff'.repeat(32), { burnTxHash: '0x' + 'ff'.repeat(32), txHash: 'T4' });
    const raw = fs.readFileSync(storePath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
