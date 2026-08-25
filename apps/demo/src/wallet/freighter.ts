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
    const isConnectedResult = await freighter.isConnected();
    return !!isConnectedResult;
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

    const keyResult = await freighter.getPublicKey();
    const address = typeof keyResult === 'string' ? keyResult : (keyResult as any)?.address || null;

    if (!address) {
      throw new Error('User declined wallet connection or no public key returned.');
    }

    return {
      connected: true,
      address,
      network: 'TESTNET',
      isSimulated: false,
    };
  } catch (err: any) {
    return {
      connected: false,
      address: null,
      error: err?.message || 'Failed to connect to Freighter wallet.',
    };
  }
}

export async function signWithFreighter(xdr: string): Promise<string> {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) {
      // Simulated signature for sandbox / demo mode
      return `MOCK_FREIGHTER_SIGNATURE_${Date.now()}_${Buffer.from(xdr.slice(0, 16)).toString('hex')}`;
    }

    const signResult = await freighter.signTransaction(xdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    const signedXdr = typeof signResult === 'string' ? signResult : (signResult as any)?.signedTxXdr || xdr;
    return signedXdr;
  } catch (err: any) {
    throw new Error(`Freighter signing rejected: ${err.message}`);
  }
}
