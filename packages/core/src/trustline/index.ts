import { TrustlineMissingError, TrustlineCreationError } from '../errors/index.js';
import { TransactionBuilder, Networks, Account, Operation, Asset } from '@stellar/stellar-sdk';

export const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export interface EnsureTrustlineParams {
  destination: string;
  asset?: string;
  allowCreation: boolean;
  spendCapXlm?: number;
  requiredReserveXlm?: number;
  hasTrustline: () => Promise<boolean>;
  createTrustline?: (xdr: string) => Promise<string>;
  usdcIssuer?: string;
  networkPassphrase?: string;
}

export function buildChangeTrustXdr(
  destination: string,
  usdcIssuer: string = TESTNET_USDC_ISSUER,
  networkPassphrase: string = Networks.TESTNET
): string {
  const source = new Account(destination, '0');
  const tx = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset('USDC', usdcIssuer),
      })
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

/**
 * Checks for the presence of a USDC trustline and conditionally initiates opt-in creation with spending cap validation.
 */
export async function ensureTrustline(
  params: EnsureTrustlineParams
): Promise<{ created: boolean }> {
  const exists = await params.hasTrustline();
  if (exists) {
    return { created: false };
  }

  if (!params.allowCreation) {
    throw new TrustlineMissingError(params.destination);
  }

  // C8: spendCapXlm required, finite, >= 0 when allowCreation true
  if (params.spendCapXlm === undefined || !Number.isFinite(params.spendCapXlm) || (params.spendCapXlm as number) < 0) {
    throw new TrustlineCreationError(
      params.destination,
      'spendCapXlm is required, must be finite, and >= 0 when allowCreation is true.'
    );
  }

  // O9: clamp requiredReserve to min 0.5
  const requiredReserve = Math.max(params.requiredReserveXlm ?? 0.5, 0.5);
  if (requiredReserve > (params.spendCapXlm as number)) {
    throw new TrustlineCreationError(
      params.destination,
      `Required reserve of ${requiredReserve} XLM exceeds configured spendCapXlm of ${params.spendCapXlm} XLM.`
    );
  }

  // O9: usdcIssuer required (no silent testnet default on mainnet)
  if (!params.usdcIssuer) {
    throw new TrustlineCreationError(
      params.destination,
      'usdcIssuer is required (no silent testnet default).'
    );
  }

  if (!params.createTrustline) {
    throw new TrustlineCreationError(
      params.destination,
      'Trustline creation is enabled but no createTrustline callback was provided.'
    );
  }

  try {
    const xdr = buildChangeTrustXdr(
      params.destination,
      params.usdcIssuer,
      params.networkPassphrase || Networks.TESTNET
    );
    await params.createTrustline(xdr);
    return { created: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new TrustlineCreationError(params.destination, reason);
  }
}
