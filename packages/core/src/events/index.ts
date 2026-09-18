
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

interface ListenerWrapper {
  fn: (payload: unknown) => void;
  once: boolean;
}

/**
 * Creates a strongly-typed lifecycle event emitter for AnchorCCTP.
 * Universal zero-dependency implementation compatible with Node, browsers, and Edge runtimes.
 */
export function createEventEmitter(onWarn?: (msg: string) => void): AnchorCCTPEventEmitter {
  const listeners = new Map<EventKey, ListenerWrapper[]>();

  const typedEmitter: AnchorCCTPEventEmitter = {
    on<K extends EventKey>(event: K, handler: EventHandler<K>) {
      const list = listeners.get(event) || [];
      if (list.length >= 10) {
        onWarn?.(`[AnchorCCTP] ${event} has ${list.length + 1} listeners — possible leak`);
      }
      list.push({ fn: handler as (payload: unknown) => void, once: false });
      listeners.set(event, list);
      return typedEmitter;
    },
    once<K extends EventKey>(event: K, handler: EventHandler<K>) {
      const list = listeners.get(event) || [];
      if (list.length >= 10) {
        onWarn?.(`[AnchorCCTP] ${event} has ${list.length + 1} listeners — possible leak`);
      }
      list.push({ fn: handler as (payload: unknown) => void, once: true });
      listeners.set(event, list);
      return typedEmitter;
    },
    off<K extends EventKey>(event: K, handler: EventHandler<K>) {
      const list = listeners.get(event);
      if (list) {
        listeners.set(
          event,
          list.filter((wrapper) => wrapper.fn !== (handler as (payload: unknown) => void))
        );
      }
      return typedEmitter;
    },
    emit<K extends EventKey>(event: K, payload: AnchorCCTPEvents[K]): boolean {
      const list = listeners.get(event);
      if (!list || list.length === 0) {
        return false;
      }
      const copy = [...list];
      listeners.set(
        event,
        list.filter((w) => !w.once)
      );
      for (const wrapper of copy) {
        try {
          wrapper.fn(payload);
        } catch {
          // N2: per-listener try/catch — one thrower never breaks others
        }
      }
      return true;
    },
  };

  return typedEmitter;
}
