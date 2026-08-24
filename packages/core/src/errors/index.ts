/**
 * Base error class for all AnchorCCTP errors.
 */
export abstract class AnchorCCTPError extends Error {
  abstract readonly code: string;
  abstract readonly remediation: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when a CCTP domain ID is not in the allow-listed registry.
 */
export class InvalidDomainError extends AnchorCCTPError {
  readonly code = 'INVALID_DOMAIN';
  readonly remediation = 'Provide a supported sourceDomain (e.g. 0 for Ethereum, 6 for Base, 27 for Stellar).';

  constructor(public readonly domainId: number) {
    super(`Unsupported CCTP domain ID: ${domainId}.`);
  }
}

/**
 * Thrown when an invalid or non-positive amount is passed for token conversion.
 */
export class InvalidAmountError extends AnchorCCTPError {
  readonly code = 'INVALID_AMOUNT';
  readonly remediation = 'Ensure the amount is a positive BigInt value (> 0n).';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when Circle Attestation API polling times out before status complete.
 */
export class AttestationTimeoutError extends AnchorCCTPError {
  readonly code = 'ATTESTATION_TIMEOUT';
  readonly remediation = 'Increase pollTimeoutMs or retry once the source chain burn transaction has finalized.';

  constructor(public readonly burnTxHash: string, public readonly elapsedTimeMs: number) {
    super(`Attestation polling timed out for transaction ${burnTxHash} after ${elapsedTimeMs}ms.`);
  }
}

/**
 * Thrown when trustline is missing and auto-creation is disabled or reserve cap is exceeded.
 */
export class TrustlineMissingError extends AnchorCCTPError {
  readonly code = 'TRUSTLINE_MISSING';
  readonly remediation = 'Pass allowTrustlineCreation: true or establish a USDC trustline on the destination account.';

  constructor(public readonly destinationAddress: string) {
    super(`USDC trustline missing for account ${destinationAddress}.`);
  }
}

/**
 * Thrown when Soroban forwarder mint submission fails.
 */
export class MintFailedError extends AnchorCCTPError {
  readonly code = 'MINT_FAILED';
  readonly remediation = 'Verify forwarder contract deployment, destination account status, or retry mint transaction.';

  constructor(public readonly burnTxHash: string, public readonly reason?: string) {
    super(`Failed to submit mint for burn transaction ${burnTxHash}${reason ? `: ${reason}` : ''}.`);
  }
}

/**
 * Thrown when trustline creation transaction fails.
 */
export class TrustlineCreationError extends AnchorCCTPError {
  readonly code = 'TRUSTLINE_CREATION_FAILED';
  readonly remediation = 'Ensure destination account is funded with sufficient XLM to cover base reserves or increase spendCapXlm.';

  constructor(public readonly destinationAddress: string, public readonly reason?: string) {
    super(`Failed to create USDC trustline for account ${destinationAddress}${reason ? `: ${reason}` : ''}.`);
  }
}

/**
 * Thrown when a burn transaction hash has already been processed.
 */
export class ReplayTransferError extends AnchorCCTPError {
  readonly code = 'REPLAY_TRANSFER';
  readonly remediation = 'This burn transaction has already been processed and settled. Check existing settlement records.';

  constructor(public readonly burnTxHash: string) {
    super(`Burn transaction ${burnTxHash} has already been processed.`);
  }
}

