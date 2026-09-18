import type { IReplayStoreAdapter, SettlementRecord } from './index.js';

function normalizeKey(h: string): string {
  return '0x' + h.trim().slice(2).toLowerCase();
}

/**
 * File-backed replay store with atomic writes (tmp+rename) and 0o600 permissions.
 * Use for production persistence; survives process restarts sharing one JSON file.
 */
export class FileReplayStore implements IReplayStoreAdapter {
  constructor(private readonly path: string) {}

  private read(): Record<string, SettlementRecord> {
    try {
      // ponytail: lazy Node fs via getBuiltinModule — browser safe
      const proc = (globalThis as { process?: unknown }).process as
        | { getBuiltinModule?: (m: string) => { readFileSync(p: string, e: string): string } }
        | undefined;
      const fs = proc?.getBuiltinModule?.('node:fs');
      if (!fs) return {};
      return JSON.parse(fs.readFileSync(this.path, 'utf8'));
    } catch {
      return {};
    }
  }

  private write(all: Record<string, SettlementRecord>): void {
    const proc = (globalThis as { process?: unknown }).process as
      | { getBuiltinModule?: (m: string) => { writeFileSync(p: string, d: string, o: unknown): void; renameSync(o: string, n: string): void } }
      | undefined;
    const fs = proc?.getBuiltinModule?.('node:fs');
    if (!fs) throw new Error('FileReplayStore requires Node.js (no fs in browser)');
    const tmp = this.path + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 });
    fs.renameSync(tmp, this.path);
  }

  isProcessed(burnTxHash: string): boolean {
    return normalizeKey(burnTxHash) in this.read();
  }

  markProcessed(burnTxHash: string, record: SettlementRecord): void {
    const key = normalizeKey(burnTxHash);
    const all = this.read();
    all[key] = { ...record, burnTxHash: key };
    this.write(all);
  }

  getRecord(burnTxHash: string): SettlementRecord | null {
    return this.read()[normalizeKey(burnTxHash)] ?? null;
  }
}
