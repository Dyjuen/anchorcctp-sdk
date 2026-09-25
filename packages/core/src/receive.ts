import { assertSupportedDomain } from './domains/index.js';
import { translateToStellar, submitMint, SignerCallback, SorobanTransport } from './forwarder/index.js';
import { convert6to7 } from './decimals/index.js';
import { ensureTrustline, TESTNET_USDC_ISSUER, TrustlineProvider } from './trustline/index.js';
import { ReplayStore, SettlementRecord } from './replay/index.js';
import { AttestationClient, AttestationResult } from './attestation/index.js';
import { parseTransferAmounts } from './cctp-message.js';
import { AnchorCCTPEventEmitter } from './events/index.js';
import { Logger } from './logger/index.js';
import { StrKey } from '@stellar/stellar-sdk';
import {
  ReplayTransferError,
  InvalidAmountError,
  AttestationVerificationError,
  MintFailedError,
  TrustlineCreationError,
  InvalidBurnHashError,
  InvalidConfigError,
  InvalidAddressError,
} from './errors/index.js';

export interface ReceiveParams {
  sourceDomain: number;
  burnTxHash: string;
  destinationAddress: string;
  /**
   * Gross burn amount from the source-chain burn. Caller MUST pass the attested value.
   * `receive()` cross-checks it against the parsed message amount (uint256 at absolute
   * offset 216) and throws `InvalidAmountError` on mismatch. Note this is the **gross**
   * amount: on a Fast transfer the receipt reports `amount - feeExecuted`.
   */
  amount: bigint;
  dustCollectorAddress?: string;
  signer?: SignerCallback;
  allowTrustlineCreation?: boolean;
  spendCapXlm?: number;
  forwarderContractId?: string;
  sourceSequence?: string;
  /** O15: Sponsor account used as transaction source for the mint XDR. */
  sponsorAccount?: string;
  /** B3/B4: Soroban transport for this call. Falls back to `config.sorobanTransport`. */
  rpc?: SorobanTransport;
}

export interface ReceiveResult {
  amount: bigint;
  dust: bigint;
  txHash: string;
  settled: boolean;
}

export interface ReceiveContext {
  attestationClient: AttestationClient;
  replayStore: ReplayStore;
  emitter: AnchorCCTPEventEmitter;
  logger: Logger;
  defaultSigner?: SignerCallback;
  defaultDustCollector?: string;
  defaultTrustline?: {
    allowCreation: boolean;
    spendCapXlm?: number;
  };
  defaultForwarderContractId?: string;
  /** O15/B2: Sponsor G... account used as the mint transaction source. */
  defaultSponsorAccount?: string;
  /** B3/B4: Default Soroban transport (from `config.sorobanTransport`). No implicit default. */
  defaultRpc?: SorobanTransport;
  defaultUsdcIssuer?: string;
  /**
   * B5: Production trustline provider (from `config.trustlineProvider`). Takes
   * precedence over `_test`; `_test` is a test-only fallback and the factory
   * rejects it when `NODE_ENV=production` (N1).
   */
  defaultTrustlineProvider?: TrustlineProvider;
  network?: 'testnet' | 'mainnet';
  _test?: {
    attestation?: (burnTxHash: string) => Promise<Partial<AttestationResult>>;
    hasTrustline?: () => Promise<boolean>;
    createTrustline?: (xdr: string) => Promise<string>;
    [key: string]: unknown;
  };
}

/**
 * Dust-collector precedence: param → cfg → dest.
 */
export function resolveDustCollector(args: {
  dest: string;
  param?: string;
  cfg?: string;
}): string {
  return args.param || args.cfg || args.dest;
}

/**
 * Normalizes burnTxHash to lowercase 0x + 64 hex chars, or throws InvalidBurnHashError.
 */
export function normalizeBurnTxHash(h: string): string {
  if (typeof h !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(h.trim())) {
    throw new InvalidBurnHashError(h);
  }
  return '0x' + h.trim().slice(2).toLowerCase();
}

/**
 * Orchestrates the full CCTP receive lifecycle on Stellar.
 */
export async function receive(
  params: ReceiveParams,
  ctx: ReceiveContext
): Promise<ReceiveResult> {
  const {
    sourceDomain,
    burnTxHash: burnTxHashRaw,
    destinationAddress,
    amount,
  } = params;

  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw new InvalidAmountError('Amount is required and must be a positive BigInt (> 0n).');
  }

  // 1. Normalize burnTxHash (0x + 64 hex, lowercase)
  const burnTxHash = normalizeBurnTxHash(burnTxHashRaw);

  // 2. Verify source domain is supported
  assertSupportedDomain(sourceDomain);

  // 3. Replay Protection Guard
  const isAlreadyProcessed = await ctx.replayStore.isProcessed(burnTxHash);
  if (isAlreadyProcessed) {
    throw new ReplayTransferError(burnTxHash);
  }

  // 5. Address translation & validation
  const stellarDestination = translateToStellar(destinationAddress);

  // 5b. Mainnet fail-closed: usdcIssuer required (no testnet default on mainnet)
  if (ctx.network === 'mainnet' && !ctx.defaultUsdcIssuer) {
    throw new InvalidConfigError('usdcIssuer is required on mainnet (no testnet default).');
  }

  // 6. Attestation Polling
  ctx.logger.info('Starting CCTP attestation polling', { burnTxHash, sourceDomain });
  let attResult: AttestationResult;

  const onPollCallback = (attempt: number, elapsedMs: number) => {
    ctx.emitter.emit('onReceiving', {
      burnTxHash,
      status: 'attesting',
      attempt,
      elapsedTimeMs: elapsedMs,
      sourceDomain,
    });
  };

  if (ctx._test?.pollAttestation) {
    attResult = await (ctx._test.pollAttestation as (
      burnTxHash: string,
      onPoll: (attempt: number, elapsedMs: number) => void
    ) => Promise<AttestationResult>)(burnTxHash, onPollCallback);
  } else if (ctx._test?.attestation) {
    const rawMock = await ctx._test.attestation(burnTxHash);
    attResult = {
      status: (rawMock.status as AttestationResult['status']) || 'complete',
      attestation: rawMock.attestation || '0xatt_mock',
      message: rawMock.message || '0xmsg_mock',
      signature: rawMock.signature || '0xsig_mock',
      attempts: 1,
      elapsedTimeMs: 10,
    };
  } else {
    attResult = await ctx.attestationClient.pollAttestationByTx(
      sourceDomain,
      burnTxHash,
      onPollCallback
    );
  }

  // 7. Well-formed Attestation Check (forwarder contract is sole cryptographic verifier)
  const isWellFormed = ctx.attestationClient.isWellFormedAttestation(
    attResult.message,
    attResult.signature
  );
  if (!isWellFormed || attResult.status !== 'complete') {
    const error = new AttestationVerificationError(
      burnTxHash,
      'message/signature byte shape invalid or status not complete'
    );
    ctx.emitter.emit('onError', { error, burnTxHash });
    throw error;
  }

  // O2/B6: Parse amount and executed fee from CCTP message (uint256 BE at absolute
  // offsets 216 and 312 — see cctp-message.ts) and cross-check the amount against
  // the caller-supplied value. Too short → fail closed.
  let parsedAmount: bigint;
  let feeExecuted: bigint;
  try {
    ({ amount: parsedAmount, feeExecuted } = parseTransferAmounts(attResult.message));
  } catch (parseErr) {
    ctx.emitter.emit('onError', { error: parseErr, burnTxHash });
    throw parseErr;
  }
  if (parsedAmount !== amount) {
    const error = new InvalidAmountError(
      `amount mismatch: caller supplied ${amount} but attestation message contains ${parsedAmount}`
    );
    ctx.emitter.emit('onError', { error, burnTxHash });
    throw error;
  }

  // 8. Trustline Inspection & Opt-in Creation
  const allowTrustline =
    params.allowTrustlineCreation ??
    ctx.defaultTrustline?.allowCreation ??
    false;
  const spendCap = params.spendCapXlm ?? ctx.defaultTrustline?.spendCapXlm;

  const effectiveSigner = params.signer ?? ctx.defaultSigner;
  if (!effectiveSigner) {
    throw new MintFailedError(burnTxHash, 'No signer configured. Pass params.signer or config.signer.');
  }

  // B5: the config-supplied provider wins; `_test` stays a test-only fallback (the
  // factory already rejects `_test` when NODE_ENV=production — N1 — so production
  // can never reach it; no extra env branch is needed here).
  const configTrustlineProvider = ctx.defaultTrustlineProvider;
  const hasTrustline: (() => Promise<boolean>) | undefined = configTrustlineProvider
    ? () => configTrustlineProvider.hasTrustline(stellarDestination)
    : ctx._test?.hasTrustline;
  if (!hasTrustline) {
    throw new TrustlineCreationError(
      stellarDestination,
      'No hasTrustline provider wired. Pass config.trustlineProvider (production) or _test.hasTrustline (tests).'
    );
  }
  const createTrustline = configTrustlineProvider
    ? (xdr: string) => configTrustlineProvider.createTrustline(xdr)
    : ctx._test?.createTrustline ?? (async (xdr: string) => effectiveSigner(xdr));

  // O15: sourceSequence must be numeric string
  if (params.sourceSequence !== undefined && !/^\d+$/.test(params.sourceSequence)) {
    throw new InvalidConfigError('sourceSequence must be numeric string');
  }

  await ensureTrustline({
    destination: stellarDestination,
    allowCreation: allowTrustline,
    spendCapXlm: spendCap,
    hasTrustline,
    createTrustline,
    usdcIssuer: ctx.defaultUsdcIssuer ?? TESTNET_USDC_ISSUER,
  });

  // 9. Soroban Forwarder Mint Submission
  const forwarderContractId =
    params.forwarderContractId ?? ctx.defaultForwarderContractId;

  if (!forwarderContractId) {
    throw new MintFailedError(burnTxHash, 'forwarderContractId required. Pass params.forwarderContractId or config.network/forwarderContractId.');
  }

  // O15: validate sponsorAccount early (before buildMintAndForwardXdr)
  if (params.sponsorAccount && !StrKey.isValidEd25519PublicKey(params.sponsorAccount)) {
    throw new InvalidAddressError(params.sponsorAccount, 'sponsorAccount must be a valid G... StrKey');
  }

  // O15/B2: the sponsor is the mint TX source; with `destination` gone there is no
  // fallback source account, so fail loud rather than passing undefined downward.
  const sponsor = params.sponsorAccount ?? ctx.defaultSponsorAccount;
  if (!sponsor) {
    throw new InvalidConfigError(
      'sponsorAccount is required. Pass params.sponsorAccount or config.sponsorAccount.'
    );
  }

  // B3/B4: the Soroban transport is injected — no silent testnet default. Without it
  // the mint could not be simulated, broadcast or confirmed.
  const rpc = params.rpc ?? ctx.defaultRpc;
  if (!rpc) {
    throw new MintFailedError(
      burnTxHash,
      'No Soroban transport configured. Pass params.rpc or config.sorobanTransport.'
    );
  }

  let mintResult: Awaited<ReturnType<typeof submitMint>>;
  try {
    mintResult = await submitMint(
      {
        message: attResult.message,
        signature: attResult.signature,
        forwarderContractId,
        sourceAccount: sponsor,
        ...(params.sourceSequence === undefined ? {} : { sourceSequence: params.sourceSequence }),
      },
      effectiveSigner,
      rpc
    );
  } catch (submitErr) {
    ctx.emitter.emit('onError', { error: submitErr, burnTxHash });
    throw submitErr;
  }

  // C5: Mark 'submitted' immediately after mint TX sent (crash here → retry sees submitted, no double-mint)
  const timestamp = new Date().toISOString();
  await ctx.replayStore.markProcessed(burnTxHash, {
    burnTxHash,
    txHash: mintResult.txHash,
    sourceDomain,
    destinationAddress: stellarDestination,
    timestamp,
    status: 'submitted',
  });

  // 10. Decimal Conversion (6 -> 7 decimals) & Dust Routing
  // B7: on a Fast transfer the forwarder mints `amount - feeExecuted` (the source-side
  // fee was already taken), so the receipt must report the net credited amount — not
  // the gross burn amount. `dust` stays structurally zero for the exact EVM→Stellar ×10.
  const { stellarAmount, dust } = convert6to7(parsedAmount - feeExecuted);

  const effectiveDustCollector = resolveDustCollector({
    dest: stellarDestination,
    param: params.dustCollectorAddress,
    cfg: ctx.defaultDustCollector,
  });

  // M4: validate resolved dust collector is valid StrKey
  if (!StrKey.isValidEd25519PublicKey(effectiveDustCollector)) {
    throw new InvalidConfigError(`dustCollectorAddress must be a valid G... StrKey, got: "${effectiveDustCollector}"`);
  }

  // C5: Mark 'settled' after post-mint work completes (full record with amount/dust)
  const record: SettlementRecord = {
    burnTxHash,
    txHash: mintResult.txHash,
    amount: stellarAmount,
    dust,
    sourceDomain,
    destinationAddress: stellarDestination,
    timestamp,
    status: 'settled',
  };
  await ctx.replayStore.markProcessed(burnTxHash, record);

  // 12. Emit Lifecycle Events
  ctx.emitter.emit('onSettled', {
    amount: stellarAmount,
    dust,
    txHash: mintResult.txHash,
    sourceDomain,
    destinationAddress: stellarDestination,
    timestamp,
  });

  if (dust > 0n) {
    ctx.emitter.emit('onDustCollected', {
      amount: dust,
      collector: effectiveDustCollector,
      burnTxHash,
    });
  }

  ctx.logger.info('Transfer settled successfully', {
    burnTxHash,
    mintTxHash: mintResult.txHash,
    stellarAmount: stellarAmount.toString(),
  });

  return {
    amount: stellarAmount,
    dust,
    txHash: mintResult.txHash,
    settled: true,
  };
}
