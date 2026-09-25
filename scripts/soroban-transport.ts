/**
 * Real `rpc.Server` → `SorobanTransport` adapter (B3/B4).
 *
 * The adapter lives at the call sites (scripts, server handlers) — never inside
 * core. Core stays transport-injected so its unit suite never touches a network.
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
import { Networks, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import type { SorobanTransport } from '../packages/core/src/forwarder/index.js';

export function createSorobanTransport(
  server: rpc.Server,
  networkPassphrase: string = Networks.TESTNET
): SorobanTransport {
  return {
    simulateTransaction: async (xdr) =>
      server.simulateTransaction(TransactionBuilder.fromXDR(xdr, networkPassphrase)),
    assembleTransaction: (xdr, sim) =>
      rpc
        .assembleTransaction(
          TransactionBuilder.fromXDR(xdr, networkPassphrase),
          sim as rpc.Api.SimulateTransactionResponse
        )
        .build()
        .toXDR(),
    sendTransaction: async (signedXdr) => {
      const sent = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
      );
      return { status: sent.status, hash: sent.hash };
    },
    getTransaction: async (hash) => {
      const got = await server.getTransaction(hash);
      return { status: got.status };
    },
  };
}
