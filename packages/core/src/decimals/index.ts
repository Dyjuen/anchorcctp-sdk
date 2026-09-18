import { InvalidAmountError } from '../errors/index.js';

/** Maximum CCTP amount: u64 max (2^64 - 1). Amounts above this are rejected. */
export const MAX_CCTP_AMOUNT = 2n ** 64n - 1n;

export interface DecimalConversionResult {
  /** Credit amount on Stellar (7 decimals, in stroops) */
  stellarAmount: bigint;
  /** Remainder dust that cannot be credited (in 7-decimal stroops) */
  dust: bigint;
}

/**
 * Converts 6-decimal CCTP USDC units to 7-decimal Stellar stroops.
 * 6 -> 7 multiplication is exact (×10n), so dust is always 0n by design.
 * Dust branch is inert for this direction — active only in {@link convert7to6}.
 */
export function convert6to7(cctpAmountBase6: bigint): DecimalConversionResult {
  if (typeof cctpAmountBase6 !== 'bigint' || cctpAmountBase6 <= 0n || cctpAmountBase6 > MAX_CCTP_AMOUNT) {
    throw new InvalidAmountError(`Amount must be > 0n and <= ${MAX_CCTP_AMOUNT}n (u64 max), received ${cctpAmountBase6}n.`);
  }

  const stellarAmount = cctpAmountBase6 * 10n;
  return {
    stellarAmount,
    dust: 0n,
  };
}

/**
 * Converts 7-decimal Stellar stroops to 6-decimal CCTP base units.
 * Remainder stroops (< 10n) are rounded down and returned as dust.
 */
export function convert7to6(stellarAmountStroops: bigint): { cctpAmount: bigint; dust: bigint } {
  if (typeof stellarAmountStroops !== 'bigint' || stellarAmountStroops <= 0n || stellarAmountStroops > MAX_CCTP_AMOUNT) {
    throw new InvalidAmountError(`Amount must be > 0n and <= ${MAX_CCTP_AMOUNT}n (u64 max), received ${stellarAmountStroops}n.`);
  }

  const cctpAmount = stellarAmountStroops / 10n;
  const dust = stellarAmountStroops % 10n;

  return {
    cctpAmount,
    dust,
  };
}

/**
 * Formats a 7-decimal Stellar stroops amount as a human-readable decimal string.
 * e.g. 1_000_000_000n -> "100.0000000"
 */
export function formatStellarUnits(stellarAmountStroops: bigint): string {
  const isNegative = stellarAmountStroops < 0n;
  const absVal = isNegative ? -stellarAmountStroops : stellarAmountStroops;
  const whole = absVal / 10_000_000n;
  const fraction = absVal % 10_000_000n;
  const paddedFraction = fraction.toString().padStart(7, '0');
  return `${isNegative ? '-' : ''}${whole.toString()}.${paddedFraction}`;
}

/**
 * Parses a decimal string representation of Stellar units into 7-decimal stroops (bigint).
 * e.g. "100.0000000" -> 1_000_000_000n
 */
export function parseStellarUnits(val: string): bigint {
  const trimmed = val.trim();
  if (!trimmed || !/^-?\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new InvalidAmountError(`Invalid Stellar unit string format: "${val}". Expected integer or up to 7 decimal places.`);
  }
  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [wholePart, fracPart = ''] = unsigned.split('.');

  // N4: whole digits ≤18 to prevent BigInt DoS via huge allocations
  if (wholePart.length > 18) {
    throw new InvalidAmountError(`Whole-part digits exceeds 18: "${val}".`);
  }

  const paddedFrac = fracPart.padEnd(7, '0');
  const stroops = BigInt(wholePart) * 10_000_000n + BigInt(paddedFrac);

  // N4: total stroops must not exceed MAX_CCTP_AMOUNT * 10n
  if (stroops > MAX_CCTP_AMOUNT * 10n) {
    throw new InvalidAmountError(`Stroops amount exceeds MAX_CCTP_AMOUNT * 10: "${val}".`);
  }

  return isNegative ? -stroops : stroops;
}

