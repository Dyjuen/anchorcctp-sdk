import { InvalidAmountError } from '../errors/index.js';

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
  if (cctpAmountBase6 <= 0n) {
    throw new InvalidAmountError(`Amount must be greater than 0n, received ${cctpAmountBase6}n.`);
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
  if (stellarAmountStroops <= 0n) {
    throw new InvalidAmountError(`Amount must be greater than 0n, received ${stellarAmountStroops}n.`);
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
  const paddedFrac = fracPart.padEnd(7, '0');
  const stroops = BigInt(wholePart) * 10_000_000n + BigInt(paddedFrac);
  return isNegative ? -stroops : stroops;
}

