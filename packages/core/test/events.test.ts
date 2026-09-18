import { createEventEmitter, AnchorCCTPEvents } from '../src/events/index.js';

describe('Typed Lifecycle Event Emitter', () => {
  it('emits onReceiving then onSettled with typed payloads', () => {
    const ee = createEventEmitter();
    const got: string[] = [];
    ee.on('onReceiving', (p) => got.push(p.status));
    ee.on('onSettled', (p) => got.push(p.txHash));
    ee.emit('onReceiving', { burnTxHash: '0x1', status: 'attesting' });
    ee.emit('onSettled', { amount: 100n, dust: 0n, txHash: '0xm' });
    expect(got).toEqual(['attesting', '0xm']);
  });

  it('supports once and off listener lifecycle', () => {
    const ee = createEventEmitter();
    let count = 0;
    const handler = () => {
      count++;
    };

    ee.once('onReceiving', handler);
    ee.emit('onReceiving', { burnTxHash: '0x1', status: 'pending' });
    ee.emit('onReceiving', { burnTxHash: '0x1', status: 'pending' });
    expect(count).toBe(1);

    let dustCount = 0;
    const dustHandler = (p: AnchorCCTPEvents['onDustCollected']) => {
      dustCount += Number(p.amount);
    };
    ee.on('onDustCollected', dustHandler);
    ee.emit('onDustCollected', { amount: 5n, collector: 'GBX', burnTxHash: '0x1' });
    expect(dustCount).toBe(5);

    ee.off('onDustCollected', dustHandler);
    ee.emit('onDustCollected', { amount: 10n, collector: 'GBX', burnTxHash: '0x1' });
    expect(dustCount).toBe(5);
  });

  it('emits onError events correctly', () => {
    const ee = createEventEmitter();
    let capturedErr: unknown = null;
    ee.on('onError', (p) => {
      capturedErr = p.error;
    });

    const testError = new Error('failed attestation');
    ee.emit('onError', { error: testError, burnTxHash: '0x1' });
    expect(capturedErr).toBe(testError);
  });

  it('N2: throwing listener does not break other listeners on same event', () => {
    const ee = createEventEmitter();
    const results: string[] = [];
    ee.on('onSettled', () => { throw new Error('boom'); });
    ee.on('onSettled', (p) => results.push(p.txHash));
    ee.emit('onSettled', { amount: 100n, dust: 0n, txHash: 'ok' });
    expect(results).toEqual(['ok']);
  });

  it('N2: throwing onError listener does not mask original error', () => {
    const ee = createEventEmitter();
    const original = new Error('original');
    ee.on('onError', () => { throw new Error('handler boom'); });
    ee.on('onError', (p) => expect(p.error).toBe(original));
    ee.emit('onError', { error: original, burnTxHash: '0x1' });
  });

  it('O12: warn when >10 listeners registered on same event', () => {
    const warns: string[] = [];
    const ee = createEventEmitter((msg) => warns.push(msg));
    for (let i = 0; i < 10; i++) {
      ee.on('onSettled', () => {});
    }
    expect(warns).toHaveLength(0);
    ee.on('onSettled', () => {}); // 11th
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('11');
  });
});
