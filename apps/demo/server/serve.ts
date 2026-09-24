// apps/demo/server/serve.ts
// Node HTTP server: SSE stream, POST receive:initiate, GET config.
// ponytail: server-only, esbuild bundles to dist-server/serve.cjs.

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { normalizeBurnTxHash, assertSupportedDomain, FileReplayStore } from '@anchor-cctp/core-sdk';
import { validateEventParams, publicConfigBundle, SimTimeline } from './events.js';

const require = createRequire(import.meta.url);
const { StrKey } = require('@stellar/stellar-sdk') as typeof import('@stellar/stellar-sdk');

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
    const origin = req.headers.origin;
    const originStr = Array.isArray(origin) ? origin[0] : origin;
    if (!originStr || !ALLOWED_ORIGINS.includes(originStr)) {
      return jsonRes(res, 403, { error: { code: 'FORBIDDEN', remediation: 'Request from disallowed origin.' } });
    }
    // ponytail: real mint logic deferred to Task 6
    return jsonRes(res, 200, { ok: true });
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

    // real mode: ponytail — full SSE with attestation polling deferred to Task 6
    res.write(`data: ${JSON.stringify({ type: 'error', code: 'NOT_IMPLEMENTED', remediation: 'Real mode SSE pending Task 6.' })}\n\n`);
    res.end();
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

server.listen(PORT, () => {
  console.log(`[events] listening on http://localhost:${PORT} (sim=${SIM_MODE})`);
});
