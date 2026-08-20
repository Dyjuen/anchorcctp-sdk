# Replay Protection & Idempotency Store

## The Replay Attack Threat
Cross-chain transfers involve asynchronous event delivery and webhooks. An attacker (or a network retry) may attempt to re-submit an already-credited `burnTxHash` to induce double-crediting.

## Idempotency Protocol
1. **Key Identifier**: The SHA256/Keccak256 hash of the origin burn transaction (`burnTxHash`) or Circle message hash serves as the unique idempotency key.
2. **State Store**:
   - `packages/core` accepts a pluggable storage interface:
     ```typescript
     export interface TransferStore {
       isProcessed(burnTxHash: string): Promise<boolean>;
       markProcessed(burnTxHash: string, record: SettlementRecord): Promise<void>;
       getSettlement(burnTxHash: string): Promise<SettlementRecord | null>;
     }
     ```
   - Default in-memory store provided for lightweight environments.
3. **Execution Guard**:
   - Before executing Soroban forwarder calls or balance credits, check `isProcessed(burnTxHash)`.
   - If already processed: Return the existing settlement record immediately. **Do not re-execute the credit transaction.**
