import { Keypair, Networks, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import { InvalidConfigError } from './errors/index.js';
import { AnchorCCTP, createAnchorCCTP } from './config.js';

/** Public-only testnet config. Never add secret fields here. */
export interface TestnetPublicConfig {
  network: 'testnet';
  horizonUrl: string;
  sorobanRpcUrl: string;
  attestationBaseUrl: string;
  forwarderContractId: string;
  usdcIssuer: string;
  destinationAddress: string;
  dustCollectorAddress?: string;
}

const SECRET_KEY_RE = /secret|private|seed|mnemonic|password|token/i;
const SECRET_VALUE_RE = /^S[A-Z2-7]{55}$/;

function isHttpsUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https:\/\/[^/]+/.test(v);
}

function isGAddress(v: unknown): v is string {
  return typeof v === 'string' && StrKey.isValidEd25519PublicKey(v);
}

function isContractId(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const withPrefix = (StrKey as unknown as { isValidContract?: (s: string) => boolean })
    .isValidContract;
  if (typeof withPrefix === 'function') return withPrefix(v);
  return /^C[A-Z2-7]{55}$/.test(v);
}

/**
 * Validates a parsed JSON value as public testnet config.
 * Rejects secret-like keys/values — secrets belong in env vars, never this file.
 */
export function parseTestnetConfig(json: unknown): TestnetPublicConfig {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new InvalidConfigError('root must be a JSON object');
  }
  const raw = json as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    if (SECRET_KEY_RE.test(k)) {
      throw new InvalidConfigError(`secret-like key "${k}" forbidden in public config`);
    }
    if (typeof v === 'string' && SECRET_VALUE_RE.test(v.trim())) {
      throw new InvalidConfigError(`secret-like value under "${k}" forbidden in public config`);
    }
  }
  if (raw.network !== 'testnet') throw new InvalidConfigError('network must be "testnet"');
  if (!isHttpsUrl(raw.horizonUrl)) throw new InvalidConfigError('horizonUrl must be https');
  if (!isHttpsUrl(raw.sorobanRpcUrl)) throw new InvalidConfigError('sorobanRpcUrl must be https');
  if (!isHttpsUrl(raw.attestationBaseUrl)) {
    throw new InvalidConfigError('attestationBaseUrl must be https');
  }
  if (!isContractId(raw.forwarderContractId)) {
    throw new InvalidConfigError('forwarderContractId must be a C... contract ID');
  }
  if (!isGAddress(raw.usdcIssuer)) throw new InvalidConfigError('usdcIssuer must be a G... address');
  if (!isGAddress(raw.destinationAddress)) {
    throw new InvalidConfigError('destinationAddress must be a G... address');
  }
  if (raw.dustCollectorAddress !== undefined && !isGAddress(raw.dustCollectorAddress)) {
    throw new InvalidConfigError('dustCollectorAddress must be a G... address');
  }
  return {
    network: 'testnet',
    horizonUrl: raw.horizonUrl,
    sorobanRpcUrl: raw.sorobanRpcUrl,
    attestationBaseUrl: raw.attestationBaseUrl,
    forwarderContractId: raw.forwarderContractId,
    usdcIssuer: raw.usdcIssuer,
    destinationAddress: raw.destinationAddress,
    ...(raw.dustCollectorAddress === undefined
      ? {}
      : { dustCollectorAddress: raw.dustCollectorAddress as string }),
  };
}

/** Reads + validates a public testnet JSON config file from disk (Node-only). */
export function loadTestnetConfigFromFile(path: string): TestnetPublicConfig {
  // ponytail: lazy Node fs via getBuiltinModule, no static node:fs import → browser bundle safe
  const proc = (globalThis as { process?: unknown }).process as
    | { getBuiltinModule?: (m: string) => { readFileSync(p: string, e: string): string } }
    | undefined;
  const fs = proc?.getBuiltinModule?.('node:fs');
  if (!fs) {
    throw new InvalidConfigError(`cannot read file ${path} in browser — use parseTestnetConfig instead`);
  }
  let text: string;
  try {
    text = fs.readFileSync(path, 'utf-8');
  } catch {
    throw new InvalidConfigError(`cannot read file ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidConfigError(`file ${path} is not valid JSON`);
  }
  return parseTestnetConfig(parsed);
}

/** Result of building an SDK client from environment variables. */
export interface EnvConfigResult {
  client: AnchorCCTP;
  destinationAddress: string;
  network: 'testnet' | 'mainnet';
  hasSigner: boolean;
  /** Validated Keypair when STELLAR_SECRET present; avoids re-derivation in callers. */
  keypair?: Keypair;
  /** Validated Soroban RPC URL when SOROBAN_RPC_URL env var is present and https. */
  sorobanRpcUrl?: string;
}

/**
 * Builds an SDK client from env vars (the secrets source of truth).
 * Public address configures receive/send identity; secret (if present) wires
 * a local Keypair signer. Never logs the secret.
 *
 * Vars: STELLAR_NETWORK (testnet|mainnet, default testnet),
 * STELLAR_DESTINATION|STELLAR_TESTNET_DESTINATION (required G...),
 * STELLAR_SECRET|STELLAR_TESTNET_SECRET (optional S...),
 * DUST_COLLECTOR_ADDRESS, FORWARDER_CONTRACT_ID, HORIZON_URL,
 * SOROBAN_RPC_URL, CIRCLE_ATTESTATION_BASE_URL,
 * TRUSTLINE_ALLOW_CREATION (true/false), SPEND_CAP_XLM.
 */
export function createAnchorCCTPFromEnv(
  env: Record<string, string | undefined> = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<string, string | undefined>
): EnvConfigResult {
  const network = env.STELLAR_NETWORK ?? 'testnet';
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new InvalidConfigError('STELLAR_NETWORK must be "testnet" or "mainnet"');
  }
  const destination = env.STELLAR_DESTINATION ?? env.STELLAR_TESTNET_DESTINATION;
  if (!isGAddress(destination)) {
    throw new InvalidConfigError('STELLAR_DESTINATION must be a G... address');
  }
  const dust = env.DUST_COLLECTOR_ADDRESS ?? env.STELLAR_DUST_COLLECTOR;
  if (dust !== undefined && !isGAddress(dust)) {
    throw new InvalidConfigError('DUST_COLLECTOR_ADDRESS must be a G... address');
  }
  const forwarder = env.FORWARDER_CONTRACT_ID;
  if (forwarder !== undefined && !isContractId(forwarder)) {
    throw new InvalidConfigError('FORWARDER_CONTRACT_ID must be a C... contract ID');
  }

  const secret = env.STELLAR_SECRET ?? env.STELLAR_TESTNET_SECRET;
  let keypair: Keypair | undefined;
  if (secret !== undefined && secret !== '') {
    try {
      keypair = Keypair.fromSecret(secret.trim());
    } catch {
      throw new InvalidConfigError('STELLAR_SECRET is not a valid S... secret seed');
    }
    if (keypair.publicKey() !== destination) {
      throw new InvalidConfigError('STELLAR_SECRET does not match STELLAR_DESTINATION');
    }
  }

  const passphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  const signer =
    keypair === undefined
      ? undefined
      : async (xdr: string): Promise<string> => {
          const tx = TransactionBuilder.fromXDR(xdr, passphrase) as unknown as {
            sign(kp: Keypair): void;
            toXDR(): string;
            operations: Array<{ type: string; func?: { _value?: { _attributes?: { contractAddress?: { _value?: Buffer } } } } }>;
          };
          // O7: structural guard — must be Soroban invokeHostFunction
          const hasInvoke = tx.operations.some((op) => op.type === 'invokeHostFunction');
          if (!hasInvoke) {
            throw new InvalidConfigError('signer refused: XDR contains no invokeHostFunction operation');
          }
          // O7: when forwarderContractId known, verify target matches
          if (forwarder !== undefined) {
            const invokeOp = tx.operations.find((op) => op.type === 'invokeHostFunction');
            const caBuf = invokeOp?.func?._value?._attributes?.contractAddress?._value;
            if (caBuf && caBuf.length === 32) {
              const targetContract = StrKey.encodeContract(caBuf);
              if (targetContract !== forwarder) {
                throw new InvalidConfigError(
                  `signer refused: invokeHostFunction targets ${targetContract}, expected ${forwarder}`
                );
              }
            }
          }
          tx.sign(keypair as Keypair);
          return tx.toXDR();
        };

  // O6: https pin for attestation base URL
  const attestationUrl = env.CIRCLE_ATTESTATION_BASE_URL;
  if (attestationUrl !== undefined && attestationUrl !== '' && !/^https:\/\//.test(attestationUrl)) {
    throw new InvalidConfigError('CIRCLE_ATTESTATION_BASE_URL must be https');
  }

  // O6: hostname allowlist for HORIZON_URL
  const horizonUrl = env.HORIZON_URL;
  if (horizonUrl !== undefined && horizonUrl !== '') {
    if (!/^https:\/\//.test(horizonUrl)) {
      throw new InvalidConfigError('HORIZON_URL must be https');
    }
    try {
      const host = new URL(horizonUrl).hostname;
      const allowed = host.endsWith('.stellar.org') || host === 'localhost';
      if (!allowed) {
        throw new InvalidConfigError('HORIZON_URL host not in allowlist (*.stellar.org or localhost)');
      }
    } catch (e) {
      if (e instanceof InvalidConfigError) throw e;
      throw new InvalidConfigError('HORIZON_URL is not a valid URL');
    }
  }

  // SOROBAN_RPC_URL: optional, must be https when present
  const sorobanRpcUrl = env.SOROBAN_RPC_URL;
  if (sorobanRpcUrl !== undefined && sorobanRpcUrl !== '' && !/^https:\/\//.test(sorobanRpcUrl)) {
    throw new InvalidConfigError('SOROBAN_RPC_URL must be https');
  }

  const cap = env.SPEND_CAP_XLM ?? env.STELLAR_SPEND_CAP_XLM;
  // N3: validate SPEND_CAP_XLM is finite >= 0 when present
  let parsedCap: number | undefined;
  if (cap !== undefined && cap !== '') {
    parsedCap = Number(cap);
    if (!Number.isFinite(parsedCap) || parsedCap < 0) {
      throw new InvalidConfigError('SPEND_CAP_XLM must be a finite number >= 0');
    }
  }

  const client = createAnchorCCTP({
    network,
    attestationBaseUrl: attestationUrl,
    dustCollectorAddress: dust,
    forwarderContractId: forwarder,
    signer,
    trustline: {
      // C3: default OFF (opt-in required)
      allowCreation:
        (env.TRUSTLINE_ALLOW_CREATION ?? 'false').toLowerCase() === 'true',
      ...(parsedCap === undefined ? {} : { spendCapXlm: parsedCap }),
    },
  });

  return {
    client,
    destinationAddress: destination,
    network,
    hasSigner: keypair !== undefined,
    keypair,
    ...(sorobanRpcUrl !== undefined && sorobanRpcUrl !== '' ? { sorobanRpcUrl } : {}),
  };
}
