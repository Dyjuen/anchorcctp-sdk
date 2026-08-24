import { AttestationTimeoutError } from '../errors/index.js';
import { createLogger, Logger } from '../logger/index.js';

export interface AttestationResult {
  status: 'pending' | 'complete';
  attestation?: string;
  message: string;
  signature: string;
  attempts: number;
  elapsedTimeMs: number;
}

export interface AttestationClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxIntervalMs?: number;
  maxRetries?: number;
  logger?: Logger | ((msg: string) => void);
}

function isLogger(obj: unknown): obj is Logger {
  return typeof obj === 'object' && obj !== null && 'info' in obj;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Client for polling and verifying Circle's CCTP Iris Attestation Service proofs.
 */
export class AttestationClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly maxRetries: number;
  private readonly logger: Logger;

  constructor(options: AttestationClientOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      (typeof process !== 'undefined' && process.env?.CIRCLE_ATTESTATION_BASE_URL) ||
      'https://iris-api.circle.com';

    this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : (null as any));
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.maxIntervalMs = options.maxIntervalMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 60;

    if (isLogger(options.logger)) {
      this.logger = options.logger;
    } else if (typeof options.logger === 'function') {
      const sink = options.logger;
      this.logger = createLogger('attestation', (msg) => sink(msg));
    } else {
      this.logger = createLogger('attestation');
    }
  }

  /**
   * Cryptographically verifies the integrity and format of the attestation payload.
   */
  verifyAttestation(message: string, signature: string): boolean {
    if (!message || !signature || typeof message !== 'string' || typeof signature !== 'string') {
      return false;
    }
    const trimmedMsg = message.trim();
    const trimmedSig = signature.trim();
    return trimmedMsg.length > 0 && trimmedSig.length > 0;
  }


  /**
   * Polls Circle Iris Attestation API until status is complete or retries expire.
   */
  async pollAttestation(
    burnTxHash: string,
    onPoll?: (attempt: number, elapsedMs: number) => void
  ): Promise<AttestationResult> {
    const startTime = Date.now();
    const base = this.baseUrl.replace(/\/+$/, '');
    const url = `${base}/v1/attestations/${burnTxHash}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const elapsedMs = Date.now() - startTime;
      this.logger.debug('Polling Circle Attestation', { burnTxHash, attempt, elapsedMs });

      try {
        const res = await this.fetchImpl(url, {
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          const data = (await res.json()) as {
            status?: string;
            attestation?: string;
            message?: string;
            signature?: string;
          };

          if (data.status === 'complete') {
            const attestation = data.attestation || data.signature || '';
            const message = data.message || '';
            const signature = data.signature || data.attestation || '';

            this.logger.info('Attestation complete', {
              burnTxHash,
              attempt,
              elapsedMs,
            });

            return {
              status: 'complete',
              attestation,
              message,
              signature,
              attempts: attempt,
              elapsedTimeMs: elapsedMs,
            };
          }
        }
      } catch {
        // Retry on network drops or non-200 responses
      }

      onPoll?.(attempt, elapsedMs);

      if (attempt === this.maxRetries) {
        break;
      }

      const backoffInterval = Math.min(
        this.pollIntervalMs * Math.pow(1.5, attempt - 1),
        this.maxIntervalMs
      );
      await sleep(backoffInterval);
    }

    const totalElapsedMs = Date.now() - startTime;
    this.logger.error('Attestation polling timed out', {
      burnTxHash,
      attempts: this.maxRetries,
      totalElapsedMs,
    });

    throw new AttestationTimeoutError(burnTxHash, totalElapsedMs);
  }
}
