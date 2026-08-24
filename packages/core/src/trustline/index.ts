import { TrustlineMissingError, TrustlineCreationError } from '../errors/index.js';

export interface EnsureTrustlineParams {
  destination: string;
  asset?: string;
  allowCreation: boolean;
  spendCapXlm?: number;
  requiredReserveXlm?: number;
  hasTrustline: () => Promise<boolean>;
  createTrustline?: (xdr: string) => Promise<string>;
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

  const requiredReserve = params.requiredReserveXlm ?? 0.5;
  if (params.spendCapXlm !== undefined && requiredReserve > params.spendCapXlm) {
    throw new TrustlineCreationError(
      params.destination,
      `Required reserve of ${requiredReserve} XLM exceeds configured spendCapXlm of ${params.spendCapXlm} XLM.`
    );
  }

  if (!params.createTrustline) {
    throw new TrustlineCreationError(
      params.destination,
      'Trustline creation is enabled but no createTrustline callback was provided.'
    );
  }

  try {
    const mockXdr = Buffer.from(
      JSON.stringify({
        action: 'change_trust',
        destination: params.destination,
        asset: params.asset || 'USDC',
      })
    ).toString('base64');

    await params.createTrustline(mockXdr);
    return { created: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new TrustlineCreationError(params.destination, reason);
  }
}
