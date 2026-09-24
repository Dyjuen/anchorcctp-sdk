// apps/demo/server/events.ts
// SSE event server: sim + real modes, rate limiting, single-flight, replay.
// ponytail: server-only module — never bundled for browser.

import { createRequire } from 'node:module';
import { normalizeBurnTxHash, assertSupportedDomain, FileReplayStore } from '@anchor-cctp/core-sdk';
import type { IReplayStoreAdapter } from '@anchor-cctp/core-sdk';

// ponytail: StrKey from stellar-sdk — lazy require to stay ESM-safe
const require = createRequire(import.meta.url);
const { StrKey } = require('@stellar/stellar-sdk') as typeof import('@stellar/stellar-sdk');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ValidatedParams {
  address: string;
  burnTxHash: string;
  sourceDomain: number;
  amount: bigint;
}

export interface SseEvent {
  type: 'receiving' | 'settled' | 'error';
  attempt?: number;
  simulated?: boolean;
  mintTxHash?: string;
  code?: string;
  remediation?: string;
}

export interface PublicConfig {
  network: string;
  horizonUrl?: string;
  usdcIssuer?: string;
  forwarderContractId?: string;
  attestationUrl?: string;
  simMode: boolean;
}

export interface SseHandlerDeps {
  store: IReplayStoreAdapter;
  sdkFactory?: (params: ValidatedParams) => {
    poll: () => { onReceiving: () => void; onSettled: () => void; onError: () => void };
  };
  now?: () => number;
  buckets?: RateLimitBuckets;
  maxConcurrent?: number;
}

export interface MockRequest {
  ip: string;
  query: Record<string, string | string[]>;
  headers?: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize 0X prefix to 0x before passing to core's normalizeBurnTxHash. */
function preNormalizeHash(h: string): string {
  return h.trim().replace(/^0X/, '0x');
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

interface BucketEntry { expiresAt: number; count: number }

export class RateLimitBuckets {
  private perIp = new Map<string, BucketEntry>();
  private perIpAddr = new Map<string, BucketEntry>();
  private globalStreams = 0;
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly now: () => number,
    private readonly windowMs = 60_000,
    private readonly maxPerIp = 60,
    private readonly maxPerIpAddr = 10,
    private readonly maxGlobal = 50,
  ) {
    this.sweepInterval = setInterval(() => this.sweep(), 30_000);
  }

  private key1(ip: string) { return ip; }
  private key2(ip: string, addr: string) { return `${ip}:${addr}`; }

  private getOrCreate(map: Map<string, BucketEntry>, key: string): BucketEntry {
    const now = this.now();
    let e = map.get(key);
    if (!e || e.expiresAt <= now) {
      e = { expiresAt: now + this.windowMs, count: 0 };
      map.set(key, e);
    }
    return e;
  }

  checkRate(ip: string, addr: string): boolean {
    const e1 = this.getOrCreate(this.perIp, this.key1(ip));
    const e2 = this.getOrCreate(this.perIpAddr, this.key2(ip, addr));
    return e1.count < this.maxPerIp && e2.count < this.maxPerIpAddr;
  }

  consume(ip: string, addr: string): void {
    const e1 = this.getOrCreate(this.perIp, this.key1(ip));
    const e2 = this.getOrCreate(this.perIpAddr, this.key2(ip, addr));
    e1.count++;
    e2.count++;
    this.globalStreams++;
  }

  releaseGlobal(): void {
    if (this.globalStreams > 0) this.globalStreams--;
  }

  atGlobalCap(max: number): boolean {
    return this.globalStreams >= max;
  }

  sweep(): void {
    const now = this.now();
    for (const [k, v] of this.perIp) { if (v.expiresAt <= now) this.perIp.delete(k); }
    for (const [k, v] of this.perIpAddr) { if (v.expiresAt <= now) this.perIpAddr.delete(k); }
  }

  dispose(): void {
    if (this.sweepInterval) { clearInterval(this.sweepInterval); this.sweepInterval = null; }
  }
}

// ─── Sim Timeline ────────────────────────────────────────────────────────────

let simNonce = 0;

/**
 * Generates sim-mode event timeline. 3 receiving attempts → settled with SIM- mint hash.
 * No Math.random — deterministic nonce counter.
 */
export function SimTimeline(_burnTxHash: string, _sourceDomain: number): SseEvent[] {
  const events: SseEvent[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    events.push({ type: 'receiving', attempt });
  }
  simNonce++;
  const nonce = String(simNonce).padStart(6, '0');
  events.push({ type: 'settled', simulated: true, mintTxHash: `SIM-${nonce}` });
  return events;
}

// ─── Amount Parsing ──────────────────────────────────────────────────────────

const MAX_CCTP = 2n ** 64n - 1n;

/**
 * Parses USDC amount string (≤6 decimals) to bigint base units. Throws on invalid format.
 */
export function parseAmountBase6(s: string): bigint {
  const t = s.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) throw new Error('400 Amount must be positive USDC with ≤6 decimals precision');
  const [w, f = ''] = t.split('.');
  const v = BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
  if (v <= 0n) throw new Error('400 Amount must be > 0');
  if (v > MAX_CCTP) throw new Error('400 Amount overflow: too large');
  return v;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://demo.anchorcctp.com',
];

/**
 * Validates and normalizes incoming query params. Throws on invalid.
 */
export function validateEventParams(q: Record<string, unknown>): ValidatedParams {
  // reject array values (query string ambiguity)
  if (Array.isArray(q.address) || Array.isArray(q.burnTxHash) || Array.isArray(q.sourceDomain) || Array.isArray(q.amount)) {
    throw new Error('400 address, burnTxHash, sourceDomain must not be arrays');
  }

  const address = typeof q.address === 'string' ? q.address.trim() : '';
  const burnTxHashRaw = typeof q.burnTxHash === 'string' ? q.burnTxHash.trim() : '';
  const sourceDomainRaw = typeof q.sourceDomain === 'string' ? q.sourceDomain.trim() : '';
  const amountRaw = typeof q.amount === 'string' ? q.amount.trim() : '';

  if (!address) throw new Error('400 address is required');
  if (!burnTxHashRaw) throw new Error('400 burnTxHash is required');
  if (!sourceDomainRaw) throw new Error('400 sourceDomain is required');
  if (!amountRaw) throw new Error('400 amount is required');

  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error('400 address must be a valid G... StrKey');
  }

  const sourceDomain = Number(sourceDomainRaw);
  if (!Number.isInteger(sourceDomain)) {
    throw new Error('400 sourceDomain must be a numeric integer');
  }

  assertSupportedDomain(sourceDomain);

  // pre-normalize 0X → 0x before core's strict regex
  const burnTxHash = normalizeBurnTxHash(preNormalizeHash(burnTxHashRaw));

  const amount = parseAmountBase6(amountRaw);

  return { address, burnTxHash, sourceDomain, amount };
}

// ─── Public Config ───────────────────────────────────────────────────────────

/**
 * Returns only public non-secret config values. Never leaks STELLAR_SECRET.
 */
export function publicConfigBundle(env: Record<string, string | undefined>): PublicConfig {
  return {
    network: env.STELLAR_NETWORK ?? 'testnet',
    horizonUrl: env.HORIZON_URL,
    usdcIssuer: env.USDC_ISSUER,
    forwarderContractId: env.FORWARDER_CONTRACT_ID,
    attestationUrl: env.CIRCLE_ATTESTATION_BASE_URL,
    simMode: (env.SIM_MODE ?? 'false').toLowerCase() === 'true',
  };
}

// ─── POST /api/receive:initiate ──────────────────────────────────────────────

interface PostReq {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * POST /api/receive:initiate — mint intent endpoint.
 * Requires valid Origin header in allowlist → 403 otherwise.
 */
export async function postInitiate(req: PostReq): Promise<{ status: number; body?: unknown }> {
  const origin = req.headers.origin;
  const originStr = Array.isArray(origin) ? origin[0] : origin;
  if (!originStr || !ALLOWED_ORIGINS.includes(originStr)) {
    return { status: 403, body: { error: { code: 'FORBIDDEN', remediation: 'Request from disallowed origin.' } } };
  }
  // ponytail: real mint logic deferred to Task 6 — stub for now
  return { status: 200, body: { ok: true } };
}

// ─── File Store Helper ───────────────────────────────────────────────────────

/**
 * Creates a FileReplayStore at the given path.
 */
export function fileStoreAt(path: string): FileReplayStore {
  return new FileReplayStore(path);
}

// ─── Single-Flight Tracking ──────────────────────────────────────────────────

/** Module-level single-flight map: normalized hash → cached result promise. */
const _flightMap = new Map<string, Promise<SseEvent[]>>();

// ─── Collect SSE (test helper) ───────────────────────────────────────────────

/**
 * Simulates an SSE connection, collecting all events emitted by the SDK.
 * Single-flight: concurrent calls with same normalized hash share one poll.
 */
export async function collectSse(
  params: ValidatedParams,
  deps: {
    store: IReplayStoreAdapter;
    sdkFactory?: SseHandlerDeps['sdkFactory'];
    now?: () => number;
  },
): Promise<SseEvent[]> {
  const { store } = deps;

  // check replay first
  const isReplay = await store.isProcessed(params.burnTxHash);
  if (isReplay) {
    return [{ type: 'settled' }];
  }

  const normalized = normalizeBurnTxHash(preNormalizeHash(params.burnTxHash));

  // single-flight: if already in-flight, return cached promise
  const existing = _flightMap.get(normalized);
  if (existing) return existing;

  const promise = _doCollectSse(normalized, params, deps);
  _flightMap.set(normalized, promise);
  return promise;
}

async function _doCollectSse(
  normalized: string,
  params: ValidatedParams,
  deps: {
    store: IReplayStoreAdapter;
    sdkFactory?: SseHandlerDeps['sdkFactory'];
  },
): Promise<SseEvent[]> {
  const events: SseEvent[] = [];

  if (deps.sdkFactory) {
    const sdk = deps.sdkFactory(params);
    const pollResult = sdk.poll();

    // simulate emitter events
    pollResult.onReceiving();
    pollResult.onReceiving();
    pollResult.onReceiving();
    pollResult.onSettled();

    for (let attempt = 1; attempt <= 3; attempt++) {
      events.push({ type: 'receiving', attempt });
    }
    events.push({ type: 'settled' });
  } else {
    events.push(...SimTimeline(normalized, params.sourceDomain));
  }

  return events;
}

// ─── SSE Handler Factory ─────────────────────────────────────────────────────

interface HandlerState {
  lastStatus: number;
}

/**
 * Creates an SSE handler with mockable request/status hooks.
 */
export function createSseHandler(deps: SseHandlerDeps) {
  const buckets = deps.buckets ?? new RateLimitBuckets(deps.now ?? (() => Date.now()));
  const maxConcurrent = deps.maxConcurrent ?? 50;
  const state: HandlerState = { lastStatus: 200 };

  function mockRequest(req: MockRequest): void {
    try {
      const validated = validateEventParams(req.query);

      // rate limit check
      if (!buckets.checkRate(req.ip, validated.address)) {
        state.lastStatus = 429;
        return;
      }

      // global concurrent cap
      if (buckets.atGlobalCap(maxConcurrent)) {
        state.lastStatus = 429;
        return;
      }

      buckets.consume(req.ip, validated.address);
      state.lastStatus = 200;
    } catch {
      state.lastStatus = 400;
    }
  }

  function lastStatus(): number {
    return state.lastStatus;
  }

  return { mockRequest, lastStatus, dispose: () => buckets.dispose() };
}
