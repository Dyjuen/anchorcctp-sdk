import { StrKey } from '@stellar/stellar-sdk';

export interface NetworkConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl: string; sorobanRpcUrl: string; usdcIssuer: string;
  forwarderContractId: string; attestationUrl: string;
  passphrase: string; simMode: boolean;
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

function isContractId(v: string): boolean {
  const maybe = (StrKey as unknown as { isValidContract?: (s: string) => boolean }).isValidContract;
  if (typeof maybe === 'function') return maybe.call(StrKey, v);
  return /^C[A-Z2-7]{55}$/.test(v);
}

function fail(why: string): never { throw new Error(`NETWORK_CONFIG ${why}`); }

/**
 * In browser: import.meta.env (Vite-injected VITE_* vars).
 * In vitest: vi.stubEnv writes process.env, so per-key process.env
 * overrides win (required: real .env files also populate import.meta.env,
 * which would otherwise shadow stubs).
 */
function resolveEnv(): Record<string, string | undefined> {
  const im = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const out: Record<string, string | undefined> = { ...im };
  if (typeof process !== 'undefined' && process.env) {
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith('VITE_')) out[k] = v;
    }
  }
  return out;
}

export function loadNetworkConfig(env: Record<string, string | undefined> = resolveEnv()): NetworkConfig {
  const network = env.VITE_NETWORK ?? 'testnet';
  if (network !== 'testnet' && network !== 'mainnet') fail(`unknown network "${network}"`);
  const horizonUrl = env.VITE_HORIZON_URL ?? (network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
  if (!/^https:\/\/[^/]+/.test(horizonUrl)) fail(`horizonUrl must be https, got "${horizonUrl}"`);
  const sorobanRpcUrl = env.VITE_SOROBAN_RPC_URL ?? '';
  if (!sorobanRpcUrl) fail('sorobanRpcUrl missing');
  if (!/^https:\/\//.test(sorobanRpcUrl)) fail('sorobanRpcUrl must be https');
  const usdcIssuer = env.VITE_USDC_ISSUER ?? '';
  if (!StrKey.isValidEd25519PublicKey(usdcIssuer)) fail(`usdcIssuer must be G..., got "${usdcIssuer}"`);
  const forwarderContractId = env.VITE_FORWARDER_CONTRACT_ID ?? '';
  if (!isContractId(forwarderContractId)) fail(`forwarderContractId must be C..., got "${forwarderContractId}"`);
  const attestationUrl = env.VITE_ATTESTATION_URL ?? '';
  if (!/^https:\/\//.test(attestationUrl)) fail('attestationUrl must be https');
  const expectedPassphrase = network === 'mainnet' ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
  const passphrase = env.VITE_STELLAR_NETWORK_PASSPHRASE ?? expectedPassphrase;
  if (passphrase !== expectedPassphrase) fail(`passphrase/network mismatch: "${passphrase}" for ${network}`);
  return { network, horizonUrl, sorobanRpcUrl, usdcIssuer, forwarderContractId, attestationUrl, passphrase, simMode: (env.VITE_SIM_MODE ?? 'true').toLowerCase() !== 'false' };
}
