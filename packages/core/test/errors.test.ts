import {
  InvalidDomainError,
  InvalidAmountError,
  AttestationTimeoutError,
  TrustlineMissingError,
  MintFailedError,
  TrustlineCreationError,
  ReplayTransferError,
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

  it('MintFailedError carries burnTxHash + remediation', () => {
    const e = new MintFailedError('0xabc', 'revert');
    expect(e.code).toBe('MINT_FAILED');
    expect(e.burnTxHash).toBe('0xabc');
    expect(e.reason).toBe('revert');
    expect(e.remediation).toContain('mint');
    expect(e.message).toContain('0xabc');

    const eNoReason = new MintFailedError('0xabc');
    expect(eNoReason.reason).toBeUndefined();
  });

  it('TrustlineCreationError + ReplayTransferError have codes', () => {
    const tcErr = new TrustlineCreationError('GBX', 'fee too low');
    expect(tcErr.code).toBe('TRUSTLINE_CREATION_FAILED');
    expect(tcErr.destinationAddress).toBe('GBX');
    expect(tcErr.reason).toBe('fee too low');
    expect(tcErr.remediation).toBeDefined();

    const tcErrNoReason = new TrustlineCreationError('GBX');
    expect(tcErrNoReason.reason).toBeUndefined();

    const rpErr = new ReplayTransferError('0xabc');
    expect(rpErr.code).toBe('REPLAY_TRANSFER');
    expect(rpErr.burnTxHash).toBe('0xabc');
    expect(rpErr.remediation).toBeDefined();
  });
});

