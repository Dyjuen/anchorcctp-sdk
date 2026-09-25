# Vercel API

For contributors and deployers: where the demo settlement runs.

The SPA build is static. Settlement runs as Vercel Functions under repo root `api/`. Each function wraps the framework free handlers in `apps/demo/server/handlers.ts`.

| Route | File | Use |
|---|---|---|
| `GET /api/config` | `api/config.ts` | Public config for the portal |
| `GET /api/fees` | `api/fees.ts` | Fee quote |
| `POST /api/receive/initiate` | `api/receive/initiate.ts` | Start a deposit |
| `GET /api/receive/status` | `api/receive/status.ts` | Short poll status, max duration 30 seconds |
| `POST /api/receive/settle` | `api/receive/settle.ts` | Settle, max duration 300 seconds |

Server env only, never prefixed with `VITE_` so nothing ships to the browser: `KV_REST_API_URL` plus `KV_REST_API_TOKEN` for Upstash, `STELLAR_SECRET` for real mode, `CIRCLE_ATTESTATION_BASE_URL` set explicitly per network, plus `HORIZON_URL` and `SOROBAN_RPC_URL`.

Hobby plan caps each invocation at 300 seconds. Each call here finishes well inside that limit. Waiting happens client side across polls, never inside one long invocation.

If functions fail at cold start, confirm the KV vars exist. If settlement uses the wrong network, confirm the Iris URL matches Horizon and RPC.

Next: [Evidence](../evidence) for deployment records.
