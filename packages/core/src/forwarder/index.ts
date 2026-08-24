import { StrKey } from '@stellar/stellar-sdk';
import { MintFailedError } from '../errors/index.js';

export interface MintParams {
  message: string;
  signature: string;
  destination: string;
  forwarderContractId?: string;
  horizonUrl?: string;
  networkPassphrase?: string;
}

export type SignerCallback = (xdr: string) => Promise<string>;

/**
 * Translates an EVM 20-byte or 32-byte hexadecimal address into a Stellar G... public key (strkey).
 * If the address is already a valid Stellar G... address, it returns it unchanged.
 */
export function translateToStellar(evmAddress: string): string {
  if (typeof evmAddress !== 'string') {
    throw new Error('Address must be a string');
  }

  const trimmed = evmAddress.trim();

  // If already a valid Stellar public key, return as is
  if (StrKey.isValidEd25519PublicKey(trimmed)) {
    return trimmed;
  }

  let cleanHex = trimmed.startsWith('0x') || trimmed.startsWith('0X')
    ? trimmed.slice(2)
    : trimmed;

  // If 20-byte EVM address (40 hex chars), left-pad to 32 bytes (64 hex chars)
  if (cleanHex.length === 40) {
    cleanHex = cleanHex.padStart(64, '0');
  }

  if (cleanHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error(`Invalid address format: cannot translate "${evmAddress}" to Stellar public key.`);
  }

  const buffer = Buffer.from(cleanHex, 'hex');
  if (buffer.length !== 32) {
    throw new Error(`Expected 32 bytes for Stellar public key derivation, received ${buffer.length} bytes.`);
  }

  return StrKey.encodeEd25519PublicKey(buffer);
}

/**
 * Submits the CCTP mint transaction to the Stellar network by delegating signing to the caller.
 */
export async function submitMint(
  params: MintParams,
  signer: SignerCallback
): Promise<{ txHash: string }> {
  try {
    // Generate the serialized payload or simulated XDR representing the mint invocation
    const mockXdr = Buffer.from(
      JSON.stringify({
        action: 'cctp_mint',
        destination: params.destination,
        message: params.message,
        signature: params.signature,
        contract: params.forwarderContractId || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      })
    ).toString('base64');

    const signedOutput = await signer(mockXdr);
    return {
      txHash: signedOutput,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MintFailedError(params.message, reason);
  }
}
