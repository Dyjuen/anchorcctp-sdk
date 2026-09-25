// apps/demo/server/serve.ts
// Node HTTP server: SSE stream, POST receive:initiate, GET config.
// ponytail: server-only, esbuild bundles to dist-server/serve.cjs.

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { normalizeBurnTxHash, assertSupportedDomain, FileReplayStore, createAnchorCCTPFromEnv } from '@anchor-cctp/core-sdk';
import type { AnchorCCTP, ReceiveParams, ReceiveResult } from '@anchor-cctp/core-sdk';
import { validateEventParams, publicConfigBundle, SimTimeline, postInitiate, gateRealStream, createIntentStore, createRealGate, RateLimitBuckets, collectSseReal, readBodyCapped } from './events.js';
import { handleFees, handleInitiate, handleSettle, handleStatus, trustedClientIp } from './handlers.js';
import type { HandlerDeps, HandlerResult } from './handlers.js';
import { MemoryBuckets, MemoryFeeCache, MemoryIntentStore, MemoryLock, SETTLE_MAX_RETRIES } from './kv.js';
import { Horizon, Networks, StrKey } from '@stellar/stellar-sdk';

// ─── Env ─────────────────────────────────────────────────────────────────────

const env = process.env as Record<string, string | undefined>;
const SIM_MODE = (env.SIM_MODE ?? 'false').toLowerCase() === 'true';
const PORT = Number(env.PORT ?? '3001');
const REPLAY_STORE_PATH = env.REPLAY_STORE_PATH ?? './data/replay.json';

// fail-fast: real mode requires STELLAR_SECRET
if (!SIM_MODE && !env.STELLAR_SECRET) {
  throw new Error('STELLAR_SECRET required in real mode (SIM_MODE=false)');
}
// fail-fast: real mode mints through core's R9 wiring (RPC transport + Horizon sponsor reads)
if (!SIM_MODE && !env.SOROBAN_RPC_URL) {
  throw new Error('SOROBAN_RPC_URL required in real mode (no Soroban transport to mint with)');
}
if (!SIM_MODE && !env.HORIZON_URL) {
  throw new Error('HORIZON_URL required in real mode (sponsor sequence + trustline reads)');
}

const replayStore = new FileReplayStore(REPLAY_STORE_PATH);

// ─── Real-Mode Init ──────────────────────────────────────────────────────────

const MAX_MINT_AMOUNT_USDC = env.MAX_MINT_AMOUNT_USDC ? BigInt(env.MAX_MINT_AMOUNT_USDC) : undefined;
const intentStore = createIntentStore();
const buckets = new RateLimitBuckets(() => Date.now());
const activeReceives = { count: 0 };
const realGate = createRealGate({ maxConcurrentReceives: 5, active: () => activeReceives.count });

let cctpClient: ReturnType<typeof createAnchorCCTPFromEnv> | null = null;
if (!SIM_MODE) {
  cctpClient = createAnchorCCTPFromEnv(process.env as Record<string, string | undefined>, {
    maxRetries: SETTLE_MAX_RETRIES,
  });
}

// ─── Handler deps (spec §4 routes) ───────────────────────────────────────────
// The same FileReplayStore backs both the SSE gate and the durable settle receipt.

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://demo.anchorcctp.com',
];

const NETWORK_PASSPHRASE =
  (env.STELLAR_NETWORK ?? 'testnet') === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const horizonServer = cctpClient ? new Horizon.Server(env.HORIZON_URL as string) : null;

/** The sponsor's real sequence — `'0'` would be account sequence 1 and get rejected. */
async function readSponsorSequence(): Promise<string | undefined> {
  if (!horizonServer || !cctpClient) return undefined;
  const account = await horizonServer.loadAccount(cctpClient.destinationAddress);
  return account.sequence;
}

/** SIM_MODE has no signer — settle must fail as a mint error, never silently pass. */
const simCctp = {
  async receive(): Promise<ReceiveResult> {
    throw new Error('receive() is unavailable: the server is running in SIM_MODE.');
  },
};

const handlerDeps: HandlerDeps = {
  intents: new MemoryIntentStore(),
  replay: replayStore,
  locks: new MemoryLock(),
  buckets: new MemoryBuckets(),
  feeCache: new MemoryFeeCache(),
  cctp: cctpClient ? cctpClient.client : simCctp,
  attestationBaseUrl: env.CIRCLE_ATTESTATION_BASE_URL,
  allowedOrigins: ALLOWED_ORIGINS,
  ...(MAX_MINT_AMOUNT_USDC === undefined ? {} : { maxMintBase6: MAX_MINT_AMOUNT_USDC }),
  ...(env.FAST_WINDOW_MS ? { fastWindowMs: Number(env.FAST_WINDOW_MS) } : {}),
  ...(cctpClient?.sorobanTransport
    ? {
        settleTransport: {
          sponsorAccount: cctpClient.destinationAddress,
          rpc: cctpClient.sorobanTransport,
          readSequence: async () => (await readSponsorSequence()) as string,
          networkPassphrase: NETWORK_PASSPHRASE,
        },
      }
    : {}),
};

/**
 * The SSE path calls `client.receive(params)` with no transport arguments, so the
 * sponsor's live sequence is injected here (R9 supplies the RPC transport + sponsor
 * through the client's own config).
 */
function withLiveSequence(client: AnchorCCTP): AnchorCCTP {
  return {
    ...client,
    async receive(params: ReceiveParams): Promise<ReceiveResult> {
      const sourceSequence = params.sourceSequence ?? (await readSponsorSequence());
      return client.receive({
        ...params,
        ...(sourceSequence === undefined ? {} : { sourceSequence }),
        networkPassphrase: params.networkPassphrase ?? NETWORK_PASSPHRASE,
      });
    },
  } as AnchorCCTP;
}

// ─── Headers ─────────────────────────────────────────────────────────────────

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.stellar.org";
const NO_STORE = 'no-store, no-cache, must-revalidate';

function setApiHeaders(res: ServerResponse): void {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ─── URL Parsing ─────────────────────────────────────────────────────────────

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  const qs = url.slice(idx + 1);
  const params: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    const [k, ...rest] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(rest.join('='));
  }
  return params;
}

// ─── Request Handler ─────────────────────────────────────────────────────────

function jsonRes(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sseError(res: ServerResponse, status: number, code: string, remediation: string): void {
  setApiHeaders(res);
  jsonRes(res, status, { error: { code, remediation } });
}

/** Bucket key: only the trusted `x-real-ip` header; `x-forwarded-for` is spoofable. */
function getIp(req: IncomingMessage): string {
  return trustedClientIp(req.headers, req.socket.remoteAddress ?? 'unknown');
}

/** Writes a framework-free handler result through the Node response. */
function sendHandlerResult(res: ServerResponse, result: HandlerResult): void {
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  jsonRes(res, result.status, result.body);
}

/** Reads a capped JSON body; returns `undefined` when the cap was hit (already answered). */
async function readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
  const bodyResult = await readBodyCapped(req, res);
  if ('error' in bodyResult) return undefined;
  try {
    return JSON.parse(bodyResult.body);
  } catch {
    return undefined;
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // ─── GET /api/config ─────────────────────────────────────────────
  if (method === 'GET' && url.startsWith('/api/config')) {
    setApiHeaders(res);
    return jsonRes(res, 200, publicConfigBundle(env));
  }

  // ─── GET /api/fees ───────────────────────────────────────────────
  // Framework-free handlers (spec §4): initiate → status poll → settle. The Vercel
  // wrappers (Task 9) call the same functions with the same deps shape.
  if (method === 'GET' && url.startsWith('/api/fees')) {
    const q = parseQuery(url);
    return sendHandlerResult(res, await handleFees({ ...q, ip: getIp(req) }, handlerDeps));
  }

  // ─── GET /api/receive/status ─────────────────────────────────────
  if (method === 'GET' && url.startsWith('/api/receive/status')) {
    const q = parseQuery(url);
    return sendHandlerResult(res, await handleStatus({ ...q, ip: getIp(req) }, handlerDeps));
  }

  // ─── POST /api/receive/initiate ──────────────────────────────────
  if (method === 'POST' && url.startsWith('/api/receive/initiate')) {
    const parsed = await readJsonBody(req, res);
    if (parsed === undefined) return;
    const origin = req.headers.origin;
    return sendHandlerResult(
      res,
      await handleInitiate(
        { ...(parsed as Record<string, unknown>), origin, ip: getIp(req) },
        handlerDeps,
      ),
    );
  }

  // ─── POST /api/receive/settle ────────────────────────────────────
  if (method === 'POST' && url.startsWith('/api/receive/settle')) {
    const parsed = await readJsonBody(req, res);
    if (parsed === undefined) return;
    return sendHandlerResult(
      res,
      await handleSettle({ ...(parsed as Record<string, unknown>), ip: getIp(req) }, handlerDeps),
    );
  }

  // ─── POST /api/receive:initiate (legacy local route) ─────────────
  if (method === 'POST' && url.startsWith('/api/receive:initiate')) {
    setApiHeaders(res);
    const bodyResult = await readBodyCapped(req, res);
    if ('error' in bodyResult) return;
    let parsed: unknown;
    try { parsed = JSON.parse(bodyResult.body); } catch { parsed = undefined; }
    const postResult = await postInitiate({
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, v])),
      body: parsed,
      ip: getIp(req),
      buckets,
      intentStore,
    });
    return jsonRes(res, postResult.status, postResult.body);
  }

  // ─── GET /api/events (SSE stream) ───────────────────────────────
  if (method === 'GET' && url.startsWith('/api/events')) {
    setApiHeaders(res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');

    const q = parseQuery(url);
    let validated;
    try {
      validated = validateEventParams(q);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'bad request';
      const code = msg.includes('400') ? 'INVALID_PARAMS' : 'UNKNOWN';
      return sseError(res, 400, code, msg.replace(/^400\s*/, ''));
    }

    // replay check
    if (await replayStore.isProcessed(validated.burnTxHash)) {
      res.write(`data: ${JSON.stringify({ type: 'settled' })}\n\n`);
      res.end();
      return;
    }

    // sim mode
    if (SIM_MODE) {
      const steps = SimTimeline(validated.burnTxHash, validated.sourceDomain);
      for (const step of steps) {
        res.write(`data: ${JSON.stringify(step)}\n\n`);
      }
      res.end();
      return;
    }

    // real mode: gated SSE via core receive
    const gateRes = await gateRealStream(validated, { intents: intentStore, maxMintBase6: MAX_MINT_AMOUNT_USDC });
    if (gateRes.status !== 200) {
      return sseError(res, gateRes.status, (gateRes.body as { error?: { code?: string } })?.error?.code ?? 'UNKNOWN', (gateRes.body as { error?: { remediation?: string } })?.error?.remediation ?? 'Request rejected.');
    }
    if (!realGate.tryAcquire()) {
      return sseError(res, 429, 'RATE_LIMITED', 'Too many concurrent receives. Try again later.');
    }
    activeReceives.count++;
    const keepalive = setInterval(() => { try { res.write(': keepalive\n\n'); } catch { /* client gone */ } }, 25_000);
    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; clearInterval(keepalive); activeReceives.count = Math.max(0, activeReceives.count - 1); };
    req.on('close', cleanup);
    try {
      const events = await collectSseReal(validated, {
        store: replayStore,
        clientFactory: () => withLiveSequence(cctpClient!.client),
      });
      for (const event of events) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.includes('400') ? 'INVALID_PARAMS' : 'RECEIVE_FAILED';
      res.write(`data: ${JSON.stringify({ type: 'error', code, remediation: 'Receive failed. Retry later.' })}\n\n`);
    } finally {
      cleanup();
      res.end();
    }
    return;
  }

  // ─── Fallback: 404 ──────────────────────────────────────────────
  jsonRes(res, 404, {
    error: {
      code: 'NOT_FOUND',
      remediation:
        'Use GET /api/config, GET /api/fees, GET /api/receive/status, POST /api/receive/initiate, or POST /api/receive/settle.',
    },
  });
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (e) {
    console.error('[events] unhandled:', e);
    if (!res.headersSent) {
      sseError(res, 500, 'INTERNAL', 'An unexpected error occurred.');
    }
  }
});

server.on('close', () => {
  buckets.dispose();
});

server.listen(PORT, () => {
  console.log(`[events] listening on http://localhost:${PORT} (sim=${SIM_MODE})`);
});
