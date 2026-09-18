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

  it('rejects prototype-chain properties bypassing `in` check', () => {
    const protoProps = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'];
    for (const prop of protoProps) {
      // `in` operator finds inherited props → proto bypass. Number() cast avoids type error.
      const num = Number(prop);
      expect(isSupportedDomain(num)).toBe(false);
      expect(() => assertSupportedDomain(num)).toThrow(InvalidDomainError);
    }
    // Direct string-as-number trick: objects coerce these to string keys on `in`
    expect(isSupportedDomain('constructor' as unknown as number)).toBe(false);
    expect(isSupportedDomain('__proto__' as unknown as number)).toBe(false);
    expect(isSupportedDomain('toString' as unknown as number)).toBe(false);
  });

  it('rejects non-integer domain IDs (6.5, NaN, "0")', () => {
    expect(isSupportedDomain(6.5)).toBe(false);
    expect(isSupportedDomain(NaN)).toBe(false);
    expect(isSupportedDomain('0' as unknown as number)).toBe(false);
    expect(() => assertSupportedDomain(6.5)).toThrow(InvalidDomainError);
    expect(() => assertSupportedDomain(NaN)).toThrow(InvalidDomainError);
    expect(() => assertSupportedDomain('0' as unknown as number)).toThrow(InvalidDomainError);
  });

  it('accepts valid boundary domain IDs 0 and 27', () => {
    expect(isSupportedDomain(0)).toBe(true);
    expect(isSupportedDomain(27)).toBe(true);
    expect(assertSupportedDomain(0).chain).toBe('ethereum');
    expect(assertSupportedDomain(27).chain).toBe('stellar');
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
