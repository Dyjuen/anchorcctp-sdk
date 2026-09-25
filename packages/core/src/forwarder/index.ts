import { StrKey, Contract, TransactionBuilder, Networks, Account, nativeToScVal } from '@stellar/stellar-sdk';
import { MintFailedError, ForwarderContractError, InvalidConfigError, InvalidAddressError } from '../errors/index.js';

export interface MintParams {
  message: string;
  signature: string;
  forwarderContractId?: string;
  horizonUrl?: string;
  networkPassphrase?: string;
  sourceSequence?: string;
  /**
   * O15/B2: Sponsor account used as transaction source. Required — the Stellar
   * recipient travels inside `hookData` (Task 1), so the two-arg
   * `mint_and_forward(message, attestation)` has no destination to fall back to.
   */
  sourceAccount: string;
}

export type SignerCallback = (xdr: string) => Promise<string>;

export const TESTNET_FORWARDER = 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ';
export const MAINNET_FORWARDER = 'CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T';
export const DEFAULT_FORWARDER = TESTNET_FORWARDER;

export function resolveForwarder(network?: 'testnet' | 'mainnet'): string {
  if (network === 'mainnet') return MAINNET_FORWARDER;
  if (network === 'testnet') return TESTNET_FORWARDER;
  throw new InvalidConfigError('network required: "testnet" | "mainnet" (no silent testnet default).');
}

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0 || clean.length === 0) {
    throw new ForwarderContractError('input', 'Invalid hex: charset+even-length required.');
  }
  return Buffer.from(clean, 'hex');
}

/**
 * Builds a real Stellar Soroban XDR transaction that calls mint_and_forward on the forwarder contract.
 */
export function buildMintAndForwardXdr(params: MintParams): string {
  const contractId = params.forwarderContractId || DEFAULT_FORWARDER;
  const passphrase = params.networkPassphrase || Networks.TESTNET;

  // O15/B2: sourceAccount is required — no destination fallback exists any more.
  if (!params.sourceAccount || !StrKey.isValidEd25519PublicKey(params.sourceAccount)) {
    throw new InvalidAddressError(params.sourceAccount ?? '', 'sourceAccount is required and must be a valid G... StrKey');
  }

  try {
    const source = new Account(params.sourceAccount, params.sourceSequence ?? '0');
    const contract = new Contract(contractId);
    // B2: Circle's mint_and_forward(message: Bytes, attestation: Bytes) — recipient
    // lives in the 88-byte hookData carried by `message`, not in a third argument.
    const op = contract.call(
      'mint_and_forward',
      nativeToScVal(hexToBytes(params.message)),
      nativeToScVal(hexToBytes(params.signature)),
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
    if (err instanceof InvalidAddressError) throw err;
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
    throw new InvalidAddressError(String(evmAddress), 'Address must be a string');
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
    throw new InvalidAddressError(evmAddress, 'cannot translate to Stellar public key');
  }

  const buffer = Buffer.from(cleanHex, 'hex');
  if (buffer.length !== 32) {
    throw new InvalidAddressError(evmAddress, `expected 32 bytes, received ${buffer.length}`);
  }

  // Reject zero addresses (20 or 32 byte)
  if (buffer.every(b => b === 0)) {
    throw new InvalidAddressError(evmAddress, 'zero address not allowed');
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
    if (error instanceof ForwarderContractError || error instanceof InvalidAddressError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new MintFailedError(params.message, reason);
  }
}
