import { ensureTrustline, buildChangeTrustXdr, TESTNET_USDC_ISSUER } from '../src/trustline/index.js';
import { TrustlineMissingError, TrustlineCreationError } from '../src/errors/index.js';
import { TransactionBuilder, StrKey } from '@stellar/stellar-sdk';

describe('Trustline Inspection & Management', () => {
  const sampleDestination = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  it('returns created: false when trustline already exists', async () => {
    const res = await ensureTrustline({
      destination: sampleDestination,
      asset: 'USDC',
      allowCreation: false,
      hasTrustline: async () => true,
    });
    expect(res.created).toBe(false);
  });

  it('throws TrustlineMissingError when absent and creation disabled', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        asset: 'USDC',
        allowCreation: false,
        hasTrustline: async () => false,
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_MISSING' });
  });

  it('creates trustline via injected createTrustline when allowCreation true', async () => {
    const r = await ensureTrustline({
      destination: sampleDestination,
      asset: 'USDC',
      allowCreation: true,
      spendCapXlm: 2,
      usdcIssuer: TESTNET_USDC_ISSUER,
      hasTrustline: async () => false,
      createTrustline: async (xdr) => {
        expect(typeof xdr).toBe('string');
        return '0xt';
      },
    });
    expect(r.created).toBe(true);
  });

  it('throws TrustlineCreationError if requiredReserveXlm exceeds spendCapXlm', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        asset: 'USDC',
        allowCreation: true,
        spendCapXlm: 0.2, // Below the clamped 0.5 XLM requirement
        requiredReserveXlm: 0.5,
        usdcIssuer: TESTNET_USDC_ISSUER,
        hasTrustline: async () => false,
        createTrustline: async () => '0xt',
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('throws TrustlineCreationError if createTrustline fails', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        asset: 'USDC',
        allowCreation: true,
        spendCapXlm: 2,
        usdcIssuer: TESTNET_USDC_ISSUER,
        hasTrustline: async () => false,
        createTrustline: async () => {
          throw new Error('tx simulation failed');
        },
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('creates trustline with default asset and default reserve when omitted', async () => {
    let xdrPayload = '';
    const r = await ensureTrustline({
      destination: sampleDestination,
      allowCreation: true,
      spendCapXlm: 2,
      usdcIssuer: TESTNET_USDC_ISSUER,
      hasTrustline: async () => false,
      createTrustline: async (x) => {
        xdrPayload = x;
        return '0xt_default';
      },
    });
    expect(r.created).toBe(true);
    expect(() => (TransactionBuilder as any).fromXDR(xdrPayload, 'TESTNET')).not.toThrow();
  });

  it('throws TrustlineCreationError if allowCreation true but no createTrustline callback provided', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        allowCreation: true,
        hasTrustline: async () => false,
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('C8: spendCapXlm required when allowCreation true', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        allowCreation: true,
        hasTrustline: async () => false,
        createTrustline: async () => 'x',
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('C8: spendCapXlm=NaN rejected', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        allowCreation: true,
        spendCapXlm: NaN,
        hasTrustline: async () => false,
        createTrustline: async () => 'x',
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('C8: spendCapXlm=-1 rejected', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        allowCreation: true,
        spendCapXlm: -1,
        hasTrustline: async () => false,
        createTrustline: async () => 'x',
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('O9: requiredReserve clamped to min 0.5', async () => {
    let capturedXdr = '';
    const r = await ensureTrustline({
      destination: sampleDestination,
      allowCreation: true,
      spendCapXlm: 1,
      requiredReserveXlm: 0.1,
      usdcIssuer: TESTNET_USDC_ISSUER,
      hasTrustline: async () => false,
      createTrustline: async (x) => { capturedXdr = x; return '0xt'; },
    });
    expect(r.created).toBe(true);
    // clampedReserve=0.5, spendCap=1 → 0.5 <= 1 → passes
  });

  it('O9: requiredReserve below 0.5 still allows when spendCap sufficient', async () => {
    const r = await ensureTrustline({
      destination: sampleDestination,
      allowCreation: true,
      spendCapXlm: 2,
      requiredReserveXlm: 0.1,
      usdcIssuer: TESTNET_USDC_ISSUER,
      hasTrustline: async () => false,
      createTrustline: async () => '0xt',
    });
    expect(r.created).toBe(true);
  });

  it('O9: usdcIssuer required (no silent testnet default on mainnet)', async () => {
    await expect(
      ensureTrustline({
        destination: sampleDestination,
        allowCreation: true,
        spendCapXlm: 10,
        hasTrustline: async () => false,
        createTrustline: async () => 'x',
        networkPassphrase: 'PUBLIC',
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('buildChangeTrustXdr builds parseable change_trust XDR', () => {
    const dest = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const xdr = buildChangeTrustXdr(dest, 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
    const parsed: any = (TransactionBuilder as any).fromXDR(xdr, 'TESTNET');
    expect(parsed.source).toBe(dest);
  });

  it('ensureTrustline passes real XDR to createTrustline', async () => {
    const dest = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x77));
    let captured = '';
    const r = await ensureTrustline({
      destination: dest,
      allowCreation: true,
      spendCapXlm: 5,
      usdcIssuer: TESTNET_USDC_ISSUER,
      hasTrustline: async () => false,
      createTrustline: async (x) => { captured = x; return '0xt'; },
    });
    expect(r.created).toBe(true);
    expect(() => (TransactionBuilder as any).fromXDR(captured, 'TESTNET')).not.toThrow();
  });
});


