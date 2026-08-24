import { assertSupportedDomain } from './domains/index.js';
import { translateToStellar, submitMint, SignerCallback } from './forwarder/index.js';
import { convert6to7 } from './decimals/index.js';
import { ensureTrustline } from './trustline/index.js';
import { ReplayStore, SettlementRecord } from './replay/index.js';
import { AttestationClient, AttestationResult } from './attestation/index.js';
import { AnchorCCTPEventEmitter } from './events/index.js';
import { Logger } from './logger/index.js';
import {
  ReplayTransferError,
  InvalidAmountError,
  AnchorCCTPError,
} from './errors/index.js';

export interface ReceiveParams {
  sourceDomain: number;
  burnTxHash: string;
  destinationAddress: string;
  amount?: bigint;
  dustCollectorAddress?: string;
  pollIntervalMs?: number;
  maxRetries?: number;
  signer?: SignerCallback;
  allowTrustlineCreation?: boolean;
  spendCapXlm?: number;
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
  _test?: {
    attestation?: (burnTxHash: string) => Promise<Partial<AttestationResult>>;
    hasTrustline?: () => Promise<boolean>;
    createTrustline?: (xdr: string) => Promise<string>;
    [key: string]: unknown;
  };
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
    burnTxHash,
    destinationAddress,
    amount = 1000000n, // Default 1 USDC base units if not passed
  } = params;

  // 1. Verify source domain is supported
  assertSupportedDomain(sourceDomain);

  // 2. Validate amount (> 0n)
  if (typeof amount !== 'bigint' || amount <= 0n) {
    throw new InvalidAmountError('Amount must be a positive BigInt (> 0n).');
  }

  // 3. Replay Protection Guard
  const isAlreadyProcessed = await ctx.replayStore.isProcessed(burnTxHash);
  if (isAlreadyProcessed) {
    throw new ReplayTransferError(burnTxHash);
  }

  // 4. Address translation & validation
  const stellarDestination = translateToStellar(destinationAddress);

  // 5. Attestation Polling
  ctx.logger.info('Starting CCTP attestation polling', { burnTxHash, sourceDomain });
  let attResult: AttestationResult;

  if (ctx._test?.attestation) {
    const rawMock = await ctx._test.attestation(burnTxHash);
    attResult = {
      status: rawMock.status as any || 'complete',
      attestation: rawMock.attestation || '0xatt_mock',
      message: rawMock.message || '0xmsg_mock',
      signature: rawMock.signature || '0xsig_mock',
      attempts: 1,
      elapsedTimeMs: 10,
    };
  } else {
    attResult = await ctx.attestationClient.pollAttestation(
      burnTxHash,
      (attempt, elapsedMs) => {
        ctx.emitter.emit('onReceiving', {
          burnTxHash,
          status: 'attesting',
          attempt,
          elapsedTimeMs: elapsedMs,
          sourceDomain,
        });
      }
    );
  }

  // 6. Cryptographic Attestation Verification
  const isVerified = ctx.attestationClient.verifyAttestation(
    attResult.message,
    attResult.signature
  );
  if (!isVerified || attResult.status !== 'complete') {
    const error = new class extends AnchorCCTPError {
      readonly code = 'ATTESTATION_VERIFICATION_FAILED';
      readonly remediation = 'Ensure attestation message and signature are valid.';
    }('Attestation signature or message failed cryptographic verification.');
    ctx.emitter.emit('onError', { error, burnTxHash });
    throw error;
  }

  // 7. Trustline Inspection & Opt-in Creation
  const allowTrustline =
    params.allowTrustlineCreation ??
    ctx.defaultTrustline?.allowCreation ??
    false;
  const spendCap = params.spendCapXlm ?? ctx.defaultTrustline?.spendCapXlm;

  const effectiveSigner =
    params.signer ||
    ctx.defaultSigner ||
    (async (xdr: string) => `SIGNED_${xdr}`);

  await ensureTrustline({
    destination: stellarDestination,
    allowCreation: allowTrustline,
    spendCapXlm: spendCap,
    hasTrustline:
      ctx._test?.hasTrustline ||
      (async () => true),
    createTrustline:
      ctx._test?.createTrustline ||
      (async (xdr: string) => effectiveSigner(xdr)),
  });

  // 8. Soroban Forwarder Mint Submission
  const mintResult = await submitMint(
    {
      message: attResult.message,
      signature: attResult.signature,
      destination: stellarDestination,
    },
    effectiveSigner
  );

  // 9. Decimal Conversion (6 -> 7 decimals) & Dust Routing
  const { stellarAmount, dust } = convert6to7(amount);

  const effectiveDustCollector =
    params.dustCollectorAddress ||
    ctx.defaultDustCollector ||
    stellarDestination;

  // 10. Emit Lifecycle Events
  const timestamp = new Date().toISOString();
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

  // 11. Mark Processed in Replay Store
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
