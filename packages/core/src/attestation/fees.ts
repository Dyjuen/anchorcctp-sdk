import { FeeUnavailableError } from '../errors/index.js';

/** Circle CCTP transfer mode. Fast = `finalityThreshold <= 1000`, Standard = the higher tier. */
export type TransferMode = 'fast' | 'standard';

export interface FetchTransferFeeOptions {
  /** Iris base URL. Defaults to the public API; callers should pass the sandbox on testnet. */
  baseUrl?: string;
  /** Injectable fetch for tests and environments without a global `fetch`. */
  fetch?: typeof fetch;
  /** Which finality tier to quote. */
  mode: TransferMode;
}

export interface TransferFee {
  /**
   * Circle's `minimumFee` for the tier, in basis points — a **ratio**, never an
   * amount. Amounts stay bigint (see `resolveMaxFee` in the burn planner) so no
   * `number` ever carries base units.
   */
  minimumFeeBps: number;
  /** The tier's `finalityThreshold` (1000 = Fast, 2000 = Standard). */
  finalityThreshold: number;
}

const DEFAULT_BASE_URL = 'https://iris-api.circle.com';
const FAST_FINALITY_THRESHOLD = 1000;

interface RawTier {
  finalityThreshold?: number | string;
  minimumFee?: number | string;
}

/**
 * Reads the per-tier fee for a CCTP route from Circle's Iris fee API
 * (`GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}`) and returns the tier
 * matching `mode`.
 *
 * Pure fetch, injectable — no caching here (the server owns the TTL). Never
 * hardcodes a fee table; throws `FeeUnavailableError` on a non-2xx response or
 * when the requested tier is absent.
 */
export async function fetchTransferFee(
  sourceDomain: number,
  destDomain: number,
  options: FetchTransferFeeOptions
): Promise<TransferFee> {
  const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${base}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`;
  const doFetch = options.fetch ?? fetch;

  const res = await doFetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new FeeUnavailableError(
      sourceDomain,
      destDomain,
      `Iris fee API returned HTTP ${res.status} for ${url}`
    );
  }

  const body = (await res.json()) as unknown;
  const rows = Array.isArray(body) ? (body as RawTier[]) : [];
  const tiers = rows
    .map((row) => ({
      finalityThreshold: Number(row?.finalityThreshold),
      minimumFeeBps: Number(row?.minimumFee),
    }))
    .filter((tier) => Number.isFinite(tier.finalityThreshold) && Number.isFinite(tier.minimumFeeBps));

  const eligible = tiers.filter((tier) =>
    options.mode === 'fast'
      ? tier.finalityThreshold <= FAST_FINALITY_THRESHOLD
      : tier.finalityThreshold > FAST_FINALITY_THRESHOLD
  );

  if (eligible.length === 0) {
    throw new FeeUnavailableError(
      sourceDomain,
      destDomain,
      `no ${options.mode} tier in Iris fee response for ${url}`
    );
  }

  // One entry per tier in practice; sort makes the pick deterministic if Iris
  // ever returns duplicates — Fast takes the lowest eligible, Standard the highest.
  const sorted = eligible.slice().sort((a, b) => a.finalityThreshold - b.finalityThreshold);
  const tier = options.mode === 'fast' ? sorted[0] : sorted[sorted.length - 1];

  return { minimumFeeBps: tier.minimumFeeBps, finalityThreshold: tier.finalityThreshold };
}
