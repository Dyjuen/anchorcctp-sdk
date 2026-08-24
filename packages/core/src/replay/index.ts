export interface SettlementRecord {
  burnTxHash: string;
  txHash: string;
  amount?: bigint;
  dust?: bigint;
  sourceDomain?: number;
  destinationAddress?: string;
  timestamp?: string;
}

export interface IReplayStoreAdapter {
  isProcessed(burnTxHash: string): Promise<boolean> | boolean;
  markProcessed(burnTxHash: string, record: SettlementRecord): Promise<void> | void;
  getRecord(burnTxHash: string): Promise<SettlementRecord | null> | SettlementRecord | null;
}

class InMemoryReplayStore implements IReplayStoreAdapter {
  private readonly store = new Map<string, SettlementRecord>();

  isProcessed(burnTxHash: string): boolean {
    return this.store.has(burnTxHash);
  }

  markProcessed(burnTxHash: string, record: SettlementRecord): void {
    this.store.set(burnTxHash, record);
  }

  getRecord(burnTxHash: string): SettlementRecord | null {
    return this.store.get(burnTxHash) || null;
  }
}

/**
 * Idempotency store to track processed CCTP burn transactions and prevent double-crediting.
 */
export class ReplayStore {
  private readonly adapter: IReplayStoreAdapter;

  constructor(adapter?: IReplayStoreAdapter) {
    this.adapter = adapter || new InMemoryReplayStore();
  }

  async isProcessed(burnTxHash: string): Promise<boolean> {
    return this.adapter.isProcessed(burnTxHash);
  }

  async markProcessed(burnTxHash: string, record: SettlementRecord): Promise<void> {
    await this.adapter.markProcessed(burnTxHash, record);
  }

  async getRecord(burnTxHash: string): Promise<SettlementRecord | null> {
    return this.adapter.getRecord(burnTxHash);
  }
}
