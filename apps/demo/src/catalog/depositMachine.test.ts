import { describe, it, expect } from 'vitest';
import { reduceDeposit, initialDeposit, parseUsdcBase6, buildEventsUrl, assertAddressUnchanged, simErrorEvent, extractLiveAddress } from './depositMachine.js';

const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('parseUsdcBase6', () => {
  it('parses 100.00 to 100000000n', () => {
    expect(parseUsdcBase6('100.00')).toBe(100000000n);
  });
  it('rejects 7-decimal precision', () => {
    expect(() => parseUsdcBase6('100.0000001')).toThrow(/precision/i);
  });
  it('rejects negative and empty', () => {
    expect(() => parseUsdcBase6('-1')).toThrow();
    expect(() => parseUsdcBase6('')).toThrow();
  });
  it('rejects zero, whitespace-only, overflow', () => {
    expect(() => parseUsdcBase6('0')).toThrow();
    expect(() => parseUsdcBase6('   ')).toThrow();
    expect(parseUsdcBase6(' 100.00 ')).toBe(100000000n);
    expect(() => parseUsdcBase6('18446744073709551616')).toThrow(/overflow|too large/i);
  });
});

describe('reduceDeposit', () => {
  it('advances attempt counter on receiving events', () => {
    let s = initialDeposit;
    s = reduceDeposit(s, { type: 'receiving', attempt: 2 });
    expect(s.step).toBe('attesting');
    expect(s.attempts).toBe(2);
  });
  it('settles with simulated flag', () => {
    const s = reduceDeposit(initialDeposit, { type: 'settled', simulated: true, txHash: 'SIM-0001', stellarAmount: '100.0000000', dust: '0' });
    expect(s.step).toBe('settled');
    expect(s.receipt?.simulated).toBe(true);
    expect(s.receipt?.txHash).toMatch(/^SIM-/);
  });
  it('builds encoded EventSource URL', () => {
    const u = buildEventsUrl({ address: G, burnTxHash: '0x' + 'ab'.repeat(32), sourceDomain: 0 });
    expect(u).toBe('/api/events?address=' + encodeURIComponent(G) + '&burnTxHash=' + encodeURIComponent('0x' + 'ab'.repeat(32)) + '&sourceDomain=0');
  });
  it('aborts on address drift', () => {
    const drifted = 'G' + 'A'.repeat(55);
    expect(() => assertAddressUnchanged(G, drifted)).toThrow(/Network mismatch/i);
  });
  it('extracts address from getAddress object shape', () => {
    expect(extractLiveAddress({ address: G })).toBe(G);
    expect(extractLiveAddress(G)).toBe(G);
    expect(extractLiveAddress({ address: '' })).toBeNull();
    expect(extractLiveAddress(null)).toBeNull();
  });
});

describe('simErrorEvent', () => {
  it('returns null for none', () => {
    expect(simErrorEvent('none')).toBeNull();
  });
  it('maps rejected-signing to actionable error event', () => {
    const e = simErrorEvent('rejected-signing');
    expect(e).toEqual({ type: 'error', message: expect.stringMatching(/signing rejected/i) });
  });
  it('maps insufficient-xlm to actionable error event', () => {
    const e = simErrorEvent('insufficient-xlm');
    expect(e).toEqual({ type: 'error', message: expect.stringMatching(/insufficient xlm/i) });
  });
  it('maps network-mismatch to actionable error event', () => {
    const e = simErrorEvent('network-mismatch');
    expect(e).toEqual({ type: 'error', message: expect.stringMatching(/network mismatch/i) });
  });
  it('returns null for unknown values', () => {
    expect(simErrorEvent('bogus')).toBeNull();
  });
});
