// apps/demo/server/handlers.test.ts
// Framework-free handler + KV store tests. Fake in-memory KV mirrors kv.ts.
import { describe, it, expect } from 'vitest';
import {
  handleFees,
  handleInitiate,
  handleSettle,
  handleStatus,
  trustedClientIp,
  SECURITY_HEADERS,
  IRIS_TIMEOUT_MS,
} from './handlers.js';
import type { HandlerDeps, HandlerResult } from './handlers.js';
import {
  MemoryBuckets,
  MemoryFeeCache,
  MemoryIntentStore,
  MemoryLock,
  MemoryReplayStore,
  KvIntentStore,
  RedisReplayStore,
  assertColdStartEnv,
  decodeSettlementRecord,
  depsFromEnv,
  encodeSettlementRecord,
  DEFAULT_FAST_WINDOW_MS,
  INTENT_TTL_MS,
  SETTLE_MAX_RETRIES,
} from './kv.js';
import type { BucketStore, StoredIntent } from './kv.js';
import { AttestationTimeoutError, MintFailedError, MintUnconfirmedError } from '@anchor-cctp/core-sdk';
import type { ReceiveResult, SettlementRecord } from '@anchor-cctp/core-sdk';

const HASH = '0x' + 'ab'.repeat(32);
const OTHER_HASH = '0x' + 'cd'.repeat(32);
const G = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const G2 = 'GCX2EQXSPCHMBSEGYZRVTZWOIDRXWRWYEFRTCNVOZPYXE4QEFPKNUF3V';
const AMOUNT = '0.10'; // → 100000 base-6
const AMOUNT_BASE6 = '100000';
const BASE = 1_800_000_000_000; // fixed server clock origin (ms epoch)

// ─── Response double ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Iris v2 frame carrying the executed finality tier. */
function irisFrame(opts: { complete?: boolean; executed?: number | null; delayReason?: string | null } = {}) {
  const complete = opts.complete ?? true;
  return {
    messages: [
      complete
        ? {
            status: 'complete',
            attestation: '0x' + 'cd'.repeat(70),
            message: '0x' + 'ab'.repeat(180),
            decodedMessage: {
              finalityThresholdExecuted: opts.executed ?? 1000,
              delayReason: opts.delayReason ?? null,
            },
          }
        : { status: 'pending', attestation: 'PENDING' },
    ],
  };
}

// ─── In-memory KV fakes (mirror the kv.ts interfaces) ────────────────────────

interface FakeState {
  intents: Map<string, StoredIntent>;
  bind: Map<string, string>;
  replay: Map<string, SettlementRecord>;
  locks: Map<string, { token: string; expiresAt: number }>;
  counters: Map<string, { count: number; expiresAt: number }>;
  fees: Map<string, unknown>;
}

const DEFAULT_LIMITS = { status: 60, initiate: 20, settle: 5 };

function fakeBuckets(state: FakeState, now: () => number, limits = DEFAULT_LIMITS): BucketStore {
  const hit = (key: string, limit: number): boolean => {
    const t = now();
    const e = state.counters.get(key);
    if (!e || e.expiresAt <= t) {
      state.counters.set(key, { count: 1, expiresAt: t + 60_000 });
      return true;
    }
    e.count++;
    return e.count <= limit;
  };
  return {
    async consumeIp(bucket, ip) {
      return hit(`${bucket}:ip:${ip}`, limits[bucket]);
    },
    async consumeSubject(bucket, ip, subject) {
      return hit(`${bucket}:ip:${ip}:${subject}`, limits[bucket]);
    },
  };
}

/** Seed a full intent + legacy binding, as `handleInitiate` would. */
function seedIntent(
  state: FakeState,
  over: Partial<StoredIntent> = {},
): StoredIntent {
  const intent: StoredIntent = {
    intentId: 'int_seed',
    burnTxHash: HASH,
    address: G,
    amount: AMOUNT_BASE6,
    sourceDomain: 6,
    transferMode: 'fast',
    createdAt: BASE,
    ...over,
  };
  state.intents.set(intent.intentId, intent);
  state.bind.set(`${intent.burnTxHash}|${intent.address}|${intent.amount}`, intent.intentId);
  return intent;
}

type FakeDeps = HandlerDeps & { state: FakeState; advanceClock(ms: number): void };

/**
 * In-memory intent/replay/lock/bucket/feeCache fakes mirroring the `kv.ts`
 * interfaces. An intent for HASH/G/0.10 is pre-seeded so status has something
 * to read.
 */
function fakeDeps(overrides: Partial<HandlerDeps> = {}, nowMs = BASE): FakeDeps {
  const state: FakeState = {
    intents: new Map(),
    bind: new Map(),
    replay: new Map(),
    locks: new Map(),
    counters: new Map(),
    fees: new Map(),
  };
  let clock = nowMs;
  const now = () => clock;
  const advanceClock = (ms: number) => {
    clock += ms;
  };

  seedIntent(state);

  const intents = {
    async put(intent: StoredIntent) {
      state.intents.set(intent.intentId, intent);
      state.bind.set(`${intent.burnTxHash}|${intent.address}|${intent.amount}`, intent.intentId);
      return intent;
    },
    async get(intentId: string, burnTxHash: string) {
      const i = state.intents.get(intentId);
      return i && i.burnTxHash === burnTxHash ? i : null;
    },
    async find(burnTxHash: string, address: string, amount: string) {
      const id = state.bind.get(`${burnTxHash}|${address}|${amount}`);
      return id ? state.intents.get(id) ?? null : null;
    },
    async record(burnTxHash: string, address: string, amount: string) {
      state.bind.set(`${burnTxHash}|${address}|${amount}`, 'int_legacy');
    },
    async has(burnTxHash: string, address: string, amount: string) {
      return state.bind.has(`${burnTxHash}|${address}|${amount}`);
    },
  };

  const replay = {
    async isProcessed(burnTxHash: string) {
      return state.replay.has(burnTxHash);
    },
    async markProcessed(burnTxHash: string, record: SettlementRecord) {
      state.replay.set(burnTxHash, { ...record, burnTxHash });
    },
    async getRecord(burnTxHash: string) {
      return state.replay.get(burnTxHash) ?? null;
    },
  };

  const locks = {
    async acquire(key: string, ttlMs: number) {
      const t = now();
      const held = state.locks.get(key);
      if (held && held.expiresAt > t) return null;
      const token = `tok_${state.locks.size + 1}`;
      state.locks.set(key, { token, expiresAt: t + ttlMs });
      return token;
    },
    async release(key: string, token: string) {
      const held = state.locks.get(key);
      if (held?.token === token) state.locks.delete(key);
    },
  };

  const feeCache = {
    async get(key: string) {
      return (state.fees.get(key) ?? null) as never;
    },
    async set(key: string, entry: unknown) {
      state.fees.set(key, entry);
    },
  };

  const cctp = {
    async receive(): Promise<ReceiveResult> {
      throw new Error('receive() must not be called on this path');
    },
  };

  const deps: FakeDeps = {
    intents: intents as never,
    replay: replay as never,
    locks: locks as never,
    buckets: fakeBuckets(state, now),
    feeCache: feeCache as never,
    cctp: cctp as never,
    now,
    ...overrides,
    state,
    advanceClock,
  };
  return deps;
}

/** A `receive()` double that mimics core: confirms, then writes the settled record. */
function mintingReceive(
  state: FakeState,
  opts: { txHash?: string; amount?: bigint; fail?: Error } = {},
) {
  const txHash = opts.txHash ?? 'MINT_TX_1';
  let calls = 0;
  return {
    calls: () => calls,
    receive: async (p: { burnTxHash: string }): Promise<ReceiveResult> => {
      calls++;
      if (opts.fail) throw opts.fail;
      const amount = opts.amount ?? 99_987n;
      await state.replay.set(p.burnTxHash, {
        burnTxHash: p.burnTxHash,
        txHash,
        amount,
        dust: 0n,
        status: 'settled',
        timestamp: new Date(BASE).toISOString(),
      });
      return { amount, dust: 0n, txHash, settled: true };
    },
  };
}

const settleBody = (over: Record<string, unknown> = {}) => ({
  burnTxHash: HASH,
  address: G,
  amount: AMOUNT,
  sourceDomain: 6,
  transferMode: 'fast',
  intentId: 'int_seed',
  ip: '9.9.9.9',
  ...over,
});

const bodyOf = (r: HandlerResult) => r.body as Record<string, never>;

// ─── status: read-only proof ─────────────────────────────────────────────────

describe('handleStatus', () => {
  it('status never mints: read-only proof', async () => {
    let minted = 0;
    const deps = fakeDeps({
      cctp: {
        receive: async () => {
          minted++;
          throw new Error('must not mint');
        },
      } as never,
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(minted).toBe(0);
    expect(['attesting', 'ready', 'settled']).toContain(bodyOf(r).status);
  });

  it('reports ready from a single Iris frame and never mints', async () => {
    const urls: string[] = [];
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async (url: string) => {
        urls.push(String(url));
        return jsonResponse(irisFrame());
      }) as never,
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(r.status).toBe(200);
    expect(bodyOf(r).status).toBe('ready');
    expect(bodyOf(r).attestationReady).toBe(true);
    expect(bodyOf(r).finalityThresholdExecuted).toBe(1000);
    expect(urls).toHaveLength(1); // exactly one Iris fetch per status call
    expect(urls[0]).toContain('/v2/messages/6?transactionHash=');
    expect(IRIS_TIMEOUT_MS).toBe(10_000);
  });

  it('degraded via the elapsed window past FAST_WINDOW_MS', async () => {
    const deps = fakeDeps() as FakeDeps & { advanceClock(ms: number): void };
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).degraded).toBe(false);

    deps.advanceClock(DEFAULT_FAST_WINDOW_MS + 1);
    const late = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(late).degraded).toBe(true);
    expect(bodyOf(late).elapsedMs).toBe(DEFAULT_FAST_WINDOW_MS + 1);
  });

  it('degraded via an Iris frame reporting finalityThresholdExecuted: 2000', async () => {
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse(irisFrame({ executed: 2000 }))) as never,
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).degraded).toBe(true);
    expect(bodyOf(r).finalityThresholdExecuted).toBe(2000);
  });

  it('degraded via delayReason: insufficient_fee', async () => {
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse(irisFrame({ delayReason: 'insufficient_fee' }))) as never,
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).degraded).toBe(true);
    expect(bodyOf(r).delayReason).toBe('insufficient_fee');
  });

  it('does not degrade a standard-mode intent on the elapsed window', async () => {
    const deps = fakeDeps() as FakeDeps & { advanceClock(ms: number): void };
    // Re-seeds the same (hash|address|amount) binding as standard, so `find` resolves here.
    seedIntent(deps.state, { transferMode: 'standard', intentId: 'int_std', createdAt: BASE });
    deps.advanceClock(DEFAULT_FAST_WINDOW_MS * 2);
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).degraded).toBe(false);
  });

  it('reads sourceDomain from the KV intent, never from a query param', async () => {
    const urls: string[] = [];
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async (url: string) => {
        urls.push(String(url));
        return jsonResponse(irisFrame());
      }) as never,
    });
    // A hostile caller tries to steer the Iris lookup at another domain.
    await handleStatus(
      { burnTxHash: HASH, address: G, amount: AMOUNT, sourceDomain: '999', ip: '9.9.9.9' } as never,
      deps,
    );
    expect(urls[0]).toContain('/v2/messages/6?');
  });

  it('stays attesting when Iris is unavailable or pending', async () => {
    const upstreamDown = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse({ error: 'boom' }, 500)) as never,
    });
    const r1 = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, upstreamDown);
    expect(bodyOf(r1).status).toBe('attesting');
    expect(bodyOf(r1).attestationReady).toBe(false);

    const pending = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse(irisFrame({ complete: false }))) as never,
    });
    const r2 = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, pending);
    expect(bodyOf(r2).status).toBe('attesting');
  });

  it('never calls Iris without an explicit base URL (no cross-network default)', async () => {
    let calls = 0;
    const deps = fakeDeps({
      fetch: (async () => {
        calls++;
        return jsonResponse(irisFrame());
      }) as never,
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(calls).toBe(0);
    expect(bodyOf(r).status).toBe('attesting');
  });

  it('returns the stored receipt once settled, without touching Iris', async () => {
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => {
        throw new Error('Iris must not be called for a settled transfer');
      }) as never,
    });
    await deps.replay.markProcessed(HASH, {
      burnTxHash: HASH,
      txHash: 'MINT_TX_1',
      amount: 99_987n,
      status: 'settled',
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).status).toBe('settled');
    expect(bodyOf(r).receipt).toEqual({ stellarAmount: '99987', mintTxHash: 'MINT_TX_1' });
  });

  it('never reports an unconfirmed (submitted) record as settled', async () => {
    const deps = fakeDeps();
    await deps.replay.markProcessed(HASH, {
      burnTxHash: HASH,
      txHash: 'MINT_TX_1',
      status: 'submitted',
    });
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT }, deps);
    expect(bodyOf(r).status).not.toBe('settled');
    expect(bodyOf(r).receipt).toBeUndefined();
  });

  it('403s without an intent and 400s on bad params', async () => {
    const deps = fakeDeps();
    expect((await handleStatus({ burnTxHash: OTHER_HASH, address: G, amount: AMOUNT }, deps)).status).toBe(403);
    expect((await handleStatus({ burnTxHash: 'nope', address: G, amount: AMOUNT }, deps)).status).toBe(400);
    expect((await handleStatus({ burnTxHash: HASH, address: 'not-a-key', amount: AMOUNT }, deps)).status).toBe(400);
    expect((await handleStatus({ burnTxHash: HASH, address: G, amount: '0' }, deps)).status).toBe(400);
  });

  it('429s once the shared per-IP status bucket is drained', async () => {
    const deps = fakeDeps({ buckets: undefined as never });
    const buckets = fakeBuckets(deps.state, deps.now!, { status: 2, initiate: 20, settle: 5 });
    deps.buckets = buckets;
    expect((await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT, ip: '1.1.1.1' }, deps)).status).toBe(200);
    expect((await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT, ip: '1.1.1.1' }, deps)).status).toBe(200);
    const r = await handleStatus({ burnTxHash: HASH, address: G, amount: AMOUNT, ip: '1.1.1.1' }, deps);
    expect(r.status).toBe(429);
    expect(bodyOf(r).error).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

// ─── initiate ────────────────────────────────────────────────────────────────

describe('handleInitiate', () => {
  const initiateBody = (over: Record<string, unknown> = {}) => ({
    burnTxHash: HASH,
    address: G,
    amount: AMOUNT,
    sourceDomain: 6,
    transferMode: 'fast',
    ip: '9.9.9.9',
    ...over,
  });

  it('records an intent and returns an intentId', async () => {
    const deps = fakeDeps({ newIntentId: () => 'int_fixed' });
    const r = await handleInitiate(initiateBody(), deps);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, intentId: 'int_fixed' });

    const intent = await deps.intents.find(HASH, G, AMOUNT_BASE6);
    expect(intent).toMatchObject({
      intentId: 'int_fixed',
      sourceDomain: 6,
      transferMode: 'fast',
      address: G,
      amount: AMOUNT_BASE6,
      createdAt: BASE,
    });
  });

  it('rejects sourceDomain 5 (Solana) at the edge, and any non-{6} domain', async () => {
    const deps = fakeDeps();
    for (const sourceDomain of [5, 0, 27, 999]) {
      const r = await handleInitiate(initiateBody({ sourceDomain }), deps);
      expect(r.status, `domain ${sourceDomain}`).toBe(400);
      expect(bodyOf(r).error).toMatchObject({ code: 'INVALID_PARAMS' });
    }
  });

  it('accepts a numeric sourceDomain (JSON body)', async () => {
    const deps = fakeDeps({ newIntentId: () => 'int_num' });
    expect((await handleInitiate(initiateBody({ sourceDomain: 6 }), deps)).status).toBe(200);
  });

  it('rejects a fabricated EVM hex address (never translateToStellar)', async () => {
    const deps = fakeDeps();
    const r = await handleInitiate(initiateBody({ address: '0x' + '11'.repeat(20) }), deps);
    expect(r.status).toBe(400);
  });

  it('rejects a missing transferMode and a bad maxFee', async () => {
    const deps = fakeDeps();
    expect((await handleInitiate(initiateBody({ transferMode: undefined }), deps)).status).toBe(400);
    expect((await handleInitiate(initiateBody({ transferMode: 'turbo' }), deps)).status).toBe(400);
    // maxFee > amount
    expect((await handleInitiate(initiateBody({ maxFee: '1.00' }), deps)).status).toBe(400);
    expect((await handleInitiate(initiateBody({ maxFee: 'abc' }), deps)).status).toBe(400);
    // maxFee <= amount is fine
    const ok = await handleInitiate(initiateBody({ maxFee: '0.01' }), deps);
    expect(ok.status).toBe(200);
    expect(await deps.intents.find(HASH, G, AMOUNT_BASE6)).toMatchObject({ maxFee: '10000' });
  });

  it('429s on POST intent flood per IP', async () => {
    const deps = fakeDeps();
    deps.buckets = fakeBuckets(deps.state, deps.now!, { status: 60, initiate: 1, settle: 5 });
    expect((await handleInitiate(initiateBody(), deps)).status).toBe(200);
    expect((await handleInitiate(initiateBody(), deps)).status).toBe(429);
  });

  it('403s an explicitly disallowed Origin when an allowlist is configured', async () => {
    const deps = fakeDeps({ allowedOrigins: ['http://localhost:5173'] });
    expect((await handleInitiate(initiateBody(), deps)).status).toBe(403);
    expect((await handleInitiate(initiateBody({ origin: 'https://evil.example' }), deps)).status).toBe(403);
    expect((await handleInitiate(initiateBody({ origin: 'http://localhost:5173' }), deps)).status).toBe(200);
  });
});

// ─── settle ──────────────────────────────────────────────────────────────────

describe('handleSettle', () => {
  it('settles once and returns the receipt net of the Fast fee', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state, { amount: 99_987n });
    deps.cctp = { receive: mint.receive } as never;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ receipt: { stellarAmount: '99987', mintTxHash: 'MINT_TX_1' } });
    expect(mint.calls()).toBe(1);
  });

  it('double-submit returns the same receipt and never re-mints', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    const first = await handleSettle(settleBody(), deps);
    const second = await handleSettle(settleBody(), deps);

    expect(mint.calls()).toBe(1);
    expect(bodyOf(second).code).toBe('ALREADY_PROCESSED');
    expect(bodyOf(second).receipt).toEqual(bodyOf(first).receipt);
  });

  it('mismatched address/amount/mode → 403 without signing', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    for (const over of [
      { address: G2 },
      { amount: '0.20' },
      { transferMode: 'standard' },
    ]) {
      const r = await handleSettle(settleBody(over), deps);
      expect(r.status, JSON.stringify(over)).toBe(403);
      expect(bodyOf(r).error).toMatchObject({ code: 'ADDRESS_MISMATCH' });
    }
    expect(mint.calls()).toBe(0);
  });

  it('intent mismatch → 403 on an unknown intentId or a hash that does not bind', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    const unknown = await handleSettle(settleBody({ intentId: 'int_nope' }), deps);
    expect(unknown.status).toBe(403);
    expect(bodyOf(unknown).error).toMatchObject({ code: 'NO_INTENT' });

    const otherHash = await handleSettle(
      settleBody({ burnTxHash: OTHER_HASH, address: G, amount: AMOUNT }),
      deps,
    );
    expect(otherHash.status).toBe(403);
    expect(mint.calls()).toBe(0);
  });

  it('expired intent + live replay record → ALREADY_PROCESSED, never re-mints', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    // The intent expired out of KV (24h TTL)…
    deps.state.intents.clear();
    // …but the replay record is permanent and reflects a confirmed mint.
    await deps.replay.markProcessed(HASH, {
      burnTxHash: HASH,
      txHash: 'MINT_TX_ORIGINAL',
      amount: 99_987n,
      status: 'settled',
    });

    const r = await handleSettle(settleBody(), deps);
    expect(bodyOf(r).code).toBe('ALREADY_PROCESSED');
    expect(bodyOf(r).receipt).toEqual({
      stellarAmount: '99987',
      mintTxHash: 'MINT_TX_ORIGINAL',
    });
    expect(mint.calls()).toBe(0);
  });

  it('persists the settled receipt durably — core writes only to its in-process store', async () => {
    const deps = fakeDeps();
    let calls = 0;
    // Mirrors the real client: core confirms and writes its OWN store, not deps.replay.
    deps.cctp = {
      receive: async () => {
        calls++;
        return { amount: 99_987n, dust: 0n, txHash: 'MINT_TX_DURABLE', settled: true };
      },
    } as never;

    const first = await handleSettle(settleBody(), deps);
    expect(first.status).toBe(200);

    const record = await deps.replay.getRecord(HASH);
    expect(record).toMatchObject({
      status: 'settled',
      txHash: 'MINT_TX_DURABLE',
      amount: 99_987n,
      sourceDomain: 6,
      destinationAddress: G,
    });

    // Even after the 24h intent TTL drops the intent, the receipt still answers.
    deps.state.intents.clear();
    const again = await handleSettle(settleBody(), deps);
    expect(bodyOf(again).code).toBe('ALREADY_PROCESSED');
    expect(bodyOf(again).receipt).toEqual(bodyOf(first).receipt);
    expect(calls).toBe(1);
  });

  it('records a broadcast-but-unconfirmed mint as submitted, never settled', async () => {
    const deps = fakeDeps();
    deps.cctp = {
      receive: async () => {
        throw new MintUnconfirmedError(HASH, 'BROADCAST_TX');
      },
    } as never;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(502);
    expect(bodyOf(r).error).toMatchObject({ code: 'MINT_UNCONFIRMED' });
    expect(await deps.replay.getRecord(HASH)).toMatchObject({
      status: 'submitted',
      txHash: 'BROADCAST_TX',
    });

    // The next attempt reconciles against that hash instead of broadcasting again.
    const second = await handleSettle(settleBody(), deps);
    expect(second.status).toBe(502);
    expect(bodyOf(second).error).toMatchObject({ code: 'MINT_UNCONFIRMED' });
  });

  it('re-runs the MAX_MINT_AMOUNT_USDC cap server-side', async () => {
    const deps = fakeDeps({ maxMintBase6: 50_000n });
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    const r = await handleSettle(settleBody(), deps); // 100000 > 50000
    expect(r.status).toBe(400);
    expect(bodyOf(r).error).toMatchObject({ code: 'AMOUNT_TOO_LARGE' });
    expect(mint.calls()).toBe(0);
  });

  it('re-runs the sourceDomain allow-list server-side', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;
    for (const i of deps.state.intents.values()) i.sourceDomain = 5;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(400);
    expect(mint.calls()).toBe(0);
  });

  it('applies the strict settle bucket (per IP+address) before any signing', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;

    for (let i = 0; i < 5; i++) await handleSettle(settleBody(), deps);
    expect(mint.calls()).toBe(1); // replays 2..5 short-circuit on replay

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(429);
    expect(bodyOf(r).error).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('single-flight lock refuses a concurrent settle for the same burn', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;
    await deps.locks.acquire(`settle:${HASH}`, 60_000);

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(429);
    expect(mint.calls()).toBe(0);
  });

  it('writes no settled record when the mint fails, and maps the error code', async () => {
    const deps = fakeDeps();
    deps.cctp = {
      receive: async () => {
        throw new MintFailedError(HASH, 'simulate: boom');
      },
    } as never;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(502);
    expect(bodyOf(r).error).toMatchObject({ code: 'MINT_FAILED' });
    expect(await deps.replay.getRecord(HASH)).toBeNull();
  });

  it('maps an exhausted attestation budget to NOT_READY for the client to keep polling', async () => {
    const deps = fakeDeps();
    deps.cctp = {
      receive: async () => {
        throw new AttestationTimeoutError(HASH, 60_000);
      },
    } as never;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(409);
    expect(bodyOf(r).error).toMatchObject({ code: 'NOT_READY' });
  });

  it('threads the sponsor, live sequence and network-passphrase transport into receive()', async () => {
    const deps = fakeDeps();
    let seen: Record<string, unknown> | null = null;
    deps.settleTransport = {
      sponsorAccount: G,
      rpc: { simulateTransaction: async () => ({}), assembleTransaction: () => '', sendTransaction: async () => ({ status: 'PENDING', hash: 'h' }), getTransaction: async () => ({ status: 'SUCCESS' }) },
      readSequence: async () => '424242',
    };
    deps.cctp = {
      receive: async (p: Record<string, unknown>) => {
        seen = p;
        return { amount: 99_987n, dust: 0n, txHash: 'MINT_TX_1', settled: true };
      },
    } as never;

    const r = await handleSettle(settleBody(), deps);
    expect(r.status).toBe(200);
    expect(seen).toMatchObject({
      sourceDomain: 6,
      burnTxHash: HASH,
      destinationAddress: G,
      amount: 100000n,
      sponsorAccount: G,
      sourceSequence: '424242',
    });
    expect(seen!.rpc).toBe(deps.settleTransport.rpc);
  });

  it('rejects a body whose sourceDomain disagrees with the stored intent', async () => {
    const deps = fakeDeps();
    const mint = mintingReceive(deps.state);
    deps.cctp = { receive: mint.receive } as never;
    const r = await handleSettle(settleBody({ sourceDomain: 0 }), deps);
    expect(r.status).toBe(400);
    expect(mint.calls()).toBe(0);
  });

  it('400s a missing intentId or bad base params', async () => {
    const deps = fakeDeps();
    expect((await handleSettle(settleBody({ intentId: undefined }), deps)).status).toBe(400);
    expect((await handleSettle(settleBody({ burnTxHash: 'nope' }), deps)).status).toBe(400);
  });
});

// ─── fees ────────────────────────────────────────────────────────────────────

describe('handleFees', () => {
  const TIERS = [
    { finalityThreshold: 1000, minimumFee: 1.3 },
    { finalityThreshold: 2000, minimumFee: 0 },
  ];

  it('quotes the requested tier and caches the route for 1h', async () => {
    let calls = 0;
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => {
        calls++;
        return jsonResponse(TIERS);
      }) as never,
    });

    const r = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'fast' }, deps);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      minimumFee: '1.3',
      finalityThreshold: 1000,
      fastTierAvailable: true,
    });
    expect(typeof (r.body as { cachedAt: string }).cachedAt).toBe('string');
    expect(calls).toBe(2); // fast + standard probed once on cold start

    const again = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'fast' }, deps);
    expect(again.body).toEqual(r.body);
    expect(calls).toBe(2); // served from cache
  });

  it('re-quotes once the 1h cache window has passed', async () => {
    let calls = 0;
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => {
        calls++;
        return jsonResponse(TIERS);
      }) as never,
    }) as FakeDeps & { advanceClock(ms: number): void };

    await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'standard' }, deps);
    expect(calls).toBe(2);
    deps.advanceClock(3_600_001);
    await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'standard' }, deps);
    expect(calls).toBe(4);
  });

  it('reports fastTierAvailable: false instead of mislabelling a Standard fee', async () => {
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse([{ finalityThreshold: 2000, minimumFee: 0 }])) as never,
    });
    const r = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'standard' }, deps);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ finalityThreshold: 2000, minimumFee: '0', fastTierAvailable: false });

    // …and a fast quote on that route fails closed.
    const fast = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'fast' }, deps);
    expect(fast.status).toBe(503);
    expect(bodyOf(fast).error).toMatchObject({ code: 'FEE_UNAVAILABLE' });
  });

  it('maps INVALID_DOMAIN separately from FEE_UNAVAILABLE', async () => {
    const deps = fakeDeps({
      attestationBaseUrl: 'https://iris-api-sandbox.circle.com',
      fetch: (async () => jsonResponse(TIER_MISSING)) as never,
    });
    const bad = await handleFees({ sourceDomain: '999', destDomain: '27', mode: 'fast' }, deps);
    expect(bad.status).toBe(400);
    expect(bodyOf(bad).error).toMatchObject({ code: 'INVALID_DOMAIN' });

    const down = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'fast' }, deps);
    expect(down.status).toBe(503);
    expect(bodyOf(down).error).toMatchObject({ code: 'FEE_UNAVAILABLE' });
  });

  it('400s an unknown mode and non-numeric domains', async () => {
    const deps = fakeDeps({ attestationBaseUrl: 'https://iris-api-sandbox.circle.com' });
    expect((await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'turbo' }, deps)).status).toBe(400);
    expect((await handleFees({ sourceDomain: 'abc', destDomain: '27', mode: 'fast' }, deps)).status).toBe(400);
    expect((await handleFees({ sourceDomain: '6', mode: 'fast' }, deps)).status).toBe(400);
  });

  it('never quotes without an explicit attestation base URL', async () => {
    let calls = 0;
    const deps = fakeDeps({
      fetch: (async () => {
        calls++;
        return jsonResponse(TIERS);
      }) as never,
    });
    const r = await handleFees({ sourceDomain: '6', destDomain: '27', mode: 'fast' }, deps);
    expect(r.status).toBe(503);
    expect(calls).toBe(0);
  });
});

const TIER_MISSING = { error: 'nope' };

// ─── response hygiene ────────────────────────────────────────────────────────

describe('response hygiene', () => {
  it('keys rate buckets on x-real-ip, never x-forwarded-for', () => {
    expect(trustedClientIp({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '9.9.9.9' })).toBe('9.9.9.9');
    expect(trustedClientIp({ 'x-forwarded-for': '1.2.3.4' })).toBe('unknown');
    expect(trustedClientIp({})).toBe('unknown');
    expect(trustedClientIp({ 'x-real-ip': ['9.9.9.9', '8.8.8.8'] })).toBe('9.9.9.9');
  });

  it('exposes security-header parity with serve.ts', () => {
    expect(SECURITY_HEADERS['Cache-Control']).toMatch(/no-store/);
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('never leaks a secret seed in a handler body', async () => {
    const deps = fakeDeps();
    deps.cctp = {
      receive: async () => {
        throw new Error('boom SDNMRSIZWINOTESTFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234');
      },
    } as never;
    const r = await handleSettle(settleBody(), deps);
    expect(JSON.stringify(r.body)).not.toMatch(/S[A-Z2-7]{55}/);
  });
});

// ─── KV stores ───────────────────────────────────────────────────────────────

describe('MemoryIntentStore', () => {
  const draft = (over: Partial<StoredIntent> = {}): StoredIntent => ({
    intentId: 'int_1',
    burnTxHash: HASH,
    address: G,
    amount: AMOUNT_BASE6,
    sourceDomain: 6,
    transferMode: 'fast',
    createdAt: BASE,
    ...over,
  });

  it('round-trips put/get/find and the legacy record/has binding', async () => {
    let t = BASE;
    const store = new MemoryIntentStore({ now: () => t });
    await store.put(draft());
    expect(await store.get('int_1', HASH)).toMatchObject({ intentId: 'int_1' });
    expect(await store.get('int_1', OTHER_HASH)).toBeNull();
    expect(await store.find(HASH, G, AMOUNT_BASE6)).toMatchObject({ intentId: 'int_1' });
    expect(await store.find(HASH, G2, AMOUNT_BASE6)).toBeNull();

    await store.record(OTHER_HASH, G, AMOUNT_BASE6);
    expect(await store.has(OTHER_HASH, G, AMOUNT_BASE6)).toBe(true);
    expect(await store.has(HASH, G, AMOUNT_BASE6)).toBe(true);
  });

  it('expires intents after the 24h TTL', async () => {
    let t = BASE;
    const store = new MemoryIntentStore({ now: () => t });
    await store.put(draft());
    t = BASE + INTENT_TTL_MS - 1;
    expect(await store.find(HASH, G, AMOUNT_BASE6)).not.toBeNull();
    t = BASE + INTENT_TTL_MS;
    expect(await store.find(HASH, G, AMOUNT_BASE6)).toBeNull();
    expect(await store.get('int_1', HASH)).toBeNull();
    expect(await store.has(HASH, G, AMOUNT_BASE6)).toBe(false);
    store[Symbol.dispose]();
  });
});

describe('replay records are permanent', () => {
  it('MemoryReplayStore survives any number of clock advances', async () => {
    let t = BASE;
    const store = new MemoryReplayStore({ now: () => t });
    await store.markProcessed(HASH, { burnTxHash: HASH, txHash: 'MINT_TX_1', amount: 99_987n, dust: 0n, status: 'settled' });
    t = BASE + 100 * 365 * 24 * 3_600_000;
    expect(await store.isProcessed(HASH)).toBe(true);
    expect(await store.getRecord(HASH)).toMatchObject({ amount: 99_987n, dust: 0n, status: 'settled' });
  });

  it('encodes and decodes bigint records without loss', () => {
    const record: SettlementRecord = {
      burnTxHash: HASH,
      txHash: 'MINT_TX_1',
      amount: 123_456_789_012_345_678_901n,
      dust: 0n,
      sourceDomain: 6,
      destinationAddress: G,
      timestamp: '2026-09-25T00:00:00.000Z',
      status: 'settled',
    };
    const round = decodeSettlementRecord(encodeSettlementRecord(record));
    expect(round).toEqual(record);
    expect(typeof round.amount).toBe('bigint');
  });

  it('KvIntentStore and RedisReplayStore build over an injected Upstash client', async () => {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const redis = {
      get: async (k: string) => {
        calls.push({ op: 'get', args: [k] });
        return null;
      },
      set: async (...args: unknown[]) => {
        calls.push({ op: 'set', args });
        return 'OK';
      },
    };
    const intents = new KvIntentStore(redis as never, { now: () => BASE });
    await intents.put({
      intentId: 'int_kv',
      burnTxHash: HASH,
      address: G,
      amount: AMOUNT_BASE6,
      sourceDomain: 6,
      transferMode: 'fast',
      createdAt: BASE,
    });
    const intentWrites = calls.filter((c) => c.op === 'set');
    expect(intentWrites).toHaveLength(2); // full intent + legacy binding
    for (const w of intentWrites) {
      const opts = w.args[2] as { ex: number };
      expect(opts.ex).toBe(86_400); // 24h intent TTL
    }

    const replay = new RedisReplayStore(redis as never);
    await replay.markProcessed(HASH, { burnTxHash: HASH, txHash: 'MINT_TX_1', amount: 1n, status: 'settled' });
    const lastWrite = calls[calls.length - 1];
    expect(lastWrite.args).toHaveLength(2); // no TTL option → permanent
    expect(await replay.getRecord(HASH)).toBeNull();
  });
});

describe('MemoryLock / MemoryBuckets / MemoryFeeCache', () => {
  it('holds a lock until released or TTL-expired', async () => {
    let t = BASE;
    const lock = new MemoryLock({ now: () => t });
    const token = await lock.acquire('settle:' + HASH, 60_000);
    expect(token).toBeTruthy();
    expect(await lock.acquire('settle:' + HASH, 60_000)).toBeNull();
    await lock.release('settle:' + HASH, 'wrong-token');
    expect(await lock.acquire('settle:' + HASH, 60_000)).toBeNull();
    await lock.release('settle:' + HASH, token!);
    expect(await lock.acquire('settle:' + HASH, 60_000)).toBeTruthy();

    t = BASE + 60_001;
    const stale = await lock.acquire('settle:' + HASH, 60_000);
    expect(stale).toBeTruthy(); // TTL expiry: a crashed invocation cannot wedge a hash forever
    expect(await lock.acquire('settle:' + HASH, 60_000)).toBeNull();
  });

  it('enforces the default per-bucket windows', async () => {
    let t = BASE;
    const buckets = new MemoryBuckets({ now: () => t });
    for (let i = 0; i < 60; i++) expect(await buckets.consumeIp('status', '1.1.1.1')).toBe(true);
    expect(await buckets.consumeIp('status', '1.1.1.1')).toBe(false);
    for (let i = 0; i < 5; i++) expect(await buckets.consumeSubject('settle', '1.1.1.1', G)).toBe(true);
    expect(await buckets.consumeSubject('settle', '1.1.1.1', G)).toBe(false);
    // distinct subject has its own allowance, and the window resets on the clock
    expect(await buckets.consumeSubject('settle', '1.1.1.1', G2)).toBe(true);
    t = BASE + 60_001;
    expect(await buckets.consumeIp('status', '1.1.1.1')).toBe(true);
    buckets[Symbol.dispose]?.();
  });

  it('caches fee entries for the TTL window', async () => {
    let t = BASE;
    const cache = new MemoryFeeCache({ now: () => t, ttlMs: 3_600_000 });
    await cache.set('fees:6:27', { fastTierAvailable: true, cachedAt: BASE });
    expect(await cache.get('fees:6:27')).toMatchObject({ fastTierAvailable: true });
    t = BASE + 3_600_001;
    expect(await cache.get('fees:6:27')).toBeNull();
  });
});

// ─── cold-start env enforcement ──────────────────────────────────────────────

describe('assertColdStartEnv', () => {
  const base = {
    STELLAR_NETWORK: 'testnet',
    STELLAR_DESTINATION: G,
    HORIZON_URL: 'https://horizon-testnet.stellar.org',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    CIRCLE_ATTESTATION_BASE_URL: 'https://iris-api-sandbox.circle.com',
  };

  it('accepts a network-consistent testnet env', () => {
    expect(() => assertColdStartEnv(base)).not.toThrow();
    expect(() => assertColdStartEnv({ ...base, STELLAR_NETWORK: 'mainnet', HORIZON_URL: 'https://horizon.stellar.org', CIRCLE_ATTESTATION_BASE_URL: 'https://iris-api.circle.com' })).not.toThrow();
  });

  it('requires CIRCLE_ATTESTATION_BASE_URL — never defaults across networks', () => {
    expect(() => assertColdStartEnv({ ...base, CIRCLE_ATTESTATION_BASE_URL: undefined }))
      .toThrow(/CIRCLE_ATTESTATION_BASE_URL/);
  });

  it('rejects a mainnet Iris host on a testnet run, and vice versa', () => {
    expect(() => assertColdStartEnv({ ...base, CIRCLE_ATTESTATION_BASE_URL: 'https://iris-api.circle.com' }))
      .toThrow(/iris-api-sandbox/);
    expect(() =>
      assertColdStartEnv({
        ...base,
        STELLAR_NETWORK: 'mainnet',
        HORIZON_URL: 'https://horizon.stellar.org',
        CIRCLE_ATTESTATION_BASE_URL: 'https://iris-api-sandbox.circle.com',
      })
    ).toThrow(/iris-api/);
  });

  it('requires https + the stellar.org host allowlist for RPC/Horizon', () => {
    expect(() => assertColdStartEnv({ ...base, SOROBAN_RPC_URL: 'http://soroban-testnet.stellar.org' }))
      .toThrow(/SOROBAN_RPC_URL/);
    expect(() => assertColdStartEnv({ ...base, SOROBAN_RPC_URL: 'https://evil.example' }))
      .toThrow(/SOROBAN_RPC_URL/);
    expect(() => assertColdStartEnv({ ...base, SOROBAN_RPC_URL: undefined })).toThrow(/SOROBAN_RPC_URL/);
    expect(() => assertColdStartEnv({ ...base, HORIZON_URL: 'https://evil.example' })).toThrow(/HORIZON_URL/);
    expect(() => assertColdStartEnv({ ...base, CIRCLE_ATTESTATION_BASE_URL: 'http://iris-api-sandbox.circle.com' }))
      .toThrow(/https/);
  });

  it('depsFromEnv refuses to build serverless deps without KV credentials', () => {
    expect(() => depsFromEnv(base)).toThrow(/KV_REST_API_URL/);
  });

  it('pins the settle attestation budget well inside the Hobby 300s invocation', () => {
    expect(SETTLE_MAX_RETRIES).toBe(10);
  });
});
