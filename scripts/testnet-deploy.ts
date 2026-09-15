/**
 * Testnet deploy/setup script.
 *
 * Generates (or reuses) a Stellar testnet account, funds it via friendbot,
 * and writes TWO files with different trust levels:
 * - public JSON (committable): addresses, contract IDs, URLs. No secrets ever.
 * - .env.testnet (gitignored, mode 0600): the S... secret. Never logged/printed.
 *
 * stdout: result JSON only. stderr: human context. Secret never touches stdout.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/testnet-deploy.ts [--out config/testnet.public.json] [--env-out .env.testnet] [--destination G...] [--no-fund] [--force]
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';
import { parseTestnetConfig } from '../packages/core/src/testnet-config.js';
import { TESTNET_FORWARDER } from '../packages/core/src/forwarder/index.js';
import { TESTNET_USDC_ISSUER } from '../packages/core/src/trustline/index.js';

const HORIZON = 'https://horizon-testnet.stellar.org';
const RPC = 'https://soroban-testnet.stellar.org';
const ATTEST = 'https://iris-api-sandbox.circle.com';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

const outPath = arg('--out') || 'config/testnet.public.json';
const envPath = arg('--env-out') || '.env.testnet';
const reuseDestination = arg('--destination');
const noFund = flag('--no-fund');
const force = flag('--force');

async function friendbotFund(address: string): Promise<boolean> {
  try {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  let destination = reuseDestination;
  let secret: string | undefined;

  if (destination) {
    console.error(`[INFO] Reusing destination ${destination} (no secret handled).`);
  } else {
    const kp = Keypair.random();
    destination = kp.publicKey();
    secret = kp.secret();
  }

  let funded = false;
  if (!noFund && destination) {
    funded = await friendbotFund(destination);
    console.error(funded ? `[INFO] Funded ${destination} via friendbot.` : '[WARN] Friendbot fund failed — retry manually.');
  }

  const publicConfig = {
    network: 'testnet',
    horizonUrl: HORIZON,
    sorobanRpcUrl: RPC,
    attestationBaseUrl: ATTEST,
    forwarderContractId: TESTNET_FORWARDER,
    usdcIssuer: TESTNET_USDC_ISSUER,
    destinationAddress: destination,
    dustCollectorAddress: destination,
  };
  // Validate before writing — also proves no secret fields present.
  parseTestnetConfig(publicConfig);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(publicConfig, null, 2) + '\n');

  let secretStored = false;
  if (secret) {
    if (existsSync(envPath) && !force) {
      console.error(`[WARN] ${envPath} exists — secret NOT overwritten (pass --force to rotate).`);
    } else {
      writeFileSync(envPath, `STELLAR_TESTNET_SECRET=${secret}\nSTELLAR_TESTNET_DESTINATION=${destination}\n`);
      chmodSync(envPath, 0o600);
      secretStored = true;
    }
    console.error('[INFO] Secret written to env file only (mode 0600). Value never printed.');
  }

  if (!secret && existsSync(envPath)) {
    console.error(`[INFO] Pair ${envPath} with ${outPath} at receive() time via signer callback.`);
  }
  console.error('[NEXT] npx tsx --tsconfig tsconfig.scripts.json scripts/testnet-receive.ts <burnTxHash> <destination>');

  process.stdout.write(
    JSON.stringify({ success: true, writtenPath: outPath, destinationAddress: destination, funded, secretStored }) + '\n'
  );
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ success: false, error: String(err?.message || err) }) + '\n');
  process.exit(1);
});
