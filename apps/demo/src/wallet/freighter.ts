import * as freighter from '@stellar/freighter-api';

export interface WalletState {
  connected: boolean;
  address: string | null;
  network?: string;
  error?: string;
  isSimulated?: boolean;
  needsInstall?: boolean;
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
        error: 'Freighter not installed — install from freighter.app',
        needsInstall: true,
      };
    }

    const addressResult = await freighter.getAddress();

    if (addressResult.error || !addressResult.address) {
      return {
        connected: false,
        address: null,
        error: addressResult.error || 'User declined wallet connection',
      };
    }

    const networkResult = await freighter.getNetwork();

    return {
      connected: true,
      address: addressResult.address,
      network: networkResult.networkPassphrase,
      isSimulated: false,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      address: null,
      error: err instanceof Error ? err.message : 'Failed to connect to Freighter wallet.',
    };
  }
}

export async function signWithFreighter(
  xdr: string,
  expectedPassphrase: string = 'Test SDF Network ; September 2015',
): Promise<string> {
  const { signedTxXdr, error } = await freighter.signTransaction(xdr, {
    networkPassphrase: expectedPassphrase,
  });

  if (error || !signedTxXdr) {
    throw new Error(`Freighter signing rejected: ${error || 'empty response'}`);
  }

  return signedTxXdr;
}

export async function checkNetworkMatch(expectedPassphrase: string): Promise<void> {
  const { networkPassphrase, error } = await freighter.getNetwork();
  if (error) throw new Error(`Failed to read wallet network: ${error}`);
  if (networkPassphrase !== expectedPassphrase) {
    throw new Error(`Network mismatch — wallet on ${networkPassphrase}, expected ${expectedPassphrase}`);
  }
}

export async function getAccountBalances(address: string, horizonUrl: string): Promise<Array<{ asset_type: string; balance: string }>> {
  if (!horizonUrl.startsWith('https://')) {
    throw new Error('Horizon URL must use https');
  }
  const res = await fetch(`${horizonUrl}/accounts/${address}`);
  if (res.status === 404) {
    throw new Error(`Account unfunded — send testnet XLM from friendbot.stellar.org to ${address}`);
  }
  if (!res.ok) {
    throw new Error(`Horizon request failed (${res.status})`);
  }
  const data = await res.json();
  return data.balances;
}
