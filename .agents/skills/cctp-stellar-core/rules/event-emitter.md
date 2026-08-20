# Typed Event Emitter & Lifecycle Hooks

## Lifecycle Overview
The SDK provides full visibility into the asynchronous CCTP deposit lifecycle via strongly-typed event emitters.

## Event Definitions

### 1. `onReceiving`
Emitted periodically during Circle Attestation API polling.
```typescript
export interface ReceivingEvent {
  status: 'pending';
  sourceDomain: number;
  burnTxHash: string;
  attempt: number;
  elapsedTimeMs: number;
  estimatedRemainingMs?: number;
}
```

### 2. `onSettled`
Emitted once the transfer has been verified, minted on Stellar, and credited to the destination account.
```typescript
export interface SettledEvent {
  sourceDomain: number;
  burnTxHash: string;
  destinationAddress: string;
  amount: bigint;          // 7-decimal stroops
  dust: bigint;            // dust amount collected
  mintTxHash: string;      // Stellar transaction hash
  timestamp: string;       // ISO 8601
}
```

### 3. `onDustCollected`
Emitted whenever non-zero dust is routed to the configured dust-collector account.
```typescript
export interface DustCollectedEvent {
  dustAmount: bigint;
  dustCollectorAddress: string;
  burnTxHash: string;
}
```

## Implementation Standards
- Use Node's `EventEmitter` or a custom lightweight typed emitter in `packages/core/src/events/emitter.ts`.
- Ensure event handlers are invoked asynchronously without blocking the internal polling loop.
