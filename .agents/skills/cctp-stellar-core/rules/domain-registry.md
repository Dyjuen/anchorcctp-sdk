# Domain ID Registry & Mapping

## CCTP Domain ID System
Unlike standard EVM `chainId` (e.g. Ethereum = 1, Arbitrum = 42161), Circle's CCTP assigns arbitrary integer domain identifiers:

| Domain ID | Chain Name | Network Type |
|---|---|---|
| **0** | Ethereum | EVM |
| **1** | Avalanche | EVM |
| **2** | Optimism / OP Mainnet | EVM |
| **3** | Arbitrum | EVM |
| **5** | Solana | Non-EVM (SVM) |
| **6** | Base | EVM |
| **7** | Polygon PoS | EVM |
| **27** | **Stellar** | **Non-EVM (Soroban / Classic)** |

*(Total 23+ supported chains in registry)*

## Domain Verification Rules
1. **Data-Driven Map**: Store domain mappings in `packages/core/src/domains/registry.ts`.
2. **Allow-List Check**:
   ```typescript
   export function isSupportedDomain(domainId: number): boolean {
     return domainId in CCTP_DOMAINS;
   }
   ```
3. **Strict Rejection**: Any unlisted domain ID passed to `AnchorCCTP.receive()` must throw `InvalidDomainError` immediately before network requests are initiated.
