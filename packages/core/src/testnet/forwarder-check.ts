import { Address, xdr } from '@stellar/stellar-sdk';

export interface ForwarderCheck {
  deployed: boolean;
  latestLedger?: number;
}

export interface CheckForwarderParams {
  rpcUrl: string;
  contractId: string;
  fetchImpl?: typeof fetch;
}

/** LedgerKey for a contract's INSTANCE entry — always present iff deployed. */
export function forwarderInstanceKeyB64(contractId: string): string {
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
  return key.toXDR('base64') as string;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown, fetchImpl: typeof fetch): Promise<unknown> {
  if (!/^https:\/\//.test(rpcUrl)) {
    throw new Error('rpcUrl must be https');
  }
  const res = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Soroban RPC ${method} failed: ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

/** Proves the forwarder contract exists on the live network (INSTANCE entry present). */
export async function checkForwarderDeployed(params: CheckForwarderParams): Promise<ForwarderCheck> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const latest = await rpcCall(params.rpcUrl, 'getLatestLedger', {}, fetchImpl).catch(() => undefined);
  let entries: unknown;
  try {
    entries = await rpcCall(
      params.rpcUrl,
      'getLedgerEntries',
      { keys: [forwarderInstanceKeyB64(params.contractId)] },
      fetchImpl
    );
  } catch (err) {
    if (err instanceof Error && /Soroban RPC/.test(err.message)) {
      throw new Error(`RPC_ERROR: ${err.message}`);
    }
    throw err;
  }
  const found = Array.isArray((entries as Record<string, unknown>)?.entries) && ((entries as Record<string, unknown>).entries as unknown[]).length > 0;
  return {
    deployed: found === true,
    ...((latest as Record<string, unknown>)?.latestLedger === undefined ? {} : { latestLedger: (latest as Record<string, unknown>).latestLedger as number }),
  };
}
