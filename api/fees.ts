// api/fees.ts
// GET /api/fees — deployed wrapper (spec §4/§6). Quotes the requested finality
// tier from Iris; the base URL is server-side config, never caller-supplied.

import { handleFees } from '../apps/demo/server/handlers.js';
import type { HandlerDeps } from '../apps/demo/server/handlers.js';
import {
  jsonResponse,
  methodNotAllowed,
  queryInput,
  requestIp,
  serverlessDeps,
  serverlessHeaders,
} from '../apps/demo/server/serverless.js';
import type { SecurityHeaders } from '../apps/demo/server/serverless.js';

/** Injection seam: the deployed `fetch` below is this with env-built deps + headers. */
export function createHandler(deps: HandlerDeps, headers: SecurityHeaders) {
  return async function fetchFees(request: Request): Promise<Response> {
    const result = await handleFees({ ...queryInput(request), ip: requestIp(request) }, deps);
    return jsonResponse(result, headers);
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    return createHandler(serverlessDeps(), serverlessHeaders())(request);
  },
};
