import { convert6to7, convert7to6, InvalidAmountError } from '../src/index';

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
});
