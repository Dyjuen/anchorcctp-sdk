// api/receive/status.ts
// GET /api/receive/status — deployed wrapper (spec §4/§6). Read-only: the handler
// does one replay lookup + at most one Iris probe and never mints.

import { handleStatus } from '../../apps/demo/server/handlers.js';
import type { HandlerDeps } from '../../apps/demo/server/handlers.js';
import {
  methodNotAllowed,
  queryInput,
  requestIp,
  respondWith,
  serverlessDeps,
  serverlessHeaders,
} from '../../apps/demo/server/serverless.js';
import type { SecurityHeaders } from '../../apps/demo/server/serverless.js';

/** Injection seam: the deployed `fetch` below is this with env-built deps + headers. */
export function createHandler(deps: HandlerDeps, headers: SecurityHeaders) {
  return async function fetchStatus(request: Request): Promise<Response> {
    return respondWith(
      () => handleStatus({ ...queryInput(request), ip: requestIp(request) }, deps),
      headers,
    );
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    return createHandler(serverlessDeps(), serverlessHeaders())(request);
  },
};
