import { EventEmitter } from 'events';

export interface ReceivingPayload {
  burnTxHash: string;
  status: string;
  attempt?: number;
  elapsedTimeMs?: number;
  sourceDomain?: number;
}

export interface SettledPayload {
  amount: bigint;
  dust: bigint;
  txHash: string;
  sourceDomain?: number;
  destinationAddress?: string;
  timestamp?: string;
}

export interface DustCollectedPayload {
  amount: bigint;
  collector: string;
  burnTxHash?: string;
}

export interface ErrorPayload {
  error: unknown;
  burnTxHash?: string;
}

export interface AnchorCCTPEvents {
  onReceiving: ReceivingPayload;
  onSettled: SettledPayload;
  onDustCollected: DustCollectedPayload;
  onError: ErrorPayload;
}

export type EventKey = keyof AnchorCCTPEvents;
export type EventHandler<K extends EventKey> = (payload: AnchorCCTPEvents[K]) => void;

export interface AnchorCCTPEventEmitter {
  on<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  once<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  off<K extends EventKey>(event: K, handler: EventHandler<K>): this;
  emit<K extends EventKey>(event: K, payload: AnchorCCTPEvents[K]): boolean;
}

/**
 * Creates a strongly-typed lifecycle event emitter for AnchorCCTP.
 */
export function createEventEmitter(): AnchorCCTPEventEmitter {
  const ee = new EventEmitter();

  const typedEmitter: AnchorCCTPEventEmitter = {
    on<K extends EventKey>(event: K, handler: EventHandler<K>) {
      ee.on(event, handler as (...args: unknown[]) => void);
      return typedEmitter;
    },
    once<K extends EventKey>(event: K, handler: EventHandler<K>) {
      ee.once(event, handler as (...args: unknown[]) => void);
      return typedEmitter;
    },
    off<K extends EventKey>(event: K, handler: EventHandler<K>) {
      ee.off(event, handler as (...args: unknown[]) => void);
      return typedEmitter;
    },
    emit<K extends EventKey>(event: K, payload: AnchorCCTPEvents[K]) {
      return ee.emit(event, payload);
    },
  };

  return typedEmitter;
}
