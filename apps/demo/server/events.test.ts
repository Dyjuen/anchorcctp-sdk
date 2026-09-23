// apps/demo/server/events.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateEventParams, publicConfigBundle, SimTimeline, postInitiate, fileStoreAt, collectSse, createSseHandler } from './events.js';
const tmpPath = () => join(mkdtempSync(join(tmpdir(), 'replay-')), 'replay.json');

const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('validateEventParams', () => {
  it('normalizes uppercase burn hash', () => {
    const p = validateEventParams({ address: G, burnTxHash: '0X' + 'AB'.repeat(32), sourceDomain: '0' });
    expect(p.burnTxHash).toBe('0x' + 'ab'.repeat(32));
  });
  it('400s unknown domain', () => {
    expect(() => validateEventParams({ address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '999' }))
      .toThrow(/domain/i);
  });
  it('400s bad address', () => {
    expect(() => validateEventParams({ address: 'NOPE', burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' }))
      .toThrow(/address/i);
  });
});

describe('publicConfigBundle', () => {
  it('leaks no secrets', () => {
    const bundle = publicConfigBundle({ SECRET: 'SDNMRSIZWINOTESTFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234', STELLAR_SECRET: 'SDNMRSIZWINOTESTFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234', VITE_NETWORK: 'testnet' } as never);
    const text = JSON.stringify(bundle);
    expect(text).not.toMatch(/secret|private|seed|mnemonic|password|token/i);
    expect(text).not.toMatch(/S[A-Z2-7]{55}/);
  });
  it('denies POST without Origin', async () => {
    const res = await postInitiate({ headers: {} } as never);
    expect(res.status).toBe(403);
  });
  it('400 matrix: missing, non-numeric domain, array address', () => {
    for (const q of [
      { burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' },
      { address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: 'abc' },
      { address: [G, G], burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' },
      { address: ' ' + G + ' ', burnTxHash: '0X' + 'AB'.repeat(32), sourceDomain: '' },
    ]) expect(() => validateEventParams(q as never)).toThrow(/400|address|domain|burn/i);
  });
  it('429 on stream flood', async () => {
    const h = createSseHandler({ now: () => 0 } as never);
    for (let i = 0; i < 11; i++) h.mockRequest({ ip: '1.2.3.4', query: { address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' } } as never);
    expect(h.lastStatus()).toBe(429);
  });
  it('replay served from persisted FileReplayStore', async () => {
    const store = fileStoreAt(tmpPath());
    await store.markProcessed('0x' + 'ab'.repeat(32));
    const events = await collectSse({ address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' }, { store });
    expect(events.at(-1)).toMatchObject({ type: 'settled' });
  });
});

describe('SimTimeline', () => {
  it('flags simulated and emits 3 attempts then settled', () => {
    const steps = SimTimeline('0x' + 'ab'.repeat(32), 0);
    expect(steps.filter(s => s.type === 'receiving')).toHaveLength(3);
    expect(steps.at(-1)).toMatchObject({ type: 'settled', simulated: true });
    expect((steps.at(-1) as { mintTxHash: string }).mintTxHash).toMatch(/^SIM-/);
    expect((steps.at(-1) as { mintTxHash: string }).mintTxHash).not.toMatch(/^0x/);
  });
  it('enforces global concurrent cap', async () => {
    const h = createSseHandler({ now: () => 0, maxConcurrent: 2 } as never);
    h.mockRequest({ ip: '10.0.0.1', query: { address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' } } as never);
    h.mockRequest({ ip: '10.0.0.2', query: { address: G, burnTxHash: '0x' + 'cd'.repeat(32), sourceDomain: '0' } } as never);
    h.mockRequest({ ip: '10.0.0.3', query: { address: G, burnTxHash: '0x' + 'ef'.repeat(32), sourceDomain: '0' } } as never);
    expect(h.lastStatus()).toBe(429);
  });
  it('single-flights same burnTxHash', async () => {
    let polls = 0;
    const sdkFactory = () => ({ poll: () => { polls++; return { onReceiving() {}, onSettled() {}, onError() {} }; } });
    const deps = { store: { isProcessed: async () => false }, sdkFactory, now: () => 0 } as never;
    await collectSse({ address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: '0' }, deps);
    await collectSse({ address: G, burnTxHash: '0X' + 'AB'.repeat(32), sourceDomain: '0' }, deps);
    expect(polls).toBe(1);
  });
});
