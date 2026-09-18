import { assertSupportedDomain } from './domains/index.js';
import { translateToStellar, submitMint, SignerCallback } from './forwarder/index.js';
import { convert6to7 } from './decimals/index.js';
import { ensureTrustline, TESTNET_USDC_ISSUER } from './trustline/index.js';
import { ReplayStore, SettlementRecord } from './replay/index.js';
import { AttestationClient, AttestationResult } from './attestation/index.js';
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
} from './errors/index.js';

export interface ReceiveParams {
  sourceDomain: number;
  burnTxHash: string;
  destinationAddress: string;
  /**
   * **WARNING (O2):** Amount is caller-supplied and NOT yet bound to the attestation message.
   * Caller MUST pass the attested value from the source-chain burn. Mismatch check against the
   * on-chain message parser is deferred to a future slice — no silent behavior change today.
   */
  amount: bigint;
  dustCollectorAddress?: string;
  signer?: SignerCallback;
  allowTrustlineCreation?: boolean;
  spendCapXlm?: number;
  forwarderContractId?: string;
  sourceSequence?: string;
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
  defaultUsdcIssuer?: string;
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

  const hasTrustline = ctx._test?.hasTrustline;
  if (!hasTrustline) {
    throw new TrustlineCreationError(stellarDestination, 'No hasTrustline provider wired. Pass Horizon-backed provider via _test.hasTrustline (tests) or production wiring.');
  }
  const createTrustline = ctx._test?.createTrustline ?? (async (xdr: string) => effectiveSigner(xdr));

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

  let mintResult: Awaited<ReturnType<typeof submitMint>>;
  try {
    mintResult = await submitMint(
      {
        message: attResult.message,
        signature: attResult.signature,
        destination: stellarDestination,
        forwarderContractId,
        ...(params.sourceSequence === undefined ? {} : { sourceSequence: params.sourceSequence }),
      },
      effectiveSigner
    );
  } catch (submitErr) {
    ctx.emitter.emit('onError', { error: submitErr, burnTxHash });
    throw submitErr;
  }

  // 10. Decimal Conversion (6 -> 7 decimals) & Dust Routing
  const { stellarAmount, dust } = convert6to7(amount);

  const effectiveDustCollector = resolveDustCollector({
    dest: stellarDestination,
    param: params.dustCollectorAddress,
    cfg: ctx.defaultDustCollector,
  });

  // M4: validate resolved dust collector is valid StrKey
  if (!StrKey.isValidEd25519PublicKey(effectiveDustCollector)) {
    throw new InvalidConfigError(`dustCollectorAddress must be a valid G... StrKey, got: "${effectiveDustCollector}"`);
  }

  // 11. Mark Processed BEFORE emitting (crash between emit and mark → no unmarked settlement)
  const timestamp = new Date().toISOString();
  const record: SettlementRecord = {
    burnTxHash,
    txHash: mintResult.txHash,
    amount: stellarAmount,
    dust,
    sourceDomain,
    destinationAddress: stellarDestination,
    timestamp,
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
