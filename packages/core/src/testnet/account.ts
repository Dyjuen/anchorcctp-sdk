import { TESTNET_USDC_ISSUER } from '../trustline/index.js';

export interface AccountState {
  exists: boolean;
  funded: boolean;
  hasTrustline: boolean;
  usdcBalance: string;
}

export interface ReadAccountStateParams {
  horizonUrl: string;
  address: string;
  usdcIssuer?: string;
  fetchImpl?: typeof fetch;
}

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

/** Reads funding + USDC trustline/balance state for one Stellar account. 404 = missing. */
export async function readAccountState(params: ReadAccountStateParams): Promise<AccountState> {
  if (!/^https:\/\//.test(params.horizonUrl)) {
    throw new Error('horizonUrl must be https');
  }
  const missing: AccountState = { exists: false, funded: false, hasTrustline: false, usdcBalance: '0' };
  const issuer = params.usdcIssuer ?? TESTNET_USDC_ISSUER;
  const encoded = encodeURIComponent(params.address);
  const res = await (params.fetchImpl ?? fetch)(
    `${params.horizonUrl.replace(/\/$/, '')}/accounts/${encoded}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (res.status === 404) return missing;
  if (!res.ok) throw new Error(`Horizon account read failed: ${res.status}`);
  const body = (await res.json()) as { balances?: HorizonBalance[] };
  const balances = body.balances ?? [];
  const native = balances.find((b) => b.asset_type === 'native');
  const usdc = balances.find(
    (b) => b.asset_type !== 'native' && b.asset_code === 'USDC' && b.asset_issuer === issuer
  );
  return {
    exists: true,
    funded: native !== undefined && Number(native.balance) > 0,
    hasTrustline: usdc !== undefined,
    usdcBalance: usdc?.balance ?? '0',
  };
}
