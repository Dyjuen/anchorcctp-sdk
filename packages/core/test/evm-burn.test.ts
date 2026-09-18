import {
  planBurn,
  executeBurn,
  EVM_TESTNET_MESSENGER,
  BASE_SEPOLIA_USDC,
  STELLAR_DOMAIN,
  TESTNET_CHAIN_IDS,
  BurnError,
} from '../src/evm/burn.js';
import { buildCctpForwarderHookData, contractStrkeyToBytes32 } from '../src/evm/hook.js';

const FWD = 'CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ';
const DEST = 'GCX2EQXSPCHMBSEGYZRVTZWOIDRXWRWYEFRTCNVOZPYXE4QEFPKNUF3V';

describe('planBurn', () => {
  test('pure args: domain 27, defaults, recipient===caller, hookData, finality 1000', () => {
    const plan = planBurn({ amount: 1_000_000n, stellarDestination: DEST, forwarderContractId: FWD });
    expect(plan.amount).toBe(1_000_000n);
    expect(plan.destinationDomain).toBe(STELLAR_DOMAIN);
    expect(plan.destinationDomain).toBe(27);
    expect(plan.mintRecipient).toBe(contractStrkeyToBytes32(FWD));
    expect(plan.destinationCaller).toBe(plan.mintRecipient);
    expect(plan.burnToken).toBe(BASE_SEPOLIA_USDC);
    expect(plan.messenger).toBe(EVM_TESTNET_MESSENGER);
    expect(plan.maxFee).toBe(5000n);
    expect(plan.minFinalityThreshold).toBe(1000);
    expect(plan.hookData).toBe(buildCctpForwarderHookData(DEST));
  });

  test('overrides honored', () => {
    const customToken = '0x0000000000000000000000000000000000000001' as `0x${string}`;
    const plan = planBurn({
      amount: 2_000_000n,
      stellarDestination: DEST,
      forwarderContractId: FWD,
      burnToken: customToken,
      maxFee: 999n,
    });
    expect(plan.amount).toBe(2_000_000n);
    expect(plan.burnToken).toBe(customToken);
    expect(plan.maxFee).toBe(999n);
  });

  test('F2: maxFee > amount throws', () => {
    expect(() =>
      planBurn({ amount: 100n, stellarDestination: DEST, forwarderContractId: FWD, maxFee: 200n }),
    ).toThrow('maxFee exceeds amount');
  });

  test('F3: invalid burnToken throws', () => {
    expect(() =>
      planBurn({ amount: 1_000_000n, stellarDestination: DEST, forwarderContractId: FWD, burnToken: '0x123' as `0x${string}` }),
    ).toThrow('Invalid burnToken');
  });

  test('F3: invalid messenger throws', () => {
    expect(() =>
      planBurn({ amount: 1_000_000n, stellarDestination: DEST, forwarderContractId: FWD, messenger: 'USDC' as `0x${string}` }),
    ).toThrow('Invalid messenger');
  });

  test('M10: zero amount throws INVALID_BURN_AMOUNT', () => {
    expect(() =>
      planBurn({ amount: 0n, stellarDestination: DEST, forwarderContractId: FWD }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_BURN_AMOUNT' }));
  });

  test('M10: negative amount throws INVALID_BURN_AMOUNT', () => {
    expect(() =>
      planBurn({ amount: -1n, stellarDestination: DEST, forwarderContractId: FWD }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_BURN_AMOUNT' }));
  });

  test('M10: amount above MAX_CCTP_AMOUNT throws INVALID_BURN_AMOUNT', () => {
    expect(() =>
      planBurn({ amount: 2n ** 64n, stellarDestination: DEST, forwarderContractId: FWD }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_BURN_AMOUNT' }));
  });

  test('rejects zero burnToken address', () => {
    expect(() =>
      planBurn({ amount: 1000n, stellarDestination: DEST, forwarderContractId: FWD, burnToken: '0x' + '00'.repeat(20) }),
    ).toThrow('Invalid burnToken');
  });

  test('rejects zero messenger address', () => {
    expect(() =>
      planBurn({ amount: 1000n, stellarDestination: DEST, forwarderContractId: FWD, messenger: '0x' + '00'.repeat(20) }),
    ).toThrow('Invalid messenger');
  });
});

function fakes(overrides?: {
  chainId?: number;
  balance?: bigint;
  allowance?: bigint;
  usdcBalance?: bigint;
  receipt?: { status: string };
}) {
  const writes: string[] = [];
  const publicClient = {
    getChainId: jest.fn(async () => overrides?.chainId ?? 84532),
    getBalance: jest.fn(async () => overrides?.balance ?? 10n ** 16n),
    readContract: jest.fn(async (args: { functionName: string }) => {
      if (args.functionName === 'balanceOf') return overrides?.usdcBalance ?? 5_000_000n;
      if (args.functionName === 'allowance') return overrides?.allowance ?? 0n;
      return 0n;
    }),
    waitForTransactionReceipt: jest.fn(async () => overrides?.receipt ?? { status: 'success' }),
  };
  const walletClient = {
    writeContract: jest.fn(async (args: { functionName: string }) => {
      writes.push(args.functionName);
      return '0xdeadbeef' as `0x${string}`;
    }),
  };
  return { publicClient, walletClient, writes };
}

describe('executeBurn', () => {
  const account = '0x0000000000000000000000000000000000000001' as `0x${string}`;
  const plan = planBurn({ amount: 1_000_000n, stellarDestination: DEST, forwarderContractId: FWD });

  test('approve-then-burn order', async () => {
    const { publicClient, walletClient, writes } = fakes();
    const result = await executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 84532 });
    expect(writes).toEqual(['approve', 'depositForBurn']);
    expect(result.burnTxHash).toBe('0xdeadbeef');
  });

  test('skip-approve when allowance sufficient', async () => {
    const { publicClient, walletClient, writes } = fakes({ allowance: 9_999_999n });
    await executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 84532 });
    expect(writes).toEqual(['depositForBurn']);
  });

  test('chainId mismatch → EVM_CHAIN_PIN', async () => {
    const { publicClient, walletClient, writes } = fakes({ chainId: 1 });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 1 }),
    ).rejects.toThrow(BurnError);
    expect(writes).toEqual([]);
  });

  test('expected 421614 vs actual 84532 → EVM_CHAIN_PIN', async () => {
    const { publicClient, walletClient } = fakes({ chainId: 84532 });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 421614 }),
    ).rejects.toThrow(BurnError);
  });

  test('chainId 99999 + expected 99999 → EVM_CHAIN_PIN (F1 allowlist)', async () => {
    const { publicClient, walletClient, writes } = fakes({ chainId: 99999 });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 99999 }),
    ).rejects.toThrow(BurnError);
    expect(writes).toEqual([]);
  });

  test('getBalance 0n → INSUFFICIENT_GAS', async () => {
    const { publicClient, walletClient } = fakes({ balance: 0n });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 84532 }),
    ).rejects.toThrow(BurnError);
  });

  test('balanceOf 100n → INSUFFICIENT_USDC', async () => {
    const { publicClient, walletClient } = fakes({ usdcBalance: 100n });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 84532 }),
    ).rejects.toThrow(BurnError);
  });

  test('allowance high + receipt reverted → BURN_FAILED', async () => {
    const { publicClient, walletClient } = fakes({ allowance: 9_999_999n, receipt: { status: 'reverted' } });
    await expect(
      executeBurn({ publicClient, walletClient, account, plan, expectedChainId: 84532 }),
    ).rejects.toThrow(BurnError);
  });
});
