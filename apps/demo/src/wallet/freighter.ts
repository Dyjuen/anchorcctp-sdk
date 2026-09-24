import * as freighter from '@stellar/freighter-api';
import { StrKey } from '@stellar/stellar-sdk';
import { loadNetworkConfig } from '../config/network.js';

export interface WalletState {
  connected: boolean;
  address: string | null;
  network?: string;
  error?: string;
  isSimulated?: boolean;
  needsInstall?: boolean;
  balances?: Array<{ asset_type: string; balance: string }>;
  networkPassphrase?: string;
}

export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected: connected } = await freighter.isConnected();
    return connected;
  } catch {
    return false;
  }
}

export async function connectFreighter(opts?: { allowSimulated?: boolean }): Promise<WalletState> {
  try {
    const { isConnected: connected, error } = await freighter.isConnected();

    if (error) {
      throw new Error(error);
    }

    if (!connected) {
      if (opts?.allowSimulated) {
        return {
          connected: true,
          address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          network: 'TESTNET',
          isSimulated: true,
        };
      }
      return {
        connected: false,
        address: null,
        error: 'Freighter not installed. Install from freighter.app',
      };
    }

    const { isAllowed } = await import('@stellar/freighter-api');
    const allowed = await isAllowed();
    if (!allowed) {
      const { setAllowed } = await import('@stellar/freighter-api');
      await setAllowed();
    }

    const { getAddress } = await import('@stellar/freighter-api');
    const { address, error: addrError } = await getAddress();
    if (addrError || !address) {
      return {
        connected: false,
        address: null,
        error: addrError || 'User denied access or wallet is locked',
      };
    }

    // Verify network passphrase (must match STELLAR_NETWORK_PASSPHRASE)
    const { getNetworkPassphrase } = await import('@stellar/freighter-api');
    const networkPassphrase = await getNetworkPassphrase();
    const expectedPassphrase =
      (import.meta as any).env?.VITE_STELLAR_NETWORK_PASSPHRASE ??
      'Test SDF Network ; September 2015';

    if (networkPassphrase !== expectedPassphrase) {
      return {
        connected: false,
        address,
        networkPassphrase,
        error: `Network mismatch: wallet on ${networkPassphrase}, expected ${expectedPassphrase}`,
      };
    }

    // Fetch balances via Horizon
    const balanceInfo = await fetchBalances(address);

    return {
      connected: true,
      address,
      networkPassphrase,
      balances: balanceInfo,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      address: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sign a transaction with Freighter.
 * Throws with an actionable error if the user rejects or the network mismatches.
 */
export async function signWithFreighter(
  xdr: string,
  networkPassphrase: string = 'Test SDF Network ; September 2015'
): Promise<string> {
  const { signTransaction, getNetworkPassphrase } = await import('@stellar/freighter-api');

  const currentPassphrase = await getNetworkPassphrase();
  if (currentPassphrase !== networkPassphrase) {
    throw new Error(`Network mismatch: wallet on ${currentPassphrase}, expected ${networkPassphrase}`);
  }

  const result = await signTransaction(xdr, {
    networkPassphrase,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.signedTxXdr;
}

/**
 * Verify destination account exists and has a funded XLM balance.
 * Returns the current XLM and USDC balances.
 */
export async function verifyAccountFunded(
  address: string,
  horizonUrl = 'https://horizon-testnet.stellar.org'
): Promise<{ xlm: string; usdc: string; exists: boolean }> {
  try {
    const balances = await getAccountBalances(address, horizonUrl);
    const xlmBalance =
      balances.find((b) => b.asset_type === 'native')?.balance ?? '0';
    const usdcBalance =
      balances.find(
        (b) =>
          b.asset_type !== 'native' &&
          'asset_code' in b &&
          (b as any).asset_code === 'USDC'
      )?.balance ?? '0';

    return { xlm: xlmBalance, usdc: usdcBalance, exists: true };
  } catch {
    throw new Error(`Account unfunded: send testnet XLM from friendbot.stellar.org to ${address}`);
  }
}

export async function getAccountBalances(address: string, horizonUrl: string): Promise<Array<{ asset_type: string; balance: string }>> {
  if (!horizonUrl.startsWith('https://')) {
    throw new Error('Horizon URL must use https');
  }
  const res = await fetch(`${horizonUrl}/accounts/${encodeURIComponent(address)}`);
  if (res.status === 404) {
    throw new Error(`Account unfunded: send testnet XLM from friendbot.stellar.org to ${address}`);
  }
  if (!res.ok) {
    throw new Error(`Horizon request failed (${res.status})`);
  }
  const data = await res.json();
  return data.balances;
}

/** Throw if wallet's network passphrase doesn't match expected. */
export async function checkNetworkMatch(expectedPassphrase: string): Promise<void> {
  const { getNetwork } = await import('@stellar/freighter-api');
  const res = (await getNetwork()) as { networkPassphrase?: string; error?: string };
  if (res.error) throw new Error(res.error);
  if (res.networkPassphrase !== expectedPassphrase) {
    throw new Error(`Network mismatch: wallet on ${res.networkPassphrase ?? 'unknown'}, expected ${expectedPassphrase}`);
  }
}

/** Fetch account balances from Horizon using configured URL. Validates address first. */
export async function fetchBalances(address: string): Promise<Array<{ asset_type: string; balance: string }>> {
  if (!StrKey.isValidEd25519PublicKey(address.trim())) throw new Error('Invalid address');
  const { horizonUrl } = loadNetworkConfig();
  return getAccountBalances(address.trim(), horizonUrl);
}
