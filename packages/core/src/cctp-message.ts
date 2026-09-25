import { AttestationVerificationError } from './errors/index.js';

/**
 * Absolute byte offsets of the two uint256 fields inside the CCTP v2 message
 * body, as emitted by Circle's Iris attestation API.
 *
 * Body (after the `BurnMessage` header) carries `amount` at body+68 and
 * `feeExecuted` at body+164; with a 148-byte header those land at absolute
 * offsets 216 and 312. Both fields are big-endian uint256 — the old
 * `readBigUInt64LE(4)` read `sourceDomain` and can never match the burn amount.
 */
const AMOUNT_ABS = 216; // body+68, uint256 BE
const FEE_ABS = 312; // body+164, uint256 BE
const UINT256_BYTES = 32;

/**
 * Parses the transferred amount and the fee Circle already executed from a raw
 * CCTP message hex string.
 *
 * Fail-closed: a message too short to hold both fields throws
 * {@link AttestationVerificationError} rather than returning a partial or
 * zeroed result.
 *
 * @param messageHex raw message, with or without a `0x` prefix
 * @returns `amount` (gross burn amount) and `feeExecuted` (Fast fee already
 *   taken on the source chain), both as BigInt
 */
export function parseTransferAmounts(messageHex: string): {
  amount: bigint;
  feeExecuted: bigint;
} {
  const hex = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;
  const bytes = Buffer.from(hex, 'hex');
  const minBytes = FEE_ABS + UINT256_BYTES;
  if (bytes.length < minBytes) {
    throw new AttestationVerificationError(
      messageHex.slice(0, 18),
      `message too short for amount/fee fields (need >= ${minBytes} bytes, got ${bytes.length})`
    );
  }
  // BigInt('0x' + hex) of an all-zero slice is 0n, matching the uint256 value.
  const u256 = (abs: number): bigint =>
    BigInt('0x' + bytes.subarray(abs, abs + UINT256_BYTES).toString('hex'));
  return { amount: u256(AMOUNT_ABS), feeExecuted: u256(FEE_ABS) };
}
