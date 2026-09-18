import { StrKey } from '@stellar/stellar-sdk';
import { encodeFunctionData } from 'viem';
import { buildCctpForwarderHookData, contractStrkeyToBytes32 } from '../src/evm/hook.js';
import { MESSENGER_ABI } from '../src/evm/burn.js';

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

  test('O3 round-trip: encodeFunctionData → decode hookData bytes (no double-encode)', () => {
    const hookData = buildCctpForwarderHookData(DEST);
    const fakeMint = '0x' + '01'.repeat(32) as `0x${string}`;
    const fakeCaller = '0x' + '01'.repeat(32) as `0x${string}`;
    const burnToken = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
    const messenger = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`;

    const calldata = encodeFunctionData({
      abi: MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [1n, 27, fakeMint, burnToken, fakeCaller, 5000n, 1000, hookData],
    });

    const hex = calldata.slice(2); // strip 0x
    // calldata = 4-byte selector + ABI head (8×32) + tail
    // Selector: hex[0..8], Head: hex[8..520], Tail: hex[520..]
    const selectorEnd = 8; // 4 bytes = 8 hex chars
    const headSlot7Offset = selectorEnd + 7 * 64; // param 7 offset slot
    const offsetHex = hex.slice(headSlot7Offset, headSlot7Offset + 64);
    const offsetFromHead = Number(BigInt('0x' + offsetHex)); // relative to head start

    const tailStart = selectorEnd + offsetFromHead * 2;
    const lenHex = hex.slice(tailStart, tailStart + 64);
    const dataLen = Number(BigInt('0x' + lenHex));
    const dataHex = hex.slice(tailStart + 64, tailStart + 64 + dataLen * 2);
    const decodedBytes = ('0x' + dataHex) as `0x${string}`;

    expect(decodedBytes).toBe(hookData);
    expect(dataLen).toBe(32); // G... recipient = raw ed25519 = 32 bytes
  });
});
