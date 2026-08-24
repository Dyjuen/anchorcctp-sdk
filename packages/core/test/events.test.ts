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
});
