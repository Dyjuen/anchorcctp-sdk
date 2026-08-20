import {
  InvalidDomainError,
  InvalidAmountError,
  AttestationTimeoutError,
  TrustlineMissingError
} from '../src/index';

describe('Typed Error Classes', () => {
  it('InvalidDomainError stores domainId and code', () => {
    const err = new InvalidDomainError(999);
    expect(err.code).toBe('INVALID_DOMAIN');
    expect(err.domainId).toBe(999);
    expect(err.remediation).toContain('supported sourceDomain');
    expect(err.message).toContain('999');
  });

  it('InvalidAmountError stores code and remediation', () => {
    const err = new InvalidAmountError('Amount too low');
    expect(err.code).toBe('INVALID_AMOUNT');
    expect(err.remediation).toContain('BigInt');
    expect(err.message).toBe('Amount too low');
  });

  it('AttestationTimeoutError stores transaction context', () => {
    const err = new AttestationTimeoutError('0x123', 5000);
    expect(err.code).toBe('ATTESTATION_TIMEOUT');
    expect(err.burnTxHash).toBe('0x123');
    expect(err.elapsedTimeMs).toBe(5000);
    expect(err.remediation).toContain('pollTimeoutMs');
  });

  it('TrustlineMissingError stores destination address', () => {
    const err = new TrustlineMissingError('GBBD47...');
    expect(err.code).toBe('TRUSTLINE_MISSING');
    expect(err.destinationAddress).toBe('GBBD47...');
    expect(err.remediation).toContain('allowTrustlineCreation');
  });
});
