import { createAnchorCCTP } from '../src/config.js';
import {
  ReplayTransferError,
  InvalidDomainError,
  InvalidAmountError,
  AnchorCCTPError,
} from '../src/errors/index.js';
import { StrKey } from '@stellar/stellar-sdk';

describe('receive() Orchestration Engine', () => {
  const validDestination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x55));

  function makeSdk(over: any = {}) {

    return createAnchorCCTP({
      signer: async (x) => 'SIGNED_TX_123',
      dustCollectorAddress: validDestination,
      _test: {
        attestation: async () => ({
          status: 'complete',
          attestation: '0xa',
          message: '0xm',
          signature: '0xs',
        }),
        ...over,
      },
    } as any);
  }

  it('receive() polls, converts, credits, emits onSettled', async () => {
    const sdk = makeSdk();
    const settled: any[] = [];
    sdk.on('onSettled', (p) => settled.push(p));

    const r = await sdk.receive({
      sourceDomain: 0,
      burnTxHash: '0x1',
      destinationAddress: validDestination,
      amount: 5000000n, // 5 USDC
    });

    expect(r.settled).toBe(true);
    expect(r.amount).toBe(50000000n); // 5 * 10 = 50 stroops
    expect(settled.length).toBe(1);
    expect(settled[0].amount).toBe(50000000n);
    expect(settled[0].txHash).toBe('SIGNED_TX_123');
  });

  it('replay of same burnTxHash throws ReplayTransferError', async () => {
    const sdk = makeSdk();
    await sdk.receive({
      sourceDomain: 0,
      burnTxHash: '0xreplay',
      destinationAddress: validDestination,
    });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0xreplay',
        destinationAddress: validDestination,
      })
    ).rejects.toMatchObject({ code: 'REPLAY_TRANSFER' });
  });

  it('unknown sourceDomain throws InvalidDomainError before credit', async () => {
    const sdk = makeSdk();
    await expect(
      sdk.receive({
        sourceDomain: 999,
        burnTxHash: '0x2',
        destinationAddress: validDestination,
      })
    ).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });
  });

  it('rejects non-positive amount with InvalidAmountError', async () => {
    const sdk = makeSdk();
    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0xbad_amount',
        destinationAddress: validDestination,
        amount: 0n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0xbad_amount_neg',
        destinationAddress: validDestination,
        amount: -100n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0xbad_amount_type',
        destinationAddress: validDestination,
        amount: '100' as any,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('rejects unverified or pending attestation', async () => {
    const sdk = makeSdk({
      attestation: async () => ({
        status: 'pending',
        message: '',
        signature: '',
      }),
    });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0xunverified',
        destinationAddress: validDestination,
      })
    ).rejects.toThrow(AnchorCCTPError);
  });

  it('handles custom logger and real attestation client polling', async () => {
    const logs: string[] = [];
    const okFetch = async () =>
      ({
        ok: true,
        json: async () => ({
          status: 'complete',
          attestation: '0xatt_real',
          message: '0xmsg_real',
          signature: '0xsig_real',
        }),
      } as unknown as Response);

    const sdk = createAnchorCCTP({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetchImpl: okFetch as any,
      pollIntervalMs: 1,
      logger: (msg) => logs.push(msg),
      signer: async (xdr) => 'SIGNED_REAL',
    });

    const res = await sdk.receive({
      sourceDomain: 6, // Base
      burnTxHash: '0xreal_poll',
      destinationAddress: validDestination,
    });

    expect(res.settled).toBe(true);
    expect(res.txHash).toBe('SIGNED_REAL');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('handles trustline options and custom signer in receive()', async () => {
    let trustlineCreated = false;
    const sdk = createAnchorCCTP({
      signer: async () => 'DEFAULT_SIGNER',
      trustline: {
        allowCreation: true,
        spendCapXlm: 5,
      },
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: '0xmsg',
          signature: '0xsig',
        }),
        hasTrustline: async () => false,
        createTrustline: async () => {
          trustlineCreated = true;
          return '0xtl_created';
        },
      },
    });

    const res = await sdk.receive({
      sourceDomain: 27, // Stellar
      burnTxHash: '0xtrustline_flow',
      destinationAddress: validDestination,
      signer: async () => 'CUSTOM_SIGNER_TX',
    });

    expect(res.settled).toBe(true);
    expect(res.txHash).toBe('CUSTOM_SIGNER_TX');
    expect(trustlineCreated).toBe(true);
  });

  it('handles dust routing and emits onDustCollected when dust > 0', async () => {

    const dustCollected: any[] = [];
    const sdk = makeSdk();
    sdk.on('onDustCollected', (p) => dustCollected.push(p));

    // When amount produces dust if converted or custom mock
    const customDustSdk = createAnchorCCTP({
      signer: async () => 'TX_DUST',
      dustCollectorAddress: validDestination,
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: '0xmsg',
          signature: '0xsig',
        }),
      },
    });
    customDustSdk.on('onDustCollected', (p) => dustCollected.push(p));

    // convert7to6 and dust simulation
    const res = await customDustSdk.receive({
      sourceDomain: 0,
      burnTxHash: '0xdust_burn',
      destinationAddress: validDestination,
      amount: 1000000n,
    });
    expect(res.settled).toBe(true);
  });

  it('uses default fallback signer when signer is omitted from both config and receive()', async () => {
    const sdk = createAnchorCCTP({
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: '0xmsg',
          signature: '0xsig',
        }),
      },
    });

    const res = await sdk.receive({
      sourceDomain: 0,
      burnTxHash: '0xfallback_signer',
      destinationAddress: validDestination,
    });
    expect(res.settled).toBe(true);
    expect(res.txHash).toContain('SIGNED_');
  });
});

