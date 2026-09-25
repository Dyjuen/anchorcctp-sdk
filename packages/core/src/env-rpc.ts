import { Keypair, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { InvalidConfigError } from './errors/index.js';
import { SorobanTransport } from './forwarder/index.js';
import { TrustlineProvider } from './trustline/index.js';

/**
 * Real `rpc.Server` → `SorobanTransport` adapter (B3/B4).
 *
 * SEQUENCE WARNING (verified against @stellar/stellar-sdk 13.3.0):
 * `rpc.Server.prepareTransaction`/`assembleTransaction` do NOT take the source
 * account's sequence number from the simulation response. `assembleTransaction`
 * rebuilds via `TransactionBuilder.cloneFrom(raw, …)`, which copies the input
 * transaction's sequence verbatim. The simulation response carries no sequence.
 * → Callers MUST read the sponsor's real account sequence from chain and pass it
 *   as `sourceSequence`. `'0'` yields account sequence 1 and the network rejects
 *   the transaction.
 *
 * The passphrase is explicit: the XDR that core builds is encoded with the
 * deployment's network, never a testnet default.
 */
export function createSorobanTransport(
  server: rpc.Server,
  networkPassphrase: string
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

/** Horizon surface the trustline provider needs — narrow so tests can fake it. */
export interface HorizonTrustlineServer {
  loadAccount(addr: string): Promise<unknown>;
  submitTransaction(tx: unknown): Promise<{ hash: string }>;
}

export interface HorizonTrustlineProviderParams {
  horizon: HorizonTrustlineServer;
  /** Asset issuer the USDC trustline must name (no default — callers resolve it). */
  issuer: string;
  networkPassphrase: string;
  /** Deployment keypair that signs + submits the change-trust is on our own account. */
  keypair: Keypair;
}

/**
 * B5/R9: Horizon-backed trustline provider — the production path wired into
 * `createAnchorCCTPFromEnv`. `hasTrustline` inspects the account's USDC balance;
 * `createTrustline` signs only a single change-trust sourced from our own account.
 */
export function createHorizonTrustlineProvider(
  params: HorizonTrustlineProviderParams
): TrustlineProvider {
  return {
    async hasTrustline(addr: string): Promise<boolean> {
      let account: unknown;
      try {
        account = await params.horizon.loadAccount(addr);
      } catch {
        // Unfunded (404) account cannot hold a trustline.
        return false;
      }
      const balances =
        (account as { balances?: Array<{ asset_code?: string; asset_issuer?: string }> })
          .balances ?? [];
      return balances.some(
        (b) => b.asset_code === 'USDC' && b.asset_issuer === params.issuer
      );
    },
    async createTrustline(xdr: string): Promise<string> {
      const tx = TransactionBuilder.fromXDR(xdr, params.networkPassphrase) as unknown as {
        source: string;
        operations: Array<{ type: string }>;
        sign(kp: Keypair): void;
      };
      // O7-equivalent: refuse anything that is not one change-trust on our own account.
      if (tx.operations.length !== 1 || tx.operations[0].type !== 'changeTrust') {
        throw new InvalidConfigError(
          'trustline signer refused: XDR is not a single changeTrust operation'
        );
      }
      if (tx.source !== params.keypair.publicKey()) {
        throw new InvalidConfigError(
          `trustline signer refused: XDR source ${tx.source} is not the signing account`
        );
      }
      tx.sign(params.keypair);
      const res = await params.horizon.submitTransaction(tx);
      return res.hash;
    },
  };
}
