import { createAnchorCCTP } from '../src/config.js';
import {
  ReplayTransferError,
  InvalidDomainError,
  InvalidAmountError,
  AnchorCCTPError,
} from '../src/errors/index.js';
import { createLogger } from '../src/logger/index.js';
import type { SorobanTransport } from '../src/forwarder/index.js';
import { StrKey } from '@stellar/stellar-sdk';

/**
 * Fake Soroban transport (B3/B4): confirms immediately and reports the signed
 * XDR as the network hash, so this invariant test exercises the real receive()
 * path without touching a network.
 */
const fakeTransport = (): SorobanTransport => ({
  simulateTransaction: async () => ({}),
  assembleTransaction: (xdr: string) => xdr,
  sendTransaction: async (signedXdr: string) => ({ status: 'PENDING', hash: signedXdr }),
  getTransaction: async () => ({ status: 'SUCCESS' }),
});

/** Build a well-formed CCTP message hex with the given amount encoded as uint64 LE at offset 4. */
function wellFormedMsg(amount: bigint): string {
  const buf = Buffer.alloc(46, 0);
  buf.writeBigUInt64LE(amount, 4);
  return '0x' + buf.toString('hex');
}

describe('Security Checklist Invariant Tests (PRD §7 & §8)', () => {
  const sampleStellarAddress = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x77));
  const sampleSponsor = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x66));
  const goodSig = '0x' + 'cd'.repeat(65);
  const H = (suffix: string) => '0x' + suffix.padStart(64, '0').slice(0, 64);

  it('INVARIANT 1: Replay of same burnTxHash is rejected without double-crediting', async () => {
    const settledEvents: any[] = [];
    const sdk = createAnchorCCTP({
      signer: async () => 'SIGNED_REPLAY_TX',
      dustCollectorAddress: sampleStellarAddress,
      sponsorAccount: sampleSponsor,
      sorobanTransport: fakeTransport(),
      forwarderContractId: 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
      _test: {
        attestation: async () => ({
          status: 'complete',
          message: wellFormedMsg(1000000n),
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);
    sdk.on('onSettled', (e) => settledEvents.push(e));

    // First receive succeeds
    const first = await sdk.receive({
      sourceDomain: 0,
      burnTxHash: H('cafe0010'),
      destinationAddress: sampleStellarAddress,
      amount: 1000000n,
    });
    expect(first.settled).toBe(true);
    expect(settledEvents.length).toBe(1);

    // Second receive MUST throw ReplayTransferError and NOT emit onSettled again
    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0010'),
        destinationAddress: sampleStellarAddress,
        amount: 1000000n,
      })
    ).rejects.toMatchObject({ code: 'REPLAY_TRANSFER' });

    expect(settledEvents.length).toBe(1); // No double credit
  });

  it('INVARIANT 2: Negative, zero, or invalid amounts are rejected with InvalidAmountError', async () => {
    const sdk = createAnchorCCTP({
      signer: async () => 'TX',
      _test: {
        attestation: async () => ({ status: 'complete', message: wellFormedMsg(1000000n), signature: goodSig }),
      },
    } as any);

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0011'),
        destinationAddress: sampleStellarAddress,
        amount: 0n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0012'),
        destinationAddress: sampleStellarAddress,
        amount: -500n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('INVARIANT 3: Unknown sourceDomain is rejected with InvalidDomainError before network call', async () => {
    const fetchMock = jest.fn();
    const sdk = createAnchorCCTP({
      fetchImpl: fetchMock as any,
    });

    await expect(
      sdk.receive({
        sourceDomain: 99999,
        burnTxHash: H('cafe0013'),
        destinationAddress: sampleStellarAddress,
        amount: 1000000n,
      })
    ).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('INVARIANT 4: Unattested (pending / unverified) transfer never credits destination', async () => {
    const settledEvents: any[] = [];
    const sdk = createAnchorCCTP({
      _test: {
        attestation: async () => ({
          status: 'pending',
          message: wellFormedMsg(1000000n),
          signature: goodSig,
        }),
        hasTrustline: async () => true,
      },
    } as any);
    sdk.on('onSettled', (e) => settledEvents.push(e));

    await expect(
      sdk.receive({
        sourceDomain: 0,
        burnTxHash: H('cafe0014'),
        destinationAddress: sampleStellarAddress,
      })
    ).rejects.toThrow(AnchorCCTPError);

    expect(settledEvents.length).toBe(0);
  });

  it('INVARIANT 5: Zero private keys or secret values are emitted in logs', () => {
    const loggedLines: string[] = [];
    const logger = createLogger('security-audit', (s) => loggedLines.push(s));

    logger.info('Transaction processed', {
      userAddress: sampleStellarAddress,
      privateKey: 'S_SECRET_STELLAR_KEY_123',
      secretSeed: '12-word-secret-seed-here',
      signerKey: 'ED25519_SECRET_KEY',
      mnemonic: 'word1 word2 word3',
    });

    expect(loggedLines.length).toBe(1);
    const logStr = loggedLines[0];
    expect(logStr).not.toContain('S_SECRET_STELLAR_KEY_123');
    expect(logStr).not.toContain('12-word-secret-seed-here');
    expect(logStr).not.toContain('ED25519_SECRET_KEY');
    expect(logStr).not.toContain('word1 word2 word3');

    const parsed = JSON.parse(logStr);
    expect(parsed.privateKey).toBe('[REDACTED]');
    expect(parsed.secretSeed).toBe('[REDACTED]');
    expect(parsed.signerKey).toBe('[REDACTED]');
    expect(parsed.mnemonic).toBe('[REDACTED]');
    expect(parsed.userAddress).toBe(sampleStellarAddress);
  });
});
