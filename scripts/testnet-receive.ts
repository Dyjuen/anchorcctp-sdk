/**
 * Single testnet receive entrypoint (replaces demo-receive.ts + testnet-receive-smoke.sh).
 *
 * Modes:
 * - default: full receive() attempt vs Circle Iris sandbox, result JSON on stdout.
 * - --verify-only: attestation check only (old smoke.sh role). No receive, no signer.
 * - --log <path>: append human step/event narrative to an evidence log file
 *   (old demo-receive.ts role) alongside the JSON result.
 *
 * Identity/secrets: uses createAnchorCCTPFromEnv when STELLAR_DESTINATION /
 * STELLAR_SECRET are set (real Keypair signer); otherwise falls back to an
 * offline stub signer that only proves XDR build + simulation (B4) and is
 * expected to fail at broadcast — use --verify-only for an offline attestation
 * proof that never touches the network.
 *
 * stdout: result JSON only. stderr: human context. Secret never printed.
 *
 * Usage:
 *   npm run testnet:receive -- <burnTxHash> [G...] [--source-domain 6] [--amount 1000000] [--verify-only] [--log docs/evidence/core-testnet-receive.log]
 */
import { appendFileSync } from 'node:fs';
import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { AttestationClient } from '../packages/core/src/attestation/index.js';
import { createAnchorCCTPFromEnv } from '../packages/core/src/testnet-config.js';
import { createAnchorCCTP } from '../packages/core/src/config.js';
import { readAccountState } from '../packages/core/src/testnet/account.js';
import { TESTNET_USDC_ISSUER } from '../packages/core/src/trustline/index.js';
import { createSorobanTransport } from './soroban-transport.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

const positionals = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const burnTxHash = positionals[0] || process.env.CIRCLE_TESTNET_BURN_TX || '';
const destArg = positionals[1] || process.env.STELLAR_TESTNET_DESTINATION || '';
const sourceDomain = Number(arg('--source-domain') ?? 6);

let amount: bigint;
try {
  amount = BigInt(arg('--amount') ?? '1000000');
} catch {
  process.stdout.write(
    JSON.stringify({ settled: false, error: '--amount is not a valid BigInt', code: 'INVALID_ARGUMENT' }) + '\n'
  );
  process.exit(1);
}

const verifyOnly = flag('--verify-only');
const logPath = arg('--log');

function log(line: string): void {
  process.stderr.write(`${line}\n`);
  if (logPath) appendFileSync(logPath, `${line}\n`, 'utf8');
}

if (!burnTxHash) {
  process.stdout.write(
    JSON.stringify({
      error: 'Missing burnTxHash. Usage: testnet:receive <burnTxHash> [G...] [--verify-only] [--log <path>]',
      code: 'MISSING_ARGUMENT',
    }) + '\n'
  );
  process.exit(1);
}

const attestationBaseUrl = process.env.CIRCLE_ATTESTATION_BASE_URL || 'https://iris-api-sandbox.circle.com';

async function main(): Promise<void> {
  if (verifyOnly) {
    await runVerifyOnly();
    return;
  }
  await runReceive();
}

void main().catch((err) => {
  process.stdout.write(JSON.stringify({ settled: false, error: String((err as Error)?.message || err) }) + '\n');
  process.exit(1);
});

async function runVerifyOnly(): Promise<void> {
  const client = new AttestationClient({ baseUrl: attestationBaseUrl });
  log(`[STEP] [attestation] Polling Iris sandbox for ${burnTxHash} (domain ${sourceDomain})`);
  try {
    const r = await client.pollAttestationByTx(sourceDomain, burnTxHash, (attempt, elapsedMs) =>
      log(`[POLL] attempt ${attempt} elapsed ${elapsedMs}ms`)
    );
    const verified = client.verifyAttestation(r.message, r.signature);
    log(`[EVENT] [attested] status=${r.status} verified=${verified}`);
    process.stdout.write(
      JSON.stringify({ attested: r.status === 'complete' && verified, status: r.status, burnTxHash, sourceDomain }) + '\n'
    );
  } catch (err) {
    log(`[ERROR] attestation check failed: ${String((err as Error)?.message || err)}`);
    process.stdout.write(
      JSON.stringify({ attested: false, status: 'timeout', burnTxHash, sourceDomain }) + '\n'
    );
    process.exit(1);
  }
  process.exit(0);
}

/**
 * Creates the USDC trustline when it is missing and the caller opted in.
 *
 * F2: the change-trust tx is signed by the same account that sponsors the mint,
 * which advances that account's sequence. This MUST run before the sponsor
 * sequence is read for the mint tx, otherwise the mint carries a stale sequence
 * and the network rejects it with `txBAD_SEQ`. `testnet:auto` does the same.
 */
async function ensureTrustlineFirst(
  keypair: Keypair | undefined,
  destinationAddress: string
): Promise<void> {
  if (!keypair) return; // offline stub — nothing can be signed
  const allowCreation = (process.env.TRUSTLINE_ALLOW_CREATION ?? 'false').toLowerCase() === 'true';
  if (!allowCreation) return;

  const horizonUrl = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
  const state = await readAccountState({ horizonUrl, address: destinationAddress });
  if (!state.exists || state.hasTrustline) return;

  const spendCapRaw = process.env.SPEND_CAP_XLM ?? process.env.STELLAR_SPEND_CAP_XLM ?? '2';
  const spendCap = Number(spendCapRaw);
  if (!Number.isFinite(spendCap) || 0.5 > spendCap) {
    log(`[WARN] [trustline] skipped — 0.5 XLM reserve exceeds SPEND_CAP_XLM=${spendCapRaw}`);
    return;
  }

  const horizon = new Horizon.Server(horizonUrl);
  const account = await horizon.loadAccount(destinationAddress);
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: new Asset('USDC', TESTNET_USDC_ISSUER) }))
    .setTimeout(30)
    .build();
  tx.sign(keypair);
  await horizon.submitTransaction(tx);
  log('[EVENT] [trustline] created (0.5 XLM reserve)');
}

// Full receive mode.
async function runReceive(): Promise<void> {
let sdk;
let destinationAddress = destArg;
let keypair: Keypair | undefined;
let offline = false;
try {
  const fromEnv = createAnchorCCTPFromEnv({
    ...process.env,
    ...(destArg ? { STELLAR_DESTINATION: destArg } : {}),
  });
  sdk = fromEnv.client;
  destinationAddress = fromEnv.destinationAddress;
  keypair = fromEnv.keypair;
  log(`[INFO] SDK from env (signer: ${fromEnv.hasSigner ? 'real Keypair' : 'offline stub'})`);
} catch {
  // No usable env identity — offline stub proves XDR build without settlement.
  log('[INFO] No env identity — offline stub signer (no settlement)');
  offline = true;
  sdk = createAnchorCCTP({
    attestationBaseUrl,
    signer: async (xdr) => {
      log(`[SIGN] XDR len ${xdr.length} — offline stub, no chain submit`);
      return `SIGNED_OFFLINE_${xdr.slice(0, 16)}`;
    },
  });
  if (!destinationAddress) {
    process.stdout.write(JSON.stringify({ error: 'Missing destination G.... Set STELLAR_DESTINATION or pass as arg 2.', code: 'MISSING_ARGUMENT' }) + '\n');
    process.exit(1);
  }
}

const rpcUrl = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const sorobanServer = new rpc.Server(rpcUrl);
const transport = createSorobanTransport(sorobanServer, Networks.TESTNET);

const before = Date.now();
log(`[STEP] [receive] sourceDomain=${sourceDomain} dest=${destinationAddress} amount=${amount.toString()}`);
try {
  // F2: any trustline creation must happen BEFORE the sequence read below.
  await ensureTrustlineFirst(keypair, destinationAddress);
  // B3/B4: receive() simulates, assembles, broadcasts and confirms. The sponsor's
  // real sequence must be read from chain — simulation never supplies it.
  const sponsorAccount = await sorobanServer.getAccount(destinationAddress);
  const res = await (sdk as ReturnType<typeof createAnchorCCTP>).receive({
    sourceDomain,
    burnTxHash,
    destinationAddress,
    amount,
    sponsorAccount: destinationAddress,
    sourceSequence: sponsorAccount.sequenceNumber(),
    rpc: transport,
  });
  log(`[EVENT] [onSettled] amount=${res.amount.toString()} dust=${res.dust.toString()} txHash=${res.txHash.slice(0, 32)}...`);
  process.stdout.write(
    JSON.stringify({
      settled: res.settled,
      amount: res.amount.toString(),
      dust: res.dust.toString(),
      txHash: res.txHash,
      elapsedMs: Date.now() - before,
      ...(offline ? { offline: true } : {}),
    }) + '\n'
  );
} catch (err) {
  log(`[ERROR] receive failed: ${String((err as Error)?.message || err)}`);
  process.stdout.write(JSON.stringify({ settled: false, error: String((err as Error)?.message || err) }) + '\n');
  process.exit(1);
}
}
