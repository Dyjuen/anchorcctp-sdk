import { AttestationClient } from '../src/attestation/index.js';
import { AttestationTimeoutError } from '../src/errors/index.js';

describe('Circle Attestation Client', () => {
  const okFetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: 'complete',
        attestation: '0xatt',
        message: '0xmsg',
        signature: '0xsig',
      }),
    } as unknown as Response);

  it('pollAttestation returns complete result', async () => {
    const c = new AttestationClient({ fetchImpl: okFetch as any, logger: () => {} });
    const r = await c.pollAttestation('0x1');
    expect(r.status).toBe('complete');
    expect(r.attestation).toBe('0xatt');
    expect(r.message).toBe('0xmsg');
    expect(r.signature).toBe('0xsig');
  });

  it('verifyAttestation validates well-formed payload and rejects empty/malformed', () => {
    const c = new AttestationClient({ fetchImpl: okFetch as any, logger: () => {} });
    expect(c.verifyAttestation('0xmsg', '0xsig')).toBe(true);
    expect(c.verifyAttestation('', '0xsig')).toBe(false);
    expect(c.verifyAttestation('0xmsg', '')).toBe(false);
    expect(c.verifyAttestation(null as any, '0xsig')).toBe(false);
  });

  it('poll throws AttestationTimeoutError after maxRetries', async () => {
    const pending = async () =>
      ({
        ok: true,
        json: async () => ({ status: 'pending' }),
      } as unknown as Response);
    const c = new AttestationClient({
      fetchImpl: pending as any,
      maxRetries: 2,
      pollIntervalMs: 1,
      logger: () => {},
    });
    await expect(c.pollAttestation('0x1')).rejects.toMatchObject({
      code: 'ATTESTATION_TIMEOUT',
      burnTxHash: '0x1',
    });
  });

  it('polls with retries and notifies onPoll listener', async () => {
    let callCount = 0;
    const multiFetch = async () => {
      callCount++;
      if (callCount < 2) {
        return { ok: true, json: async () => ({ status: 'pending' }) } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          status: 'complete',
          attestation: '0xatt2',
          message: '0xmsg2',
          signature: '0xsig2',
        }),
      } as unknown as Response;
    };

    const pollEvents: { attempt: number; elapsedMs: number }[] = [];
    const c = new AttestationClient({
      fetchImpl: multiFetch as any,
      maxRetries: 5,
      pollIntervalMs: 2,
      logger: () => {},
    });

    const res = await c.pollAttestation('0x2', (att, el) => {
      pollEvents.push({ attempt: att, elapsedMs: el });
    });

    expect(res.status).toBe('complete');
    expect(res.attestation).toBe('0xatt2');
    expect(callCount).toBe(2);
    expect(pollEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('handles fetch HTTP error and continues polling until success or timeout', async () => {
    let attempts = 0;
    const failThenOkFetch = async () => {
      attempts++;
      if (attempts === 1) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          status: 'complete',
          attestation: '0xatt3',
          message: '0xmsg3',
          signature: '0xsig3',
        }),
      } as unknown as Response;
    };

    const c = new AttestationClient({
      fetchImpl: failThenOkFetch as any,
      maxRetries: 3,
      pollIntervalMs: 1,
    });

    const res = await c.pollAttestation('0x3');
    expect(res.status).toBe('complete');
    expect(res.attestation).toBe('0xatt3');
  });

  it('supports custom Logger instance and default options', async () => {
    const customLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const c = new AttestationClient({
      fetchImpl: okFetch as any,
      logger: customLogger,
      baseUrl: 'https://iris-api-sandbox.circle.com/',
    });

    const res = await c.pollAttestation('0x4');
    expect(res.status).toBe('complete');
    expect(customLogger.info).toHaveBeenCalled();
  });

  it('supports function sink logger and default parameters', async () => {

    const logs: string[] = [];
    const c = new AttestationClient({
      fetchImpl: okFetch as any,
      logger: (msg) => logs.push(msg),
    });

    const res = await c.pollAttestation('0x5');
    expect(res.status).toBe('complete');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('supports signature fallback when attestation property is omitted', async () => {
    const sigOnlyFetch = async () =>
      ({
        ok: true,
        json: async () => ({
          status: 'complete',
          signature: '0xonlysig',
          message: '0xonlymsg',
        }),
      } as unknown as Response);

    const c = new AttestationClient({
      fetchImpl: sigOnlyFetch as any,
      logger: () => {},
    });

    const res = await c.pollAttestation('0x6');
    expect(res.status).toBe('complete');
    expect(res.attestation).toBe('0xonlysig');
    expect(res.signature).toBe('0xonlysig');
  });

  it('reads CIRCLE_ATTESTATION_BASE_URL from environment when baseUrl not passed', () => {
    const oldEnv = process.env.CIRCLE_ATTESTATION_BASE_URL;
    process.env.CIRCLE_ATTESTATION_BASE_URL = 'https://custom-iris.example.com';
    const c = new AttestationClient();
    expect((c as any).baseUrl).toBe('https://custom-iris.example.com');
    if (oldEnv !== undefined) {
      process.env.CIRCLE_ATTESTATION_BASE_URL = oldEnv;
    } else {
      delete process.env.CIRCLE_ATTESTATION_BASE_URL;
    }
  });
});


