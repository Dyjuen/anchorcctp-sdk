/**
 * testnet:auto Phase 1 — fresh testnet account to settled USDC in one command.
 *
 * Flow: env identity → fund check (friendbot) → forwarder liveness →
 * trustline ensure (opt-in, capped) → receive() → Soroban prepare/send →
 * balance-delta assert → receipt JSON on stdout.
 *
 * Burn hash supplied externally via --skip-burn (EVM burn automation = Full phase).
 * No --skip-burn: burns on Base Sepolia itself (needs EVM_PRIVATE_KEY + EVM_RPC_URL).
 * Requires STELLAR_DESTINATION + STELLAR_SECRET (real Keypair submitter).
 *
 * Usage:
 *   npm run testnet:auto -- --skip-burn 0x... [--source-domain 6] [--amount 1000000] [--log docs/evidence/testnet-auto.log]
 */
import { existsSync, readFileSync, renameSync, writeFileSync, appendFileSync, unlinkSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Horizon, Asset, Networks, Operation, rpc, TransactionBuilder, Keypair } from '@stellar/stellar-sdk';
import { createAnchorCCTPFromEnv } from '../packages/core/src/testnet-config.js';
import { readAccountState } from '../packages/core/src/testnet/account.js';
import { checkForwarderDeployed } from '../packages/core/src/testnet/forwarder-check.js';
import { TESTNET_USDC_ISSUER } from '../packages/core/src/trustline/index.js';
import { convert6to7 } from '../packages/core/src/decimals/index.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { BurnError, executeBurn, planBurn } from '../packages/core/src/evm/burn.js';
import { isSupportedDomain } from '../packages/core/src/domains/index.js';

// Auto-load .env.testnet if present so command works cross-platform seamlessly
const envTestnetPath = resolve(process.cwd(), '.env.testnet');
if (existsSync(envTestnetPath)) {
  const content = readFileSync(envTestnetPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let burnTxHash = arg('--skip-burn') ?? '';
const amountRaw = arg('--amount') ?? '1000000';
const sourceDomain = Number(arg('--source-domain') ?? 6);
const destOverride = arg('--destination');
const logPath = arg('--log');
const statePath = arg('--state') ?? 'docs/evidence/testnet-auto.processed.json';
const force = process.argv.includes('--force');

const cwd = process.cwd();

function log(line: string): void {
  process.stderr.write(`${line}\n`);
  if (logPath) appendFileSync(logPath, `${line}\n`, 'utf8');
}

function fail(code: string, error: string, next: string): never {
  process.stdout.write(JSON.stringify({ settled: false, code, error, next }) + '\n');
  process.exit(1);
}

function restrictCwd(p: string): void {
  const resolved = resolve(p);
  if (!resolved.startsWith(cwd + '/') && resolved !== cwd) {
    fail('INVALID_ARGUMENT', `Path ${p} is outside cwd. Use --force to override.`, 'Pass a path within the project directory.');
  }
}

function parseMaxFee(raw: string): bigint {
  if (!/^\d+$/.test(raw)) fail('INVALID_CONFIG', `EVM_MAX_FEE=${raw} is not a positive integer.`, 'Set EVM_MAX_FEE to e.g. 5000 (6-dec units).');
  return BigInt(raw);
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const tmp = filePath + '.tmp.' + Date.now();
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, filePath);
}

async function main(): Promise<void> {
  // N9/O14: upfront burn hash validation
  if (burnTxHash && !/^0x[0-9a-fA-F]{64}$/.test(burnTxHash)) {
    fail('INVALID_HASH', `--skip-burn hash malformed: "${burnTxHash}".`, 'Pass 0x + 64 hex chars.');
  }
  // N9/O14: sourceDomain allowlist check upfront
  if (!isSupportedDomain(sourceDomain)) {
    fail('INVALID_DOMAIN', `sourceDomain ${sourceDomain} not in allowlist.`, 'Use 0 (Ethereum), 6 (Base), 27 (Stellar), etc.');
  }
  if (!/^\d+$/.test(amountRaw) || BigInt(amountRaw) <= 0n) {
    fail('INVALID_ARGUMENT', '--amount must be a positive integer (base units, BigInt).', 'Pass e.g. --amount 1000000.');
  }
  const amount = BigInt(amountRaw);
  if ((process.env.STELLAR_NETWORK ?? 'testnet') === 'mainnet') {
    fail('NETWORK_PIN', 'STELLAR_NETWORK=mainnet refused by testnet:auto.', 'Unset STELLAR_NETWORK or run the mainnet flow manually.');
  }
  const horizonUrl = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
  // O6: hostname allowlist — *.stellar.org or localhost only
  if (!horizonUrl.startsWith('https://')) {
    fail('NETWORK_PIN', `HORIZON_URL=${horizonUrl} must be https.`, 'Point HORIZON_URL at testnet or unset it.');
  }
  try {
    const host = new URL(horizonUrl).hostname;
    if (!host.endsWith('.stellar.org') && host !== 'localhost') {
      fail('NETWORK_PIN', `HORIZON_URL host "${host}" not in allowlist.`, 'Use *.stellar.org or localhost.');
    }
  } catch {
    fail('NETWORK_PIN', `HORIZON_URL=${horizonUrl} is not a valid URL.`, 'Point HORIZON_URL at testnet or unset it.');
  }
  // O14: restrict --state/--log to cwd unless --force
  if (!force) {
    restrictCwd(statePath);
    if (logPath) restrictCwd(logPath);
  }

  let processed: string[] = [];
  // N9: single-process guard via O_EXCL lock file
  const lockPath = statePath + '.lock';
  const STALE_MS = 5 * 60 * 1000;
  let lockAcquired = false;
  try {
    writeFileSync(lockPath, `${process.pid}`, { flag: 'wx' });
    lockAcquired = true;
  } catch {
    // Check for stale lock
    try {
      const st = statSync(lockPath);
      if (Date.now() - st.mtimeMs > STALE_MS) {
        unlinkSync(lockPath);
        writeFileSync(lockPath, `${process.pid}`, { flag: 'wx' });
        lockAcquired = true;
      } else {
        fail('LOCKED', 'Another testnet:auto run is in progress (lock file exists).', 'Wait for the other run to finish or remove the lock file if stale.');
      }
    } catch {
      // stat failed (file gone between check and stat) — retry once
      try {
        writeFileSync(lockPath, `${process.pid}`, { flag: 'wx' });
        lockAcquired = true;
      } catch {
        fail('LOCKED', 'Another testnet:auto run is in progress.', 'Wait or remove stale lock.');
      }
    }
  }
  // N9: wrap remaining logic in try/finally to release lock
  try {
    if (existsSync(statePath)) { try { processed = JSON.parse(readFileSync(statePath, 'utf8')) as string[]; } catch { processed = []; } }
    if (processed.includes(burnTxHash)) {
    fail('REPLAY', 'burnTxHash already settled by a previous run.', 'Use a fresh burn hash per run.');
  }

  let env;
  try {
    env = createAnchorCCTPFromEnv({ ...process.env, ...(destOverride ? { STELLAR_DESTINATION: destOverride } : {}) });
  } catch (err) {
    fail('INVALID_CONFIG', String((err as Error)?.message || err), 'Set STELLAR_DESTINATION + STELLAR_SECRET in .env.testnet (see .env.example).');
  }
  if (!env.hasSigner) {
    fail('NO_SIGNER', 'STELLAR_SECRET missing — auto must submit on-chain.', 'Add STELLAR_SECRET to .env.testnet, or use testnet:receive for XDR-only proof.');
  }
  const dest = env.destinationAddress;
  const rpcUrl = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
  // M9: reuse validated keypair from createAnchorCCTPFromEnv; fallback for backward-compat
  let keypair = env.keypair;
  if (!keypair) {
    const { Keypair } = await import('@stellar/stellar-sdk');
    keypair = Keypair.fromSecret((process.env.STELLAR_SECRET ?? process.env.STELLAR_TESTNET_SECRET ?? '').trim());
  }

  let evmBurnTxHash: string | undefined;
  if (!burnTxHash) {
    const evmKey = (process.env.EVM_PRIVATE_KEY ?? '').trim();
    if (!evmKey) {
      fail('MISSING_BURN_SOURCE', 'No --skip-burn and no EVM_PRIVATE_KEY.', 'Pass --skip-burn 0x... (Phase 1) or set EVM_PRIVATE_KEY + EVM_RPC_URL (Full).');
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(evmKey)) {
      fail('INVALID_CONFIG', 'EVM_PRIVATE_KEY malformed (want 0x + 64 hex).', 'Export the raw hex key, 0x-prefixed, into .env.testnet only.');
    }
    const evmRpc = (process.env.EVM_RPC_URL ?? 'https://sepolia.base.org').trim();
    // O6: EVM_RPC_URL must be https (http allowed only for localhost)
    if (!evmRpc.startsWith('https://')) {
      const evmHost = evmRpc.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      if (!evmRpc.startsWith('http://localhost') && evmHost !== 'localhost') {
        fail('INVALID_CONFIG', 'EVM_RPC_URL must be https (http allowed only for localhost).', 'Set EVM_RPC_URL to an https endpoint.');
      }
    }
    const expectedChainId = Number(process.env.EVM_CHAIN_ID ?? 84532);
    const account = privateKeyToAccount(evmKey as `0x${string}`);
    log(`[STEP] [burn] evm=${account.address} chain=${expectedChainId} amount=${amount.toString()}`);
    try {
      const chain = { ...baseSepolia, ...(process.env.EVM_RPC_URL ? { rpcUrls: { default: { http: [evmRpc] } } } : {}) };
      const publicClient = createPublicClient({ chain, transport: http(evmRpc) });
      const walletClient = createWalletClient({ account, chain, transport: http(evmRpc) });
      const plan = planBurn({
        amount,
        stellarDestination: dest,
        forwarderContractId: process.env.FORWARDER_CONTRACT_ID ?? 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
        ...(process.env.EVM_USDC_ADDRESS ? { burnToken: process.env.EVM_USDC_ADDRESS as `0x${string}` } : {}),
        ...(process.env.EVM_MESSENGER_ADDRESS ? { messenger: process.env.EVM_MESSENGER_ADDRESS as `0x${string}` } : {}),
        ...(process.env.EVM_MAX_FEE ? { maxFee: parseMaxFee(process.env.EVM_MAX_FEE) } : {}),
      });
      const r = await executeBurn({ publicClient, walletClient, account, plan, expectedChainId });
      burnTxHash = r.burnTxHash;
      evmBurnTxHash = r.burnTxHash;
      log(`[EVENT] [burn] txHash=${burnTxHash}`);
    } catch (err) {
      if (err instanceof BurnError) {
        const nexts: Record<string, string> = {
          EVM_CHAIN_PIN: 'Set EVM_CHAIN_ID=84532 + EVM_RPC_URL=https://sepolia.base.org; never mainnet.',
          INSUFFICIENT_GAS: 'Fund Base Sepolia ETH (coinbase/alchemy faucet), re-run.',
          INSUFFICIENT_USDC: 'Get Base Sepolia USDC at faucet.circle.com, re-run.',
          APPROVE_FAILED: 'Check USDC contract + balance, re-run (idempotent).',
          BURN_FAILED: 'Burn reverted — check messenger address + hook args, re-run.',
        };
        fail(err.code, err.message, nexts[err.code]);
      }
      if (err instanceof Error && /maxFee exceeds amount/.test(err.message)) {
        fail('INVALID_CONFIG', err.message, 'Lower EVM_MAX_FEE at or below --amount.');
      }
      throw err;
    }
  }

  let state = await readAccountState({ horizonUrl, address: dest });
  if (!state.exists) {
    log(`[STEP] [fund] ${dest} missing — requesting friendbot`);
    const fb = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(dest)}`).catch(() => undefined);
    if (!fb?.ok) fail('FUND_FAILED', 'Friendbot fund failed.', 'Fund manually, re-run (idempotent).');
    state = await readAccountState({ horizonUrl, address: dest });
    if (!state.exists) fail('FUND_FAILED', 'Account still missing after friendbot.', 'Testnet may have reset — re-run testnet:deploy.');
  }
  log(`[INFO] account funded, USDC balance before=${state.usdcBalance}`);

  const fwd = await checkForwarderDeployed({
    rpcUrl,
    contractId: process.env.FORWARDER_CONTRACT_ID ?? 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ',
  });
  if (!fwd.deployed) fail('FORWARDER_MISSING', 'Forwarder contract not found on testnet.', 'Check FORWARDER_CONTRACT_ID + testnet reset status.');
  log(`[INFO] forwarder live (ledger ${fwd.latestLedger ?? '?'})`);

  const horizon = new Horizon.Server(horizonUrl);
  const allowCreation = (process.env.TRUSTLINE_ALLOW_CREATION ?? 'true').toLowerCase() === 'true';
  const spendCapRaw = process.env.SPEND_CAP_XLM ?? '2';
  const spendCap = Number(spendCapRaw);
  if (!Number.isFinite(spendCap) || spendCap < 0) {
    fail('INVALID_CONFIG', `SPEND_CAP_XLM=${spendCapRaw} is not a non-negative number.`, 'Set SPEND_CAP_XLM to e.g. 2.');
  }
  if (!state.hasTrustline) {
    if (!allowCreation) fail('TRUSTLINE_MISSING', 'USDC trustline missing and creation not allowed.', 'Set TRUSTLINE_ALLOW_CREATION=true (capped).');
    if (0.5 > spendCap) fail('SPEND_CAP', '0.5 XLM reserve exceeds SPEND_CAP_XLM.', 'Raise SPEND_CAP_XLM.');
    const acct = await horizon.loadAccount(dest);
    const tx = new TransactionBuilder(acct, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.changeTrust({ asset: new Asset('USDC', TESTNET_USDC_ISSUER) }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);
    await horizon.submitTransaction(tx);
    log('[EVENT] [trustline] created (0.5 XLM reserve)');
  }

  const stellarAccount = await horizon.loadAccount(dest);
  const before = state.usdcBalance;
  log(`[STEP] [receive] domain=${sourceDomain} amount=${amount.toString()}`);
  const res = await env.client.receive({
    sourceDomain,
    burnTxHash,
    destinationAddress: dest,
    amount,
    sourceSequence: stellarAccount.sequence,
  });

  const rpcServer = new rpc.Server(rpcUrl);
  const unsigned = TransactionBuilder.fromXDR(res.txHash, Networks.TESTNET) as unknown as Parameters<rpc.Server['prepareTransaction']>[0];
  const simBuilt = await rpcServer.prepareTransaction(unsigned);
  const preparedXdr = (simBuilt as unknown as { toXDR(): string }).toXDR();
  const toSign = TransactionBuilder.fromXDR(preparedXdr, Networks.TESTNET);
  (toSign as unknown as { sign(kp: Keypair): void }).sign(keypair);
  const send = await rpcServer.sendTransaction(toSign as unknown as Parameters<rpc.Server['sendTransaction']>[0]);
  if (send.status !== 'PENDING') {
    fail('SUBMIT_FAILED', `sendTransaction status=${send.status}`, 'Check forwarder logs + account sequence, re-run (replay store guards double-credit).');
  }
  const txHash = (send as { hash: string }).hash;
  log(`[EVENT] [onSettled] txHash=${txHash}`);

  const after = (await readAccountState({ horizonUrl, address: dest })).usdcBalance;
  const { stellarAmount, dust } = convert6to7(amount);
  const toUnits = (s: string): bigint => {
    const [i, f = ''] = s.split('.');
    return BigInt(i) * 10_000_000n + BigInt((f + '0000000').slice(0, 7));
  };
  const delta = toUnits(after) - toUnits(before);
  const dusty = process.env.DUST_COLLECTOR_ADDRESS && process.env.DUST_COLLECTOR_ADDRESS !== dest;
  const expected = dusty ? stellarAmount - dust : stellarAmount;
  const proven = delta === expected;
  if (proven) {
    processed.push(burnTxHash);
    atomicWriteJson(statePath, processed);
  }
  process.stdout.write(
    JSON.stringify({
      settled: proven,
      txHash,
      amount: res.amount.toString(),
      dust: res.dust.toString(),
      balanceBefore: before,
      balanceAfter: after,
      delta: delta.toString(),
      burnTxHash,
      ...(evmBurnTxHash ? { evmBurnTxHash } : {}),
      sourceDomain,
      destination: dest,
    }) + '\n'
  );
  if (!proven) process.exit(1);
  } finally {
    // N9: release lock file
    if (lockAcquired) {
      try { unlinkSync(lockPath); } catch { /* best-effort */ }
    }
  }
}

main().catch((err) => fail('INTERNAL', String((err as Error)?.message || err), 'Re-run; replay store makes receive() idempotent.'));
