import { isSupportedDomain, assertSupportedDomain, InvalidDomainError } from '../src/index';

describe('CCTP Domain ID Registry', () => {
  it('identifies Stellar as domain 27', () => {
    const meta = assertSupportedDomain(27);
    expect(meta.chain).toBe('stellar');
    expect(meta.name).toBe('Stellar');
  });

  it('identifies Ethereum as domain 0 and Base as domain 6', () => {
    expect(isSupportedDomain(0)).toBe(true);
    expect(isSupportedDomain(6)).toBe(true);
  });

  it('rejects invalid or unknown domain ID', () => {
    expect(isSupportedDomain(9999)).toBe(false);
    expect(() => assertSupportedDomain(9999)).toThrow(InvalidDomainError);
  });
});
