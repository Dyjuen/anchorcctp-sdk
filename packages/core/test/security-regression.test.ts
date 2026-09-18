import { isSupportedDomain } from '../src/domains/index.js';
import { normalizeBurnTxHash } from '../src/receive.js';
import { convert6to7, MAX_CCTP_AMOUNT } from '../src/decimals/index.js';
import { resolveForwarder } from '../src/forwarder/index.js';

test('regression: proto domains rejected', () => {
  for (const evil of ['constructor', '__proto__', 'toString'] as unknown as number[]) {
    expect(isSupportedDomain(evil)).toBe(false);
  }
});

test('regression: burn hash normalize + reject', () => {
  expect(normalizeBurnTxHash('0x' + 'AA'.repeat(32))).toBe('0x' + 'aa'.repeat(32));
  expect(() => normalizeBurnTxHash('not-a-hash')).toThrow(expect.objectContaining({ code: 'INVALID_HASH' }));
});

test('regression: amount cap enforced', () => {
  expect(() => convert6to7(MAX_CCTP_AMOUNT + 1n)).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
});

test('regression: forwarder requires explicit network', () => {
  expect(() => resolveForwarder(undefined)).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }));
});
