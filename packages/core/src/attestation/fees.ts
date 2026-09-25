import { assertSupportedDomain } from '../domains/index.js';
import { FeeUnavailableError } from '../errors/index.js';

/** Circle CCTP transfer mode. Fast = `finalityThreshold <= 1000`, Standard = the higher tier. */
export type TransferMode = 'fast' | 'standard';

export interface FetchTransferFeeOptions {
  /**
   * Iris base URL. Resolution order mirrors `AttestationClient`: explicit option
   * first, then `CIRCLE_ATTESTATION_BASE_URL`, then the public mainnet API.
   * Testnet callers must pass the sandbox base or set the env var — never let a
   * missing env var silently point the quote at mainnet.
   */
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

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Reads the per-tier fee for a CCTP route from Circle's Iris fee API
 * (`GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}`) and returns the tier
 * matching `mode`.
 *
 * Pure fetch, injectable — no caching here (the server owns the TTL). Never
 * hardcodes a fee table. Both domains are validated through `assertSupportedDomain`
 * before the URL is built, so the Iris URL base is never steered by raw input.
 * Fails closed: a network drop, a timeout, a non-2xx response, an unparseable
 * body, or a missing tier all surface as `FeeUnavailableError`.
 */
export async function fetchTransferFee(
  sourceDomain: number,
  destDomain: number,
  options: FetchTransferFeeOptions
): Promise<TransferFee> {
  assertSupportedDomain(sourceDomain);
  assertSupportedDomain(destDomain);

  const base = (
    options.baseUrl ||
    (typeof process !== 'undefined' && process.env?.CIRCLE_ATTESTATION_BASE_URL) ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
  const url = `${base}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`;
  const doFetch = options.fetch ?? fetch;

  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    throw new FeeUnavailableError(
      sourceDomain,
      destDomain,
      `Iris fee API request failed for ${url} (${describeCause(cause)})`
    );
  }

  if (!res.ok) {
    throw new FeeUnavailableError(
      sourceDomain,
      destDomain,
      `Iris fee API returned HTTP ${res.status} for ${url}`
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (cause) {
    throw new FeeUnavailableError(
      sourceDomain,
      destDomain,
      `Iris fee response was not valid JSON for ${url} (${describeCause(cause)})`
    );
  }

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
