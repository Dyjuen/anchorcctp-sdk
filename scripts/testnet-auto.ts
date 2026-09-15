/**
 * testnet:auto Phase 1 — fresh testnet account to settled USDC in one command.
 *
 * Flow: env identity → fund check (friendbot) → forwarder liveness →
 * trustline ensure (opt-in, capped) → receive() → Soroban prepare/send →
 * balance-delta assert → receipt JSON on stdout.
 *
 * Burn hash supplied externally via --skip-burn (EVM burn automation = Full phase).
 * Requires STELLAR_DESTINATION + STELLAR_SECRET (real Keypair submitter).
 *
 * Usage:
 *   npm run testnet:auto -- --skip-burn 0x... [--source-domain 6] [--amount 1000000] [--log docs/evidence/testnet-auto.log]
 */
import { Horizon, Asset, Keypair, Networks, Operation, rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import { createAnchorCCTPFromEnv } from '../packages/core/src/testnet-config.js';
import { readAccountState } from '../packages/core/src/testnet/account.js';
import { checkForwarderDeployed } from '../packages/core/src/testnet/forwarder-check.js';
import { TESTNET_USDC_ISSUER } from '../packages/core/src/trustline/index.js';
import { convert6to7 } from '../packages/core/src/decimals/index.js';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const burnTxHash = arg('--skip-burn') ?? '';
const amountRaw = arg('--amount') ?? '1000000';
const sourceDomain = Number(arg('--source-domain') ?? 6);
const destOverride = arg('--destination');
const logPath = arg('--log');
const statePath = arg('--state') ?? 'docs/evidence/testnet-auto.processed.json';

function log(line: string): void {
  process.stderr.write(`${line}\n`);
  if (logPath) appendFileSync(logPath, `${line}\n`, 'utf8');
}

function fail(code: string, error: string, next: string): never {
  process.stdout.write(JSON.stringify({ settled: false, code, error, next }) + '\n');
  process.exit(1);
}

async function main(): Promise<void> {
  if (!burnTxHash) fail('MISSING_ARGUMENT', 'Missing --skip-burn <0x...>.', 'Do one manual EVM burn, pass its tx hash.');
  if (!/^\d+$/.test(amountRaw) || BigInt(amountRaw) <= 0n) {
    fail('INVALID_ARGUMENT', '--amount must be a positive integer (base units, BigInt).', 'Pass e.g. --amount 1000000.');
  }
  const amount = BigInt(amountRaw);
  if ((process.env.STELLAR_NETWORK ?? 'testnet') === 'mainnet') {
    fail('NETWORK_PIN', 'STELLAR_NETWORK=mainnet refused by testnet:auto.', 'Unset STELLAR_NETWORK or run the mainnet flow manually.');
  }
  const horizonUrl = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
  if (!horizonUrl.includes('testnet')) {
    fail('NETWORK_PIN', `HORIZON_URL=${horizonUrl} is not a testnet host.`, 'Point HORIZON_URL at testnet or unset it.');
  }
  let processed: string[] = [];
  try {
    if (existsSync(statePath)) processed = JSON.parse(readFileSync(statePath, 'utf8')) as string[];
  } catch { processed = []; }
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
  const keypair = Keypair.fromSecret((process.env.STELLAR_SECRET ?? process.env.STELLAR_TESTNET_SECRET ?? '').trim());

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
    writeFileSync(statePath, JSON.stringify(processed, null, 2) + '\n');
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
      sourceDomain,
      destination: dest,
    }) + '\n'
  );
  if (!proven) process.exit(1);
}

main().catch((err) => fail('INTERNAL', String((err as Error)?.message || err), 'Re-run; replay store makes receive() idempotent.'));
