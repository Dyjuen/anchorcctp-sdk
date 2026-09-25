// apps/demo/server/serverless.ts
// Plumbing shared by the deployed Vercel entrypoints (repo-root `api/*`): the
// cold-start env validation, this deployment's security headers, and the
// `{ status, body }` → Response adapter. Transport only — every handler, every
// validation and every rate bucket lives in handlers.ts/kv.ts (spec §6).
// ponytail: server-only module — never bundled for browser.

import { buildCsp, NO_STORE, redact, trustedClientIp } from './handlers.js';
import type { HandlerDeps, HandlerResult } from './handlers.js';
import { depsFromEnv } from './kv.js';
import type { EnvDeps } from './kv.js';

export type SecurityHeaders = Record<string, string>;

let cachedDeps: EnvDeps | null = null;

/**
 * Real-mode deps for the deployed API, validated once per function instance (the
 * serverless cold start). `depsFromEnv` refuses to build without the KV REST
 * credentials or the sponsor secret, and `assertColdStartEnv` refuses a missing /
 * cross-network `CIRCLE_ATTESTATION_BASE_URL` — nothing here falls back silently.
 */
export function serverlessDeps(env: Record<string, string | undefined> = process.env): EnvDeps {
  if ((env.SIM_MODE ?? 'false').toLowerCase() === 'true') {
    throw new Error('SIM_MODE is local-only: the deployed API runs real mode (SIM_MODE=false).');
  }
  // The process env is the one instance-wide env: build it once. An explicitly
  // passed env (tests, tooling) is always built fresh so it can fail loudly.
  if (env !== process.env) return depsFromEnv(env);
  return (cachedDeps ??= depsFromEnv(env));
}

/**
 * Security headers for this deployment (spec §6): the same `buildCsp` definition as
 * `serve.ts`, with `connect-src` extended to this deployment's API origin + Iris +
 * Horizon/RPC. Falling back to the no-argument form would ship the local-only CSP
 * to the deployed origin and break the UI.
 */
export function serverlessHeaders(
  env: Record<string, string | undefined> = process.env,
): SecurityHeaders {
  return {
    'Content-Security-Policy': buildCsp({
      apiOrigin: env.API_ORIGIN ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined),
      irisBaseUrl: env.CIRCLE_ATTESTATION_BASE_URL,
      horizonUrl: env.HORIZON_URL,
      sorobanRpcUrl: env.SOROBAN_RPC_URL,
    }),
    'Cache-Control': NO_STORE,
    'X-Content-Type-Options': 'nosniff',
  };
}

/**
 * The handler's `{ status, body }` goes out unchanged. The handler's own headers are
 * deliberately not copied: they carry the local-only CSP default, and the deployment
 * CSP (Iris + Horizon/RPC + API origin in `connect-src`) must win on the deployed origin.
 */
export function jsonResponse(
  result: Pick<HandlerResult, 'status' | 'body'>,
  headers: SecurityHeaders,
): Response {
  return Response.json(result.body, { status: result.status, headers });
}

/** A handler throw becomes this: a structured, retryable code — never a bare 500. */
export const HANDLER_FAILED: { status: number; body: unknown } = {
  status: 500,
  body: {
    error: {
      code: 'RECEIVE_FAILED',
      remediation: 'The API hit an unexpected error. Retry shortly.',
    },
  },
};

/**
 * Runs one handler call and turns any throw into {@link HANDLER_FAILED} — so an
 * Upstash/RPC/Iris outage on a money-moving route still answers with a code the
 * client can act on *and* this deployment's security headers, instead of Vercel's
 * header-less `FUNCTION_INVOCATION_FAILED` 500 (spec §6/§8). A handler's own
 * `{ status, body }` — success or structured failure — passes through untouched.
 *
 * Only the cold-start env build (`serverlessDeps`) stays outside this guard: a
 * misconfigured instance must fail loudly, not answer a tidy error (spec §6).
 */
export async function respondWith(
  run: () => Promise<Pick<HandlerResult, 'status' | 'body'>>,
  headers: SecurityHeaders,
): Promise<Response> {
  try {
    return jsonResponse(await run(), headers);
  } catch (error) {
    // Server-side only, and redacted: no secret may reach a log line either.
    console.error(
      '[api] handler threw:',
      redact(error instanceof Error ? error.message : String(error)),
    );
    return jsonResponse(HANDLER_FAILED, headers);
  }
}

export function methodNotAllowed(allow: string): Response {
  return Response.json(
    { error: { code: 'METHOD_NOT_ALLOWED', remediation: `Use ${allow}.` } },
    { status: 405, headers: { ...serverlessHeaders(), Allow: allow } },
  );
}

/** Rate buckets key on Vercel's trusted `x-real-ip` only (see handlers.ts). */
export function requestIp(request: Request): string {
  return trustedClientIp(Object.fromEntries(request.headers));
}

/**
 * Parsed JSON body, or `{}` when the body is absent/malformed/not an object — the
 * handler then answers 400 INVALID_PARAMS, so field validation stays in one place.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** A request's query string as the flat input the handlers take. */
export function queryInput(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

export type { EnvDeps, HandlerDeps };
