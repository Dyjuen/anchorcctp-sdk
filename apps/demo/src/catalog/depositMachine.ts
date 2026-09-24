import { MAX_CCTP_AMOUNT } from '@anchor-cctp/core-sdk';

export interface DepositState {
  step: 'idle' | 'verifying' | 'attesting' | 'submitting' | 'settled' | 'error';
  attempts: number;
  receipt?: {
    stellarAmount: string;
    dust: string;
    txHash: string;
    simulated: boolean;
  };
  errorDetails?: string;
}

export const initialDeposit: DepositState = { step: 'idle', attempts: 0 };

/** Parse human USDC string (≤6 decimals) to bigint base-6 units. */
export function parseUsdcBase6(raw: string): bigint {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Amount must be positive USDC with ≤6 decimals');
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) throw new Error('Amount must be positive USDC with ≤6 decimals precision');
  const [whole, frac = ''] = trimmed.split('.');
  const padded = frac.padEnd(6, '0');
  const val = BigInt(whole) * 1_000_000n + BigInt(padded);
  if (val <= 0n) throw new Error('Amount must be positive USDC with ≤6 decimals');
  if (val > MAX_CCTP_AMOUNT) throw new Error('Amount overflows u64 (too large)');
  return val;
}

export type DepositEvent =
  | { type: 'receiving'; attempt: number }
  | { type: 'submitting' }
  | { type: 'settled'; simulated: boolean; txHash: string; stellarAmount: string; dust: string }
  | { type: 'error'; message: string };

export function reduceDeposit(state: DepositState, event: DepositEvent): DepositState {
  switch (event.type) {
    case 'receiving':
      return { ...state, step: 'attesting', attempts: event.attempt };
    case 'submitting':
      return { ...state, step: 'submitting' };
    case 'settled':
      return {
        ...state,
        step: 'settled',
        receipt: {
          stellarAmount: event.stellarAmount,
          dust: event.dust,
          txHash: event.txHash,
          simulated: event.simulated,
        },
      };
    case 'error':
      return { ...state, step: 'error', errorDetails: event.message };
    default:
      return state;
  }
}

export function buildEventsUrl(params: {
  address: string;
  burnTxHash: string;
  sourceDomain: number;
  amount?: string;
}): string {
  let u =
    '/api/events?address=' +
    encodeURIComponent(params.address) +
    '&burnTxHash=' +
    encodeURIComponent(params.burnTxHash) +
    '&sourceDomain=' +
    encodeURIComponent(String(params.sourceDomain));
  if (params.amount !== undefined) {
    u += '&amount=' + encodeURIComponent(params.amount);
  }
  return u;
}

export async function postReceiveIntent(
  fetcher: typeof fetch,
  params: { burnTxHash: string; address: string; amount: string },
): Promise<void> {
  const res = await fetcher('/api/receive:initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any)?.error?.remediation ?? `Server returned ${res.status}`;
    throw new Error(msg);
  }
}

export function assertAddressUnchanged(connected: string, live: string): void {
  if (connected.trim() !== live.trim()) {
    throw new Error('Network mismatch: wallet address changed');
  }
}

/** Normalize freighter-api getAddress() result ({address} object or legacy string) to address or null. */
export function extractLiveAddress(result: unknown): string | null {
  if (typeof result === 'string') return result || null;
  if (result && typeof result === 'object' && typeof (result as { address?: unknown }).address === 'string') {
    return ((result as { address: string }).address) || null;
  }
  return null;
}

/** Map a simError select value to a synthetic DepositEvent, or null for 'none'. */
export function simErrorEvent(value: string): DepositEvent | null {
  switch (value) {
    case 'rejected-signing':
      return { type: 'error', message: 'Freighter signing rejected — unlock wallet and approve the transaction' };
    case 'insufficient-xlm':
      return { type: 'error', message: 'Insufficient XLM balance — fund with testnet friendbot: https://friendbot.stellar.org' };
    case 'network-mismatch':
      return { type: 'error', message: 'Network mismatch — switch Freighter wallet to the correct network and retry' };
    default:
      return null;
  }
}
