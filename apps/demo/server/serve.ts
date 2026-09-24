// apps/demo/server/serve.ts
// Node HTTP server: SSE stream, POST receive:initiate, GET config.
// ponytail: server-only, esbuild bundles to dist-server/serve.cjs.

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { normalizeBurnTxHash, assertSupportedDomain, FileReplayStore, createAnchorCCTPFromEnv } from '@anchor-cctp/core-sdk';
import { validateEventParams, publicConfigBundle, SimTimeline, postInitiate, gateRealStream, createIntentStore, createRealGate, RateLimitBuckets, collectSseReal } from './events.js';
import { StrKey } from '@stellar/stellar-sdk';

// ─── Env ─────────────────────────────────────────────────────────────────────

const env = process.env as Record<string, string | undefined>;
const SIM_MODE = (env.SIM_MODE ?? 'false').toLowerCase() === 'true';
const PORT = Number(env.PORT ?? '3001');
const REPLAY_STORE_PATH = env.REPLAY_STORE_PATH ?? './data/replay.json';

// fail-fast: real mode requires STELLAR_SECRET
if (!SIM_MODE && !env.STELLAR_SECRET) {
  throw new Error('STELLAR_SECRET required in real mode (SIM_MODE=false)');
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
  cctpClient = createAnchorCCTPFromEnv(process.env as Record<string, string | undefined>);
}

// ─── Origin Allowlist ────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://demo.anchorcctp.com',
];

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

function getIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const ip = Array.isArray(xff) ? xff[0] : xff;
  return ip ?? req.socket.remoteAddress ?? 'unknown';
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // ─── GET /api/config ─────────────────────────────────────────────
  if (method === 'GET' && url.startsWith('/api/config')) {
    setApiHeaders(res);
    return jsonRes(res, 200, publicConfigBundle(env));
  }

  // ─── POST /api/receive:initiate ──────────────────────────────────
  if (method === 'POST' && url.startsWith('/api/receive:initiate')) {
    setApiHeaders(res);
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { parsed = undefined; }
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
    const cleanup = () => { clearInterval(keepalive); activeReceives.count = Math.max(0, activeReceives.count - 1); };
    req.on('close', cleanup);
    try {
      const events = await collectSseReal(validated, {
        store: replayStore,
        clientFactory: () => cctpClient!.client,
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
  jsonRes(res, 404, { error: { code: 'NOT_FOUND', remediation: 'Use GET /api/events, GET /api/config, or POST /api/receive:initiate.' } });
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
