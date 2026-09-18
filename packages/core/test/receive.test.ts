import { createAnchorCCTP } from '../src/config.js';
import * as forwarderMod from '../src/forwarder/index.js';
import { resolveDustCollector, normalizeBurnTxHash } from '../src/receive.js';
import {
  ReplayTransferError,
  InvalidDomainError,
  InvalidAmountError,
  AnchorCCTPError,
  AttestationVerificationError,
  MintFailedError,
  TrustlineCreationError,
  InvalidBurnHashError,
  InvalidConfigError,
} from '../src/errors/index.js';
import { StrKey } from '@stellar/stellar-sdk';

describe('receive() Orchestration Engine', () => {
  const validDestination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x55));
  const goodMsg = '0x' + 'ab'.repeat(40);
  const goodSig = '0x' + 'cd'.repeat(70);
  const H = (suffix: string) => '0x' + suffix.padStart(64, '0').slice(0, 64);

  function makeSdk(over: any = {}) {
    return createAnchorCCTP({
      signer: async (x) => 'SIGNED_TX_123',
      dustCollectorAddress: validDestination,
      _test: {
        attestation: async () => ({
          status: 'complete',
          attestation: '0x' + 'ab'.repeat(40),
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
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
      burnTxHash: H('01'),
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
      burnTxHash: H('abcdef01'),
      destinationAddress: validDestination,
    });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('abcdef01'),
        destinationAddress: validDestination,
      })
    ).rejects.toMatchObject({ code: 'REPLAY_TRANSFER' });
  });

  it('unknown sourceDomain throws InvalidDomainError before credit', async () => {
    const sdk = makeSdk();
    await expect(
      sdk.receive({
        sourceDomain: 999,
        burnTxHash: H('02'),
        destinationAddress: validDestination,
      })
    ).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });
  });

  it('rejects non-positive amount with InvalidAmountError', async () => {
    const sdk = makeSdk();
    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('bad1'),
        destinationAddress: validDestination,
        amount: 0n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('bad2'),
        destinationAddress: validDestination,
        amount: -100n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('bad3'),
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
        burnTxHash: H('unverified'),
        destinationAddress: validDestination,
      })
    ).rejects.toThrow(AnchorCCTPError);
  });

  it('rejects invalid attestation shape with AttestationVerificationError', async () => {
    const sdk = createAnchorCCTP({
      signer: async () => 'SIGNED_X',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: '0x' + 'ab'.repeat(20),
          signature: '0x' + 'cd'.repeat(30),
        }),
        hasTrustline: async () => true,
      },
    } as any);

    await expect(
      sdk.receive({
        sourceDomain: 6,
        burnTxHash: H('deadbeef01'),
        destinationAddress: validDestination,
      })
    ).rejects.toThrow(AttestationVerificationError);
  });

  it('handles custom logger and real attestation client polling', async () => {
    const logs: string[] = [];
    const okFetch = async () =>
      ({
        ok: true,
        json: async () => ({
          messages: [{ message: '0x' + 'ab'.repeat(40), attestation: '0x' + 'cd'.repeat(70), status: 'complete' }],
        }),
      } as unknown as Response);

    const sdk = createAnchorCCTP({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetchImpl: okFetch as any,
      pollIntervalMs: 1,
      logger: (msg) => logs.push(msg),
      signer: async (xdr) => 'SIGNED_REAL',
      _test: {
        hasTrustline: async () => true,
      },
    } as any);

    const res = await sdk.receive({
      sourceDomain: 6, // Base
      burnTxHash: H('cafe0001'),
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
          message: goodMsg,
          signature: goodSig,
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
      burnTxHash: H('cafe0002'),
      destinationAddress: validDestination,
      signer: async () => 'CUSTOM_SIGNER_TX',
    });

    expect(res.settled).toBe(true);
    expect(res.txHash).toBe('CUSTOM_SIGNER_TX');
    expect(trustlineCreated).toBe(true);
  });

  it('documents that 6->7 conversion yields zero dust (no onDustCollected)', async () => {
    const dustCollected: unknown[] = [];
    const sdk = makeSdk();
    sdk.on('onDustCollected', (p) => dustCollected.push(p));
    const res = await sdk.receive({
      sourceDomain: 0,
      burnTxHash: H('cafe0003'),
      destinationAddress: validDestination,
      amount: 1000000n,
    });
    expect(res.settled).toBe(true);
    expect(res.dust).toBe(0n);
    expect(dustCollected).toHaveLength(0);
  });

  it('uses _test.pollAttestation hook when provided and fires onReceiving events', async () => {
    let mockPollCalled = false;
    const receivingEvents: any[] = [];

    const sdk = createAnchorCCTP({
      signer: async () => 'SIGNED_POLL_HOOK',
      _test: {
        pollAttestation: async (burnTxHash: string, onPoll: (attempt: number, elapsedMs: number) => void) => {
          mockPollCalled = true;
          onPoll(1, 100);
          onPoll(2, 250);
          return {
            status: 'complete',
            attestation: '0x' + 'ab'.repeat(40),
            message: '0x' + 'ab'.repeat(40),
            signature: '0x' + 'cd'.repeat(70),
            attempts: 2,
            elapsedTimeMs: 250,
          };
        },
        hasTrustline: async () => true,
      },
    } as any);

    sdk.on('onReceiving', (evt) => receivingEvents.push(evt));

    const res = await sdk.receive({
      sourceDomain: 0,
      burnTxHash: H('cafe0004'),
      destinationAddress: validDestination,
    });

    expect(mockPollCalled).toBe(true);
    expect(receivingEvents.length).toBe(2);
    expect(receivingEvents[0].attempt).toBe(1);
    expect(receivingEvents[1].attempt).toBe(2);
    expect(res.settled).toBe(true);
  });

  it('C1: receive without signer or defaultSigner throws MintFailedError', async () => {
    const sdk = createAnchorCCTP({
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0005'),
        destinationAddress: validDestination,
        amount: 1000000n,
      })
    ).rejects.toBeInstanceOf(MintFailedError);
  });

  it('receive forwards sourceSequence to the mint XDR', async () => {
    const spy = jest.spyOn(forwarderMod, 'submitMint');
    const sdk = createAnchorCCTP({
      signer: async (x) => 'SIGNED_SEQ_TX',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    });

    await sdk.receive({
      sourceDomain: 6,
      burnTxHash: '0x' + 'a1'.repeat(32),
      destinationAddress: validDestination,
      amount: 1000000n,
      sourceSequence: '424242',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const callParams = spy.mock.calls[0][0];
    expect(callParams.sourceSequence).toBe('424242');
    spy.mockRestore();
  });

  it('C2: receive without hasTrustline provider throws TrustlineCreationError', async () => {
    const sdk = createAnchorCCTP({
      signer: async (x) => 'SIGNED_TX',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
      },
    } as any);

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0006'),
        destinationAddress: validDestination,
        amount: 1000000n,
      })
    ).rejects.toMatchObject({ code: 'TRUSTLINE_CREATION_FAILED' });
  });

  it('O5/M1: normalizes replay key case (0xABC same as 0xabc)', async () => {
    const sdk = createAnchorCCTP({
      signer: async (x) => 'SIGNED_NORM',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);

    await sdk.receive({
      sourceDomain: 0,
      burnTxHash: '0x' + 'AA'.repeat(32),
      destinationAddress: validDestination,
      amount: 1000000n,
    });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: '0x' + 'aa'.repeat(32),
        destinationAddress: validDestination,
        amount: 1000000n,
      })
    ).rejects.toMatchObject({ code: 'REPLAY_TRANSFER' });
  });

  it('O5/M1: rejects malformed burnTxHash (non-hex, wrong length)', () => {
    expect(() => normalizeBurnTxHash('not-a-hash')).toThrow(InvalidBurnHashError);
    expect(() => normalizeBurnTxHash('0x' + 'ab'.repeat(16))).toThrow(InvalidBurnHashError);
    expect(() => normalizeBurnTxHash('')).toThrow(InvalidBurnHashError);
  });

  it('O15: sourceSequence must be numeric string', async () => {
    const sdk = createAnchorCCTP({
      signer: async (x) => 'SIGNED_SEQ',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0008'),
        destinationAddress: validDestination,
        amount: 1000000n,
        sourceSequence: 'abc',
      })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('C4: onSettled never fires when submitMint fails + replay not marked', async () => {
    const { ReplayStore } = require('../src/replay/index.js');
    const replayStore = new ReplayStore();
    const settled: unknown[] = [];
    const sdk = createAnchorCCTP({
      signer: async () => { throw new Error('sign boom'); },
      replayStore,
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: goodMsg,
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);
    sdk.on('onSettled', (p: unknown) => settled.push(p));

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('c4fail01'),
        destinationAddress: validDestination,
        amount: 1000000n,
      })
    ).rejects.toThrow();

    expect(settled).toHaveLength(0);
    // replay store should NOT mark it processed
    const replayed = await replayStore.isProcessed(H('c4fail01'));
    expect(replayed).toBe(false);
  });
});

describe('resolveDustCollector', () => {
  const dest = 'GDEST';
  it('prefers param over config over destination', () => {
    expect(resolveDustCollector({ dest, param: 'GPARAM', cfg: 'GCFG' })).toBe('GPARAM');
    expect(resolveDustCollector({ dest, cfg: 'GCFG' })).toBe('GCFG');
    expect(resolveDustCollector({ dest })).toBe(dest);
  });
});

