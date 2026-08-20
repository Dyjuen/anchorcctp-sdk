import { InvalidAmountError } from '../errors/index.js';

export interface DecimalConversionResult {
  /** Credit amount on Stellar (7 decimals, in stroops) */
  stellarAmount: bigint;
  /** Remainder dust that cannot be credited (in 7-decimal stroops) */
  dust: bigint;
}

/**
 * Converts 6-decimal CCTP USDC units to 7-decimal Stellar stroops.
 * 6 -> 7 decimals multiplication is exact (multiply by 10n). Dust is 0n.
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
