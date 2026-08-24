import { AttestationClient } from './attestation/index.js';
import { ReplayStore } from './replay/index.js';
import {
  createEventEmitter,
  AnchorCCTPEvents,
  EventKey,
  EventHandler,
  AnchorCCTPEventEmitter,
} from './events/index.js';
import { createLogger, Logger } from './logger/index.js';
import { receive, ReceiveParams, ReceiveResult, ReceiveContext } from './receive.js';
import { SignerCallback } from './forwarder/index.js';

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
  _test?: Record<string, unknown>;
}


export interface AnchorCCTP {
  receive(params: ReceiveParams): Promise<ReceiveResult>;
  on<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  once<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  off<K extends EventKey>(event: K, handler: EventHandler<K>): this;
}

function isLogger(obj: unknown): obj is Logger {
  return typeof obj === 'object' && obj !== null && 'info' in obj;
}

/**
 * Factory creating an AnchorCCTP SDK client.
 */
export function createAnchorCCTP(config: AnchorCCTPConfig): AnchorCCTP {
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
    fetchImpl: config.fetchImpl || (config._test?.fetchImpl as any),
    pollIntervalMs: config.pollIntervalMs,
    maxRetries: config.maxRetries,
    logger,
  });


  const replayStore = config.replayStore || new ReplayStore();
  const emitter: AnchorCCTPEventEmitter = createEventEmitter();

  const ctx: ReceiveContext = {
    attestationClient,
    replayStore,
    emitter,
    logger,
    defaultSigner: config.signer,
    defaultDustCollector: config.dustCollectorAddress,
    defaultTrustline: config.trustline,
    _test: config._test as any,
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
