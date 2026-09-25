/**
 * Real `rpc.Server` → `SorobanTransport` adapter (B3/B4) — re-exported from core.
 *
 * R9 moved the single implementation into `packages/core/src/env-rpc.ts` so the
 * scripts, the env factory (`createAnchorCCTPFromEnv`) and the serverless settle
 * path all share one passphrase-threaded adapter (no testnet default). This module
 * stays as the scripts' entry point and keeps the sequence warning below.
 *
 * SEQUENCE WARNING (verified against @stellar/stellar-sdk 13.3.0):
 * `rpc.Server.prepareTransaction`/`assembleTransaction` do NOT take the source
 * account's sequence number from the simulation response. `assembleTransaction`
 * rebuilds via `TransactionBuilder.cloneFrom(raw, …)`, which copies the input
 * transaction's sequence verbatim (lib/rpc/transaction.js:36-40 →
 * lib/stellar-base/lib/transaction_builder.js:663,669). The simulation response
 * carries no sequence at all (lib/rpc/api.d.ts:257-264).
 * → Callers MUST read the sponsor's real account sequence from chain
 *   (`horizon.loadAccount(sponsor).sequence` or `rpc.Server.getAccount(sponsor)`)
 *   and pass it as `sourceSequence`. `'0'` yields account sequence 1 and the
 *   network rejects the transaction.
 */
export { createSorobanTransport } from '../packages/core/src/env-rpc.js';
