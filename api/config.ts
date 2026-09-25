// api/config.ts
// GET /api/config — deployed wrapper (spec §4/R11). Serves the same public bundle
// the local server serves, plus `transferModes` and the server-side `fastWindowMs`.

import { publicConfigBundle } from '../apps/demo/server/events.js';
import {
  jsonResponse,
  methodNotAllowed,
  serverlessDeps,
  serverlessHeaders,
} from '../apps/demo/server/serverless.js';
import type { SecurityHeaders } from '../apps/demo/server/serverless.js';

/** Injection seam: the deployed `fetch` below is this with the real env + headers. */
export function createHandler(env: Record<string, string | undefined>, headers: SecurityHeaders) {
  return async function fetchConfig(_request: Request): Promise<Response> {
    return jsonResponse({ status: 200, body: publicConfigBundle(env) }, headers);
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    // Same cold-start env validation as the other routes: a misconfigured deploy
    // fails loudly instead of half-serving a bundle.
    serverlessDeps();
    return createHandler(process.env, serverlessHeaders())(request);
  },
};
