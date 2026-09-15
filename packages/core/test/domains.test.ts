import {
  CCTP_DOMAINS,
  getDomainMeta,
  isSupportedDomain,
  assertSupportedDomain,
  InvalidDomainError,
} from '../src/index';

describe('CCTP Domain ID Registry', () => {
  it('registry contains all 30 live domains incl. Stellar=27', () => {
    expect(Object.keys(CCTP_DOMAINS).length).toBe(30);
    expect(CCTP_DOMAINS[27].chain).toBe('stellar');
    expect(CCTP_DOMAINS[0].name).toBe('Ethereum');
    expect(CCTP_DOMAINS[37].name).toBe('X Layer');
    expect(CCTP_DOMAINS[9].name).toBe('Aptos');
    expect(CCTP_DOMAINS[15].name).toBe('Monad');
    expect(CCTP_DOMAINS[17].name).toBe('BNB Smart Chain');
    expect(CCTP_DOMAINS[26].name).toBe('Arc');
    expect(CCTP_DOMAINS[33].name).toBe('Plasma');
    expect((CCTP_DOMAINS as any)[4]).toBeUndefined();
  });

  it('getDomainMeta returns meta; unknown throws InvalidDomainError', () => {
    expect(getDomainMeta(6).name).toBe('Base');
    expect(getDomainMeta(27).name).toBe('Stellar');
    expect(getDomainMeta(9).chain).toBe('aptos');
    expect(isSupportedDomain(999)).toBe(false);
    expect(() => assertSupportedDomain(999)).toThrow(InvalidDomainError);
    expect(() => getDomainMeta(999)).toThrow(InvalidDomainError);
  });
});
