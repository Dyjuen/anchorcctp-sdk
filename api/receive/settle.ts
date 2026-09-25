// api/receive/settle.ts
// POST /api/receive/settle — deployed wrapper (spec §4/§6). Runs the whole mint
// transport in one invocation (≤300s, Hobby ceiling — see vercel.json); the
// handler owns the intent binding, the replay guard and the settle rate bucket.

import { handleSettle } from '../../apps/demo/server/handlers.js';
import type { HandlerDeps } from '../../apps/demo/server/handlers.js';
import {
  jsonResponse,
  methodNotAllowed,
  readJsonObject,
  requestIp,
  serverlessDeps,
  serverlessHeaders,
} from '../../apps/demo/server/serverless.js';
import type { SecurityHeaders } from '../../apps/demo/server/serverless.js';

/** Injection seam: the deployed `fetch` below is this with env-built deps + headers. */
export function createHandler(deps: HandlerDeps, headers: SecurityHeaders) {
  return async function fetchSettle(request: Request): Promise<Response> {
    const body = await readJsonObject(request);
    const result = await handleSettle({ ...body, ip: requestIp(request) }, deps);
    return jsonResponse(result, headers);
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    return createHandler(serverlessDeps(), serverlessHeaders())(request);
  },
};
