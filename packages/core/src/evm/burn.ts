import { parseAbi } from 'viem';
import { buildCctpForwarderHookData, contractStrkeyToBytes32 } from './hook.js';
import { MAX_CCTP_AMOUNT } from '../decimals/index.js';

export const EVM_TESTNET_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`;
export const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
export const STELLAR_DOMAIN = 27;
/** F1: testnet allowlist — every other chainId is refused before any write. */
export const TESTNET_CHAIN_IDS = new Set([84532, 421614, 11155111, 43113]);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

export const MESSENGER_ABI = parseAbi([
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) returns (uint64)',
]);

export interface BurnPlan {
  amount: bigint;
  destinationDomain: number;
  mintRecipient: `0x${string}`;
  destinationCaller: `0x${string}`;
  burnToken: `0x${string}`;
  messenger: `0x${string}`;
  maxFee: bigint;
  minFinalityThreshold: number;
  hookData: `0x${string}`;
}

export interface PlanBurnParams {
  amount: bigint;
  stellarDestination: string;
  forwarderContractId: string;
  burnToken?: `0x${string}`;
  messenger?: `0x${string}`;
  maxFee?: bigint;
}

/** Pure: every EVM arg for a Stellar-bound burn. No network, no keys. */
export function planBurn(params: PlanBurnParams): BurnPlan {
  if (typeof params.amount !== 'bigint' || params.amount <= 0n) {
    throw new BurnError('INVALID_BURN_AMOUNT', `Amount must be > 0n, received ${params.amount}.`);
  }
  if (params.amount > MAX_CCTP_AMOUNT) {
    throw new BurnError('INVALID_BURN_AMOUNT', `Amount ${params.amount} exceeds MAX_CCTP_AMOUNT (${MAX_CCTP_AMOUNT}).`);
  }
  const burnToken = params.burnToken ?? BASE_SEPOLIA_USDC;
  const messenger = params.messenger ?? EVM_TESTNET_MESSENGER;
  const maxFee = params.maxFee ?? 5000n;
  if (!ADDRESS_RE.test(burnToken) || /^0x0+$/.test(burnToken)) throw new BurnError('INVALID_BURN_AMOUNT', `Invalid burnToken: ${burnToken}`);
  if (!ADDRESS_RE.test(messenger) || /^0x0+$/.test(messenger)) throw new BurnError('INVALID_BURN_AMOUNT', `Invalid messenger: ${messenger}`);
  if (maxFee > params.amount) throw new Error(`maxFee exceeds amount: ${maxFee} > ${params.amount}`);
  const fwd = contractStrkeyToBytes32(params.forwarderContractId);
  return {
    amount: params.amount,
    destinationDomain: STELLAR_DOMAIN,
    mintRecipient: fwd,
    destinationCaller: fwd,
    burnToken,
    messenger,
    maxFee,
    minFinalityThreshold: 1000,
    hookData: buildCctpForwarderHookData(params.stellarDestination),
  };
}

export interface BurnClients {
  publicClient: {
    getChainId(): Promise<number>;
    getBalance(a: { address: `0x${string}` }): Promise<bigint>;
    readContract(a: unknown): Promise<unknown>;
    waitForTransactionReceipt(a: { hash: `0x${string}`; timeout: number }): Promise<{ status: string }>;
  };
  walletClient: {
    writeContract(a: unknown): Promise<`0x${string}`>;
  };
  account: `0x${string}` | { address: `0x${string}` };
}

export interface ExecuteBurnParams extends BurnClients {
  plan: BurnPlan;
  expectedChainId: number;
}

export class BurnError extends Error {
  constructor(
    readonly code: 'EVM_CHAIN_PIN' | 'INSUFFICIENT_GAS' | 'INSUFFICIENT_USDC' | 'APPROVE_FAILED' | 'BURN_FAILED' | 'INVALID_BURN_AMOUNT',
    message: string
  ) {
    super(`${code}: ${message}`);
  }
}

/** Executes approve-if-needed + depositForBurnWithHook. Throws BurnError with actionable code. */
export async function executeBurn(params: ExecuteBurnParams): Promise<{ burnTxHash: `0x${string}` }> {
  const { publicClient, walletClient, account: rawAccount, plan, expectedChainId } = params;
  const account = typeof rawAccount === 'string' ? rawAccount : rawAccount.address;
  const chainId = await publicClient.getChainId();
  if (chainId !== expectedChainId || !TESTNET_CHAIN_IDS.has(chainId)) {
    throw new BurnError('EVM_CHAIN_PIN', `chainId=${chainId} refused (expected ${expectedChainId}, testnet allowlist only).`);
  }
  if ((await publicClient.getBalance({ address: account })) === 0n) {
    throw new BurnError('INSUFFICIENT_GAS', 'EVM account has zero native balance.');
  }
  const balance = (await publicClient.readContract({
    address: plan.burnToken, abi: ERC20_ABI, functionName: 'balanceOf', args: [account],
  })) as bigint;
  if (balance < plan.amount) {
    throw new BurnError('INSUFFICIENT_USDC', `balance=${balance} < amount=${plan.amount}.`);
  }
  const allowance = (await publicClient.readContract({
    address: plan.burnToken, abi: ERC20_ABI, functionName: 'allowance', args: [account, plan.messenger],
  })) as bigint;
  if (allowance < plan.amount) {
    const approveHash = await walletClient.writeContract({
      address: plan.burnToken, abi: ERC20_ABI, functionName: 'approve',
      args: [plan.messenger, plan.amount], ...(typeof rawAccount === 'object' ? { account: rawAccount } : { account }),
    });
    const approveRcpt = await publicClient
      .waitForTransactionReceipt({ hash: approveHash, timeout: 120_000 })
      .catch(() => ({ status: 'timeout' }));
    if (approveRcpt.status !== 'success') throw new BurnError('APPROVE_FAILED', `receipt=${approveRcpt.status}.`);
  }
  const burnTxHash = await walletClient.writeContract({
    address: plan.messenger, abi: MESSENGER_ABI, functionName: 'depositForBurn',
    args: [plan.amount, plan.destinationDomain, plan.mintRecipient, plan.burnToken,
      plan.destinationCaller, plan.maxFee, plan.minFinalityThreshold, plan.hookData],
    ...(typeof rawAccount === 'object' ? { account: rawAccount } : { account }),
  });
  const burnRcpt = await publicClient
    .waitForTransactionReceipt({ hash: burnTxHash, timeout: 120_000 })
    .catch(() => ({ status: 'timeout' }));
  if (burnRcpt.status !== 'success') throw new BurnError('BURN_FAILED', `receipt=${burnRcpt.status}.`);
  return { burnTxHash };
}
