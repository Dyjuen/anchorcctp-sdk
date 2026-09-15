import {
  convert6to7,
  convert7to6,
  formatStellarUnits,
  parseStellarUnits,
  InvalidAmountError,
} from '../src/index';

describe('Decimal Conversion & Dust Math', () => {
  describe('convert6to7 (CCTP 6 -> Stellar 7)', () => {
    it('exact conversion for 1 USDC (1,000,000 base units -> 10,000,000 stroops)', () => {
      const result = convert6to7(1_000_000n);
      expect(result.stellarAmount).toBe(10_000_000n);
      expect(result.dust).toBe(0n);
    });

    it('exact conversion for 100.50 USDC (100,500,000 base units -> 1,005,000,000 stroops)', () => {
      const result = convert6to7(100_500_000n);
      expect(result.stellarAmount).toBe(1_005_000_000n);
      expect(result.dust).toBe(0n);
    });

    it('rejects zero amount with InvalidAmountError', () => {
      expect(() => convert6to7(0n)).toThrow(InvalidAmountError);
    });

    it('rejects negative amount with InvalidAmountError', () => {
      expect(() => convert6to7(-100n)).toThrow(InvalidAmountError);
    });
  });

  describe('convert7to6 (Stellar 7 -> CCTP 6)', () => {
    it('exact conversion with 0 dust for round 6-decimal units', () => {
      const result = convert7to6(10_000_000n);
      expect(result.cctpAmount).toBe(1_000_000n);
      expect(result.dust).toBe(0n);
    });

    it('isolates 1-stroop dust remainder', () => {
      const result = convert7to6(10_000_007n);
      expect(result.cctpAmount).toBe(1_000_000n);
      expect(result.dust).toBe(7n);
    });

    it('conservation invariant: cctpAmount * 10 + dust === originalStroops', () => {
      const input = 123_456_789n;
      const result = convert7to6(input);
      expect(result.cctpAmount * 10n + result.dust).toBe(input);
    });

    it('rejects zero amount with InvalidAmountError', () => {
      expect(() => convert7to6(0n)).toThrow(InvalidAmountError);
    });

    it('rejects negative amount with InvalidAmountError', () => {
      expect(() => convert7to6(-50n)).toThrow(InvalidAmountError);
    });
  });

  describe('formatStellarUnits (stroops -> string)', () => {
    it('formats round amounts into 7 decimals', () => {
      expect(formatStellarUnits(10_000_000n)).toBe('1.0000000');
      expect(formatStellarUnits(1_000_000_000n)).toBe('100.0000000');
    });

    it('formats fractional amounts accurately', () => {
      expect(formatStellarUnits(15_000_000n)).toBe('1.5000000');
      expect(formatStellarUnits(10_500_000n)).toBe('1.0500000');
      expect(formatStellarUnits(7n)).toBe('0.0000007');
      expect(formatStellarUnits(0n)).toBe('0.0000000');
    });


    it('formats negative amounts properly with leading minus', () => {
      expect(formatStellarUnits(-10_000_000n)).toBe('-1.0000000');
      expect(formatStellarUnits(-7n)).toBe('-0.0000007');
    });
  });

  describe('parseStellarUnits (string -> stroops)', () => {
    it('parses valid integer and decimal strings', () => {
      expect(parseStellarUnits('1')).toBe(10_000_000n);
      expect(parseStellarUnits('100.0000000')).toBe(1_000_000_000n);
      expect(parseStellarUnits('0.0000007')).toBe(7n);
      expect(parseStellarUnits('0')).toBe(0n);
      expect(parseStellarUnits('100.5')).toBe(1_005_000_000n);
    });

    it('parses negative values correctly', () => {
      expect(parseStellarUnits('-1.5')).toBe(-15_000_000n);
    });

    it('rejects malformed strings with InvalidAmountError', () => {
      expect(() => parseStellarUnits('')).toThrow(InvalidAmountError);
      expect(() => parseStellarUnits('abc')).toThrow(InvalidAmountError);
      expect(() => parseStellarUnits('1.2.3')).toThrow(InvalidAmountError);
      expect(() => parseStellarUnits('1.00000001')).toThrow(InvalidAmountError); // > 7 decimals
    });
  });
});

