import * as freighter from '@stellar/freighter-api';

export interface WalletState {
  connected: boolean;
  address: string | null;
  network?: string;
  error?: string;
  isSimulated?: boolean;
}

export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected: connected } = await freighter.isConnected();
    return connected;
  } catch {
    return false;
  }
}

export async function connectFreighter(): Promise<WalletState> {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) {
      // Return simulated mock account for browser environments without Freighter extension
      return {
        connected: true,
        address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        network: 'TESTNET',
        isSimulated: true,
      };
    }

    const { address, error } = await freighter.getAddress();

    if (!address || error) {
      throw new Error('User declined wallet connection or no public key returned.');
    }

    return {
      connected: true,
      address,
      network: 'TESTNET',
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

export async function signWithFreighter(xdr: string): Promise<string> {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) {
      // Simulated signature for sandbox / demo mode
      const hex = Array.from(new TextEncoder().encode(xdr.slice(0, 16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `MOCK_FREIGHTER_SIGNATURE_${Date.now()}_${hex}`;
    }

    const { signedTxXdr, error } = await freighter.signTransaction(xdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    if (error || !signedTxXdr) return xdr;
    return signedTxXdr;
  } catch (err: unknown) {
    throw new Error(`Freighter signing rejected: ${err instanceof Error ? err.message : err}`, { cause: err });
  }
}
