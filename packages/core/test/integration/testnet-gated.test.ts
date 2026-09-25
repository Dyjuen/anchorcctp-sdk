import { AttestationClient } from '../../src/attestation/index.js';
import { buildChangeTrustXdr } from '../../src/trustline/index.js';
import { buildMintAndForwardXdr } from '../../src/forwarder/index.js';
import { StrKey } from '@stellar/stellar-sdk';

const BURN = process.env.CIRCLE_TESTNET_BURN_TX || '';
const describeGated = BURN ? describe : describe.skip;

describeGated('Week2 testnet-gated', () => {
  it('polls real Iris sandbox to complete', async () => {
    const c = new AttestationClient({
      baseUrl: 'https://iris-api-sandbox.circle.com',
      pollIntervalMs: 2000,
      maxRetries: 3,
    });
    const r = await c.pollAttestation(`6/${BURN}`);
    expect(r.status).toBe('complete');
    expect(c.verifyAttestation(r.message, r.signature)).toBe(true);
  }, 30000);

  it('builders produce parseable XDR for testnet forwarder', () => {
    const dest = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
    expect(
      typeof buildMintAndForwardXdr({
        message: '0x' + 'ab'.repeat(40),
        signature: '0x' + 'cd'.repeat(70),
        sourceAccount: dest,
      }),
    ).toBe('string');
    expect(typeof buildChangeTrustXdr(dest)).toBe('string');
  });
});
