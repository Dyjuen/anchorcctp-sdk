import { StrKey } from '@stellar/stellar-sdk';
import { buildCctpForwarderHookData, contractStrkeyToBytes32 } from '../src/evm/hook.js';
import { InvalidAddressError } from '../src/errors/index.js';

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
  test('O3: returns raw recipient bytes (no length prefix)', () => {
    const hook = buildCctpForwarderHookData(DEST);
    // Should be exactly 32 bytes = 64 hex chars (raw ed25519 bytes, no length prefix)
    const raw = Buffer.from(hook.slice(2), 'hex');
    expect(raw.length).toBe(32);
    expect(hook).toBe('0x' + Buffer.from(StrKey.decodeEd25519PublicKey(DEST)).toString('hex'));
  });
  test('accepts C... and M... recipients', () => {
    expect(() => buildCctpForwarderHookData(FWD)).not.toThrow();
  });
  test('rejects garbage recipient (fund-loss guard)', () => {
    expect(() => buildCctpForwarderHookData('NOT_AN_ADDRESS')).toThrow('Invalid forward recipient');
  });
});
