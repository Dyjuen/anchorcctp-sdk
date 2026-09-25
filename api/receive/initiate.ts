// api/receive/initiate.ts
// POST /api/receive/initiate — deployed wrapper (spec §4/§6). Records the intent
// (hash bound to address + amount + mode); the handler validates everything.

import { handleInitiate } from '../../apps/demo/server/handlers.js';
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
  return async function fetchInitiate(request: Request): Promise<Response> {
    const body = await readJsonObject(request);
    const origin = request.headers.get('origin');
    const result = await handleInitiate(
      { ...body, ...(origin === null ? {} : { origin }), ip: requestIp(request) },
      deps,
    );
    return jsonResponse(result, headers);
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    return createHandler(serverlessDeps(), serverlessHeaders())(request);
  },
};
