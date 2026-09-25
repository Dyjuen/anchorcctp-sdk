import type { SettlementRecord } from './index.js';

/**
 * Bigint-safe JSON for settlement records. `amount`/`dust` are the only bigint
 * fields; they are written as `"<value>n"` strings so a record survives any
 * storage backend that can only carry JSON — `JSON.stringify` throws
 * `TypeError: Do not know how to serialize a BigInt` otherwise.
 */
const BIGINT_SUFFIX_RE = /^-?\d+n$/;

/** `JSON.stringify` replacer that encodes bigints as `"123n"` instead of throwing. */
export function settlementRecordReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? `${value.toString()}n` : value;
}

/** `JSON.parse` reviver that turns `"123n"` back into a bigint. */
export function settlementRecordReviver(_key: string, value: unknown): unknown {
  return typeof value === 'string' && BIGINT_SUFFIX_RE.test(value) ? BigInt(value.slice(0, -1)) : value;
}

/** Encodes a settlement record for KV/file storage. Absent optionals stay absent. */
export function encodeSettlementRecord(record: SettlementRecord): string {
  return JSON.stringify(record, settlementRecordReplacer);
}

/** Decodes a settlement record written by `encodeSettlementRecord` (missing/legacy fields tolerated). */
export function decodeSettlementRecord(raw: string): SettlementRecord {
  return JSON.parse(raw, settlementRecordReviver) as SettlementRecord;
}
