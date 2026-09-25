import { fetchTransferFee } from '../src/attestation/fees.js';
import { FeeUnavailableError, InvalidDomainError } from '../src/errors/index.js';

/**
 * Live sandbox shape for GET /v2/burn/USDC/fees/6/27 (verified 2026-09-25).
 * `minimumFee` is fractional basis points — a ratio, never an amount.
 */
const TIERS = [
  { finalityThreshold: 1000, minimumFee: 1.3 },
  { finalityThreshold: 2000, minimumFee: 0 },
];

const stub = (async () => ({
  ok: true,
  status: 200,
  json: async () => TIERS,
})) as unknown as typeof fetch;

function stubOf(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;
}

function captureStub(sink: { url?: string }, body: unknown): typeof fetch {
  return (async (url: unknown) => {
    sink.url = String(url);
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch;
}

describe('fetchTransferFee', () => {
  it('selects fast tier and returns bps for mode fast', async () => {
    expect(await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stub, mode: 'fast' }))
      .toEqual({ minimumFeeBps: 1.3, finalityThreshold: 1000 });
  });

  it('selects the higher (Standard) tier for mode standard', async () => {
    expect(await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stub, mode: 'standard' }))
      .toEqual({ minimumFeeBps: 0, finalityThreshold: 2000 });
  });

  it('reads the per-route Iris fee endpoint with both domains, no hardcoded table', async () => {
    const sink: { url?: string } = {};
    await fetchTransferFee(6, 27, { baseUrl: 'https://iris-api-sandbox.circle.com/', fetch: captureStub(sink, TIERS), mode: 'fast' });
    expect(sink.url).toBe('https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/6/27');
  });

  it('resolves the Iris base from CIRCLE_ATTESTATION_BASE_URL before the mainnet default, with global fetch', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env.CIRCLE_ATTESTATION_BASE_URL;
    try {
      // Env-first (mirrors AttestationClient): a missing env var must not silently
      // point testnet quotes at mainnet Iris.
      process.env.CIRCLE_ATTESTATION_BASE_URL = 'https://iris-api-sandbox.circle.com/';
      const envSink: { url?: string } = {};
      globalThis.fetch = captureStub(envSink, TIERS);
      const fee = await fetchTransferFee(6, 27, { mode: 'standard' });
      expect(fee).toEqual({ minimumFeeBps: 0, finalityThreshold: 2000 });
      expect(envSink.url).toBe('https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/6/27');

      // Only when the env var is absent does the public default apply.
      delete process.env.CIRCLE_ATTESTATION_BASE_URL;
      const defaultSink: { url?: string } = {};
      globalThis.fetch = captureStub(defaultSink, TIERS);
      await fetchTransferFee(6, 27, { mode: 'fast' });
      expect(defaultSink.url).toBe('https://iris-api.circle.com/v2/burn/USDC/fees/6/27');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEnv !== undefined) {
        process.env.CIRCLE_ATTESTATION_BASE_URL = originalEnv;
      } else {
        delete process.env.CIRCLE_ATTESTATION_BASE_URL;
      }
    }
  });

  it('coerces string-encoded threshold and fee from the JSON body', async () => {
    const body = [
      { finalityThreshold: '1000', minimumFee: '1.3' },
      { finalityThreshold: '2000', minimumFee: '0' },
    ];
    expect(await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(body), mode: 'fast' }))
      .toEqual({ minimumFeeBps: 1.3, finalityThreshold: 1000 });
  });

  it('picks the lowest eligible tier on the fast side when several qualify', async () => {
    const body = [
      { finalityThreshold: 1000, minimumFee: 1.3 },
      { finalityThreshold: 500, minimumFee: 0.25 },
    ];
    expect(await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(body), mode: 'fast' }))
      .toEqual({ minimumFeeBps: 0.25, finalityThreshold: 500 });
  });

  it('picks the highest eligible tier on the standard side when several qualify', async () => {
    const body = [
      { finalityThreshold: 2000, minimumFee: 0 },
      { finalityThreshold: 2500, minimumFee: 0.1 },
    ];
    expect(await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(body), mode: 'standard' }))
      .toEqual({ minimumFeeBps: 0.1, finalityThreshold: 2500 });
  });

  it('throws FeeUnavailableError on a 5xx response', async () => {
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf({}, false, 503), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect(err).toMatchObject({ code: 'FEE_UNAVAILABLE', sourceDomain: 6, destDomain: 27 });
  });

  it('throws FeeUnavailableError when the route is missing (404)', async () => {
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf({ error: 'not found' }, false, 404), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/404/);
  });

  it('rejects unsupported domains before building the URL (§4)', async () => {
    const fetchSpy = jest.fn();
    const badSource = await fetchTransferFee(999, 27, { baseUrl: 'https://x', fetch: fetchSpy as unknown as typeof fetch, mode: 'fast' })
      .catch((e: unknown) => e);
    expect(badSource).toBeInstanceOf(InvalidDomainError);
    expect(badSource).toMatchObject({ code: 'INVALID_DOMAIN', domainId: 999 });

    const badDest = await fetchTransferFee(6, 999, { baseUrl: 'https://x', fetch: fetchSpy as unknown as typeof fetch, mode: 'fast' })
      .catch((e: unknown) => e);
    expect(badDest).toBeInstanceOf(InvalidDomainError);
    expect(badDest).toMatchObject({ code: 'INVALID_DOMAIN', domainId: 999 });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('wraps a network failure (rejecting fetch) in FeeUnavailableError', async () => {
    const dnsFailure = (async () => {
      throw new Error('getaddrinfo ENOTFOUND iris-api.circle.com');
    }) as unknown as typeof fetch;
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: dnsFailure, mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/ENOTFOUND/);

    const nonErrorRejection = (async () => {
      throw 'boom';
    }) as unknown as typeof fetch;
    const err2 = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: nonErrorRejection, mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(FeeUnavailableError);
    expect((err2 as FeeUnavailableError).message).toMatch(/boom/);
  });

  it('wraps an unparseable 200 body in FeeUnavailableError', async () => {
    const badJson = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    })) as unknown as typeof fetch;
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: badJson, mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/JSON/);
  });

  it('throws FeeUnavailableError when the requested fast tier is absent', async () => {
    const standardOnly = [{ finalityThreshold: 2000, minimumFee: 0 }];
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(standardOnly), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/fast/i);
  });

  it('throws FeeUnavailableError when the requested standard tier is absent', async () => {
    const fastOnly = [{ finalityThreshold: 1000, minimumFee: 1.3 }];
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(fastOnly), mode: 'standard' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/standard/i);
  });

  it('throws FeeUnavailableError when the body carries no usable tier rows', async () => {
    const err = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf({ error: 'unexpected shape' }), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);

    const partialRows = [{ finalityThreshold: 1000 }, { minimumFee: '1.3' }];
    const err2 = await fetchTransferFee(6, 27, { baseUrl: 'https://x', fetch: stubOf(partialRows), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(FeeUnavailableError);
  });
});
