import { AttestationVerificationError, ForwarderContractError } from '../src/errors/index.js';
import { AttestationClient } from '../src/attestation/index.js';
import { buildMintAndForwardXdr } from '../src/forwarder/index.js';
import { buildChangeTrustXdr } from '../src/trustline/index.js';
import { StrKey } from '@stellar/stellar-sdk';

describe('Week2 branch coverage fill', () => {
  it('error constructors without reason omit suffix', () => {
    const a = new AttestationVerificationError('0xabc');
    expect(a.message).toContain('0xabc');
    expect(a.reason).toBeUndefined();
    const f = new ForwarderContractError('CID');
    expect(f.message).toContain('CID');
    expect(f.reason).toBeUndefined();
  });
  it('verifyAttestation rejects non-hex and trims whitespace', () => {
    const c = new AttestationClient({ fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as any, logger: () => {} });
    expect(c.verifyAttestation('0xZZZZ' + 'ab'.repeat(40), '0x' + 'cd'.repeat(70))).toBe(false);
    expect(c.verifyAttestation('  ' + '0x' + 'ab'.repeat(40) + '  ', '  ' + '0x' + 'cd'.repeat(70) + '  ')).toBe(true);
  });
  it('buildMintAndForwardXdr throws ForwarderContractError on bad contract', () => {
    const dest = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
    expect(() => buildMintAndForwardXdr({ message: '0x' + 'ab'.repeat(40), signature: '0x' + 'cd'.repeat(70), destination: dest, forwarderContractId: 'NOT_A_CONTRACT' })).toThrow(ForwarderContractError);
  });
  it('buildChangeTrustXdr uses default issuer', () => {
    const dest = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
    expect(typeof buildChangeTrustXdr(dest)).toBe('string');
  });
});
