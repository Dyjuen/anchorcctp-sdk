import { AttestationClient } from './attestation/index.js';
import { ReplayStore } from './replay/index.js';
import {
  createEventEmitter,
  EventKey,
  EventHandler,
  AnchorCCTPEventEmitter,
} from './events/index.js';
import { createLogger, Logger } from './logger/index.js';
import { receive, ReceiveParams, ReceiveResult, ReceiveContext } from './receive.js';
import { SignerCallback, resolveForwarder } from './forwarder/index.js';
import { InvalidConfigError } from './errors/index.js';

export interface TrustlineConfig {
  allowCreation: boolean;
  spendCapXlm?: number;
}

export interface AnchorCCTPConfig {
  attestationBaseUrl?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxRetries?: number;
  dustCollectorAddress?: string;
  signer?: SignerCallback;
  trustline?: TrustlineConfig;
  logger?: Logger | ((msg: string) => void);
  replayStore?: ReplayStore;
  network?: 'testnet' | 'mainnet';
  forwarderContractId?: string;
  usdcIssuer?: string;
  _test?: Record<string, unknown>;
}


export interface AnchorCCTP {
  receive(params: ReceiveParams): Promise<ReceiveResult>;
  on<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  once<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  off<K extends EventKey>(event: K, handler: EventHandler<K>): this;
}

function isLogger(obj: unknown): obj is Logger {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.info === 'function' && typeof o.warn === 'function' && typeof o.error === 'function' && typeof o.debug === 'function';
}

/**
 * Factory creating an AnchorCCTP SDK client.
 */
export function createAnchorCCTP(config: AnchorCCTPConfig): AnchorCCTP {
  // N1: _test overrides forbidden in production
  if (process.env.NODE_ENV === 'production' && config._test) {
    throw new InvalidConfigError('_test overrides forbidden in production');
  }

  let logger: Logger;
  if (isLogger(config.logger)) {
    logger = config.logger;
  } else if (typeof config.logger === 'function') {
    const sink = config.logger;
    logger = createLogger('anchor-cctp', (msg) => sink(msg));
  } else {
    logger = createLogger('anchor-cctp');
  }

  const attestationClient = new AttestationClient({
    baseUrl: config.attestationBaseUrl,
    fetchImpl: config.fetchImpl || (config._test?.fetchImpl as typeof fetch),
    pollIntervalMs: config.pollIntervalMs,
    maxRetries: config.maxRetries,
    logger,
  });


  const replayStore = config.replayStore || new ReplayStore();
  const emitter: AnchorCCTPEventEmitter = createEventEmitter(logger.warn.bind(logger));

  const defaultForwarderContractId = config.forwarderContractId ?? (config.network ? resolveForwarder(config.network) : undefined);

  const trustline = config.trustline ? Object.freeze({ ...config.trustline }) : undefined;

  const ctx: ReceiveContext = {
    attestationClient,
    replayStore,
    emitter,
    logger,
    defaultSigner: config.signer,
    defaultDustCollector: config.dustCollectorAddress,
    defaultTrustline: trustline,
    defaultForwarderContractId,
    defaultUsdcIssuer: config.usdcIssuer,
    _test: config._test,
  };

  const client: AnchorCCTP = {
    async receive(params: ReceiveParams): Promise<ReceiveResult> {
      return receive(params, ctx);
    },
    on<K extends EventKey>(event: K, handler: EventHandler<K>) {
      emitter.on(event, handler);
      return client;
    },
    once<K extends EventKey>(event: K, handler: EventHandler<K>) {
      emitter.once(event, handler);
      return client;
    },
    off<K extends EventKey>(event: K, handler: EventHandler<K>) {
      emitter.off(event, handler);
      return client;
    },
  };

  return client;
}
