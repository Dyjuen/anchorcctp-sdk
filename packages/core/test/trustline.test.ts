import { ensureTrustline } from '../src/trustline/index.js';
import { TrustlineMissingError, TrustlineCreationError } from '../src/errors/index.js';

describe('Trustline Inspection & Management', () => {
  const sampleDestination = 'G'.repeat(56);

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
        spendCapXlm: 0.2, // Below the default 0.5 XLM requirement
        requiredReserveXlm: 0.5,
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
        hasTrustline: async () => false,
        createTrustline: async () => {
          throw new Error('tx simulation failed');
        },
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('creates trustline with default asset and default reserve when omitted', async () => {
    let payload = '';
    const r = await ensureTrustline({
      destination: sampleDestination,
      allowCreation: true,
      hasTrustline: async () => false,
      createTrustline: async (xdr) => {
        payload = Buffer.from(xdr, 'base64').toString('utf-8');
        return '0xt_default';
      },
    });
    expect(r.created).toBe(true);
    expect(payload).toContain('USDC');
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
});


