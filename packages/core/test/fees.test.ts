import { fetchTransferFee } from '../src/attestation/fees.js';
import { FeeUnavailableError } from '../src/errors/index.js';

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

  it('falls back to the public Iris base URL and global fetch when neither is injected', async () => {
    const sink: { url?: string } = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = captureStub(sink, TIERS);
    try {
      const fee = await fetchTransferFee(6, 27, { mode: 'standard' });
      expect(fee).toEqual({ minimumFeeBps: 0, finalityThreshold: 2000 });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(sink.url).toBe('https://iris-api.circle.com/v2/burn/USDC/fees/6/27');
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
    const err = await fetchTransferFee(6, 999, { baseUrl: 'https://x', fetch: stubOf({ error: 'not found' }, false, 404), mode: 'fast' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FeeUnavailableError);
    expect((err as FeeUnavailableError).message).toMatch(/404/);
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
