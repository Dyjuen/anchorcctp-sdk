import { translateToStellar, submitMint, buildMintAndForwardXdr } from '../src/forwarder/index.js';
import { MintFailedError, ForwarderContractError } from '../src/errors/index.js';
import { StrKey, TransactionBuilder } from '@stellar/stellar-sdk';

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
    let captured = '';
    const signer = async (xdr: string) => {
      captured = xdr;
      return 'TX_CUSTOM';
    };
    const r = await submitMint(
      {
        message: '0x' + 'ab'.repeat(40),
        signature: '0x' + 'cd'.repeat(70),
        destination,
        forwarderContractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      },
      signer
    );
    expect(r.txHash).toBe('TX_CUSTOM');
    expect(() => (TransactionBuilder as any).fromXDR(captured, 'TESTNET')).not.toThrow();
  });


  it('submitMint delegates signing to caller callback', async () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    const signer = async (xdr: string) => {
      expect(typeof xdr).toBe('string');
      return 'SIGNED_' + xdr;
    };
    const r = await submitMint(
      { message: '0x' + 'ab'.repeat(40), signature: '0x' + 'cd'.repeat(70), destination },
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

  it('buildMintAndForwardXdr builds parseable Stellar XDR', () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    const xdr = buildMintAndForwardXdr({
      message: '0x' + 'ab'.repeat(40),
      signature: '0x' + 'cd'.repeat(70),
      destination,
      forwarderContractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    });
    expect(typeof xdr).toBe('string');
    const parsed: any = (TransactionBuilder as any).fromXDR(xdr, 'TESTNET');
    expect(parsed.source).toBe(destination);
  });

  it('submitMint passes real XDR to signer', async () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    let captured = '';
    const r = await submitMint(
      {
        message: '0x' + 'ab'.repeat(40),
        signature: '0x' + 'cd'.repeat(70),
        destination,
      },
      async (x) => {
        captured = x;
        return 'TX_REAL';
      }
    );
    expect(r.txHash).toBe('TX_REAL');
    expect(() => (TransactionBuilder as any).fromXDR(captured, 'TESTNET')).not.toThrow();
  });

  it('buildMintAndForwardXdr throws ForwarderContractError for invalid contract ID', () => {
    const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x33));
    expect(() =>
      buildMintAndForwardXdr({
        message: '0x' + 'ab'.repeat(40),
        signature: '0x' + 'cd'.repeat(70),
        destination,
        forwarderContractId: 'INVALID_CONTRACT',
      })
    ).toThrow(ForwarderContractError);
  });
});
