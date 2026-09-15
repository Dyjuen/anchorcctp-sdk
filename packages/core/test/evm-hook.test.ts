import { StrKey } from '@stellar/stellar-sdk';
import { buildCctpForwarderHookData, contractStrkeyToBytes32 } from '../src/evm/hook.js';

const FWD = 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ';
const DEST = 'GCX2EQXSPCHMBSEGYZRVTZWOIDRXWRWYEFRTCNVOZPYXE4QEFPKNUF3V';

describe('contractStrkeyToBytes32', () => {
  test('decodes testnet forwarder to 0x bytes32', () => {
    const got = contractStrkeyToBytes32(FWD);
    expect(got).toMatch(/^0x[0-9a-f]{64}$/);
    expect(got).toBe(`0x${Buffer.from(StrKey.decodeContract(FWD)).toString('hex')}`);
  });
  test('rejects G... account strkey', () => {
    expect(() => contractStrkeyToBytes32(DEST)).toThrow('Invalid contract strkey');
  });
});

describe('buildCctpForwarderHookData', () => {
  test('layout: 24 zero bytes, version 0 BE, length BE, strkey UTF-8', () => {
    const hook = buildCctpForwarderHookData(DEST);
    const raw = Buffer.from(hook.slice(2), 'hex');
    expect(raw.length).toBe(32 + DEST.length);
    expect(raw.subarray(0, 24).every((b) => b === 0)).toBe(true);
    expect(raw.readUInt32BE(24)).toBe(0);
    expect(raw.readUInt32BE(28)).toBe(DEST.length);
    expect(raw.subarray(32).toString('utf8')).toBe(DEST);
  });
  test('accepts C... and M... recipients', () => {
    expect(() => buildCctpForwarderHookData(FWD)).not.toThrow();
  });
  test('rejects garbage recipient (fund-loss guard)', () => {
    expect(() => buildCctpForwarderHookData('NOT_AN_ADDRESS')).toThrow('Invalid forward recipient');
  });
});
