import { parseTransferAmounts } from '../src/cctp-message.js';
import { AttestationVerificationError } from '../src/errors/index.js';

// Real Iris frame: minFinalityThreshold 1000, executed 1000, amount 100000, maxFee 5000, feeExecuted 13.
const MESSAGE = '0x00000001000000060000001bb7757e8fb73064f5ab68152c80d7ac6f04cecbd36e45e2bb68862733171563e10000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daada6f9ee0786c812344d82817ef19b648b4af120f8bd10bf658e6b99eacff24b83de86ac50b47eaf2840fe23e48179551660fd1072fba6f445d4a6bd7af4ab93e000003e8000003e800000001000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e3de86ac50b47eaf2840fe23e48179551660fd1072fba6f445d4a6bd7af4ab93e00000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000edd1b3b72e41d16425075eabe699612fe22c0e630000000000000000000000000000000000000000000000000000000000001388000000000000000000000000000000000000000000000000000000000000000d00000000000000000000000000000000000000000000000000000000004a27d5afa242f2788ec0c886c66359e6ce40e37b46d821633136aecbf17272042bd4da';

it('parses amount=100000 and feeExecuted=13 from the real Fast frame', () => {
  expect(parseTransferAmounts(MESSAGE)).toEqual({ amount: 100000n, feeExecuted: 13n });
});

it('rejects short messages fail-closed', () => {
  expect(() => parseTransferAmounts('0x1234')).toThrow(/too short/i);
});

it('throws AttestationVerificationError (not a bare Error) on short input', () => {
  expect(() => parseTransferAmounts('0x1234')).toThrow(AttestationVerificationError);
});

it('accepts a message without the 0x prefix', () => {
  expect(parseTransferAmounts(MESSAGE.slice(2))).toEqual({ amount: 100000n, feeExecuted: 13n });
});

it('parses the boundary message that is exactly long enough for the fee field', () => {
  const buf = Buffer.alloc(344, 0); // 312 + 32
  buf.writeBigUInt64BE(7n, 312 + 24);
  buf.writeBigUInt64BE(9n, 216 + 24);
  expect(parseTransferAmounts('0x' + buf.toString('hex'))).toEqual({
    amount: 9n,
    feeExecuted: 7n,
  });
});
