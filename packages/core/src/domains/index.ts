import { InvalidDomainError } from '../errors/index.js';

export interface DomainMeta {
  domainId: number;
  chain: string;
  name: string;
  networkType: 'EVM' | 'SVM' | 'Stellar';
}

/**
 * Official CCTP Domain ID Mapping Registry.
 */
export const CCTP_DOMAINS: Readonly<Record<number, DomainMeta>> = {
  0: { domainId: 0, chain: 'ethereum', name: 'Ethereum', networkType: 'EVM' },
  1: { domainId: 1, chain: 'avalanche', name: 'Avalanche', networkType: 'EVM' },
  2: { domainId: 2, chain: 'optimism', name: 'OP Mainnet', networkType: 'EVM' },
  3: { domainId: 3, chain: 'arbitrum', name: 'Arbitrum', networkType: 'EVM' },
  5: { domainId: 5, chain: 'solana', name: 'Solana', networkType: 'SVM' },
  6: { domainId: 6, chain: 'base', name: 'Base', networkType: 'EVM' },
  7: { domainId: 7, chain: 'polygon', name: 'Polygon PoS', networkType: 'EVM' },
  27: { domainId: 27, chain: 'stellar', name: 'Stellar', networkType: 'Stellar' },
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
