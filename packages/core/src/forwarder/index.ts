import { StrKey, Contract, TransactionBuilder, Networks, Account, Address, nativeToScVal } from '@stellar/stellar-sdk';
import { MintFailedError, ForwarderContractError } from '../errors/index.js';

export interface MintParams {
  message: string;
  signature: string;
  destination: string;
  forwarderContractId?: string;
  horizonUrl?: string;
  networkPassphrase?: string;
}

export type SignerCallback = (xdr: string) => Promise<string>;

export const DEFAULT_FORWARDER = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}

/**
 * Builds a real Stellar Soroban XDR transaction that calls mint_and_forward on the forwarder contract.
 */
export function buildMintAndForwardXdr(params: MintParams): string {
  const contractId = params.forwarderContractId || DEFAULT_FORWARDER;
  const passphrase = params.networkPassphrase || Networks.TESTNET;
  try {
    const source = new Account(params.destination, '0');
    const contract = new Contract(contractId);
    const op = contract.call(
      'mint_and_forward',
      nativeToScVal(hexToBytes(params.message)),
      nativeToScVal(hexToBytes(params.signature)),
      new Address(params.destination).toScVal()
    );
    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: passphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();
    return tx.toXDR();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ForwarderContractError(contractId, reason);
  }
}

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
    const xdr = buildMintAndForwardXdr(params);
    const signedOutput = await signer(xdr);
    return { txHash: signedOutput };
  } catch (error) {
    if (error instanceof ForwarderContractError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new MintFailedError(params.message, reason);
  }
}
