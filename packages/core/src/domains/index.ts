import { InvalidDomainError } from '../errors/index.js';

export interface DomainMeta {
  domainId: number;
  chain: string;
  name: string;
  networkType: 'EVM' | 'SVM' | 'Stellar' | 'Cosmos' | string;
}

/**
 * Official CCTP Domain ID Mapping Registry.
 */
export const CCTP_DOMAINS: Readonly<Record<number, DomainMeta>> = {
  0: { domainId: 0, chain: 'ethereum', name: 'Ethereum', networkType: 'EVM' },
  1: { domainId: 1, chain: 'avalanche', name: 'Avalanche', networkType: 'EVM' },
  2: { domainId: 2, chain: 'optimism', name: 'OP Mainnet', networkType: 'EVM' },
  3: { domainId: 3, chain: 'arbitrum', name: 'Arbitrum', networkType: 'EVM' },
  4: { domainId: 4, chain: 'noble', name: 'Noble', networkType: 'Cosmos' },
  5: { domainId: 5, chain: 'solana', name: 'Solana', networkType: 'SVM' },
  6: { domainId: 6, chain: 'base', name: 'Base', networkType: 'EVM' },
  7: { domainId: 7, chain: 'polygon', name: 'Polygon PoS', networkType: 'EVM' },
  10: { domainId: 10, chain: 'unichain', name: 'Unichain', networkType: 'EVM' },
  11: { domainId: 11, chain: 'linea', name: 'Linea', networkType: 'EVM' },
  12: { domainId: 12, chain: 'codex', name: 'Codex', networkType: 'EVM' },
  13: { domainId: 13, chain: 'sonic', name: 'Sonic', networkType: 'EVM' },
  14: { domainId: 14, chain: 'worldchain', name: 'World Chain', networkType: 'EVM' },
  16: { domainId: 16, chain: 'sei', name: 'Sei', networkType: 'EVM' },
  18: { domainId: 18, chain: 'xdc', name: 'XDC', networkType: 'EVM' },
  19: { domainId: 19, chain: 'hyperevm', name: 'HyperEVM', networkType: 'EVM' },
  21: { domainId: 21, chain: 'ink', name: 'Ink', networkType: 'EVM' },
  22: { domainId: 22, chain: 'plume', name: 'Plume', networkType: 'EVM' },
  25: { domainId: 25, chain: 'starknet', name: 'Starknet', networkType: 'EVM' },
  27: { domainId: 27, chain: 'stellar', name: 'Stellar', networkType: 'Stellar' },
  28: { domainId: 28, chain: 'edge', name: 'EDGE', networkType: 'EVM' },
  29: { domainId: 29, chain: 'injective', name: 'Injective', networkType: 'EVM' },
  30: { domainId: 30, chain: 'morph', name: 'Morph', networkType: 'EVM' },
  31: { domainId: 31, chain: 'pharos', name: 'Pharos', networkType: 'EVM' },
  32: { domainId: 32, chain: 'cronos', name: 'Cronos', networkType: 'EVM' },
  37: { domainId: 37, chain: 'xlayer', name: 'X Layer', networkType: 'EVM' },
};

/**
 * Checks if a domain ID is supported by CCTP.
 */
export function isSupportedDomain(domainId: number): boolean {
  return domainId in CCTP_DOMAINS;
}

/**
 * Asserts that a domain ID is valid or throws InvalidDomainError.
 */
export function assertSupportedDomain(domainId: number): DomainMeta {
  if (!isSupportedDomain(domainId)) {
    throw new InvalidDomainError(domainId);
  }
  return CCTP_DOMAINS[domainId];
}

/**
 * Returns metadata for a supported domain or throws InvalidDomainError.
 */
export function getDomainMeta(domainId: number): DomainMeta {
  return assertSupportedDomain(domainId);
}

