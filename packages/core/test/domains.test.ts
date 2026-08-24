import {
  CCTP_DOMAINS,
  getDomainMeta,
  isSupportedDomain,
  assertSupportedDomain,
  InvalidDomainError,
} from '../src/index';

describe('CCTP Domain ID Registry', () => {
  it('registry contains all 26 mainnet domains incl. Stellar=27', () => {
    expect(Object.keys(CCTP_DOMAINS).length).toBe(26);
    expect(CCTP_DOMAINS[27].chain).toBe('stellar');
    expect(CCTP_DOMAINS[0].name).toBe('Ethereum');
    expect(CCTP_DOMAINS[37].name).toBe('X Layer');
    expect(CCTP_DOMAINS[4].name).toBe('Noble');
  });

  it('getDomainMeta returns meta; unknown throws InvalidDomainError', () => {
    expect(getDomainMeta(6).name).toBe('Base');
    expect(getDomainMeta(27).name).toBe('Stellar');
    expect(isSupportedDomain(999)).toBe(false);
    expect(() => assertSupportedDomain(999)).toThrow(InvalidDomainError);
    expect(() => getDomainMeta(999)).toThrow(InvalidDomainError);
  });
});

