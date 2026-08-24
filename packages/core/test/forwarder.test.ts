import { translateToStellar, submitMint } from '../src/forwarder/index.js';
import { MintFailedError } from '../src/errors/index.js';
import { StrKey } from '@stellar/stellar-sdk';

describe('Forwarder & Address Translation', () => {
  it('translateToStellar returns a G... address for a 32-byte EVM address', () => {
    const raw32 = '0x' + '11'.repeat(32);
    const g = translateToStellar(raw32);
    expect(g.startsWith('G')).toBe(true);
    expect(g.length).toBe(56);
    expect(StrKey.isValidEd25519PublicKey(g)).toBe(true);
  });

  it('translateToStellar preserves already-valid Stellar G-addresses', () => {
    // Generate a valid Stellar G address
    const sampleRaw = Buffer.alloc(32, 0x22);
    const validG = StrKey.encodeEd25519PublicKey(sampleRaw);
    expect(translateToStellar(validG)).toBe(validG);
  });

  it('translateToStellar handles 20-byte addresses padded to 32 bytes', () => {
    const raw20 = '0x' + 'aa'.repeat(20);
    const g = translateToStellar(raw20);
    expect(g.startsWith('G')).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(g)).toBe(true);
  });

  it('translateToStellar throws for invalid address inputs', () => {
    expect(() => translateToStellar('invalid-address-string')).toThrow();
    expect(() => translateToStellar(12345 as any)).toThrow();
  });

  it('submitMint delegates signing to caller callback with custom contract ID', async () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    let payload = '';
    const signer = async (xdr: string) => {
      payload = Buffer.from(xdr, 'base64').toString('utf-8');
      return 'TX_CUSTOM';
    };
    const r = await submitMint(
      {
        message: '0xmsg',
        signature: '0xsig',
        destination,
        forwarderContractId: 'CUSTOM_CONTRACT_ID',
      },
      signer
    );
    expect(r.txHash).toBe('TX_CUSTOM');
    expect(payload).toContain('CUSTOM_CONTRACT_ID');
  });


  it('submitMint delegates signing to caller callback', async () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    const signer = async (xdr: string) => {
      expect(typeof xdr).toBe('string');
      return 'SIGNED_' + xdr;
    };
    const r = await submitMint(
      { message: '0xmsg', signature: '0xsig', destination },
      signer
    );
    expect(r.txHash).toMatch(/^SIGNED_/);
  });

  it('submitMint wraps signer errors in MintFailedError', async () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x44));
    const failingSigner = async () => {
      throw new Error('signature rejected by user');
    };
    await expect(
      submitMint(
        { message: '0xmsg', signature: '0xsig', destination },
        failingSigner
      )
    ).rejects.toThrow(MintFailedError);
  });
});
