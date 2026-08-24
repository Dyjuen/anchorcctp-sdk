import { AttestationClient } from '../../src/attestation/index.js';
import completeFixture from '../fixtures/attestation-complete.json';

describe('Attestation Client Integration Fixture Tests', () => {
  it('loads testnet fixture and successfully completes polling and validation', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => completeFixture,
      } as unknown as Response);

    const client = new AttestationClient({
      fetchImpl: fetchImpl as any,
      baseUrl: 'https://iris-api-sandbox.circle.com',
      pollIntervalMs: 1,
      logger: () => {},
    });

    const result = await client.pollAttestation(
      '0x35687770176d655848c41804f9814467d0ea378877ca6b6b7a2d80d196fc9df9'
    );

    expect(result.status).toBe('complete');
    expect(result.attestation).toBe(completeFixture.attestation);
    expect(result.message).toBe(completeFixture.message);

    const isVerified = client.verifyAttestation(result.message, result.signature);
    expect(isVerified).toBe(true);
  });
});
