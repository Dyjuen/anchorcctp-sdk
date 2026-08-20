# Decimal Conversion & Dust Math

## The Decimal Mismatch Problem
- **Stellar Native USDC**: Uses **7 decimal places** ($1\text{ USDC} = 10,000,000\text{ stroops}$).
- **CCTP Standard USDC**: Uses **6 decimal places** ($1\text{ USDC} = 1,000,000\text{ base units}$).

## Conversion Rules

### 1. Inbound (CCTP 6 $\rightarrow$ Stellar 7)
- Converting 6 to 7 decimals is an exact expansion:
  $$\text{stellarUnits} = \text{cctpUnits} \times 10$$
- Example: $100.500000\text{ USDC}$ ($100,500,000$ base units) $\rightarrow 1,005,000,000$ stroops ($100.5000000\text{ USDC}$).
- Dust remainder is `0n`.

### 2. Outbound / Split-Accounting (Stellar 7 $\rightarrow$ CCTP 6)
- When converting 7 to 6 decimals:
  $$\text{cctpUnits} = \lfloor\text{stellarUnits} / 10\rfloor$$
  $$\text{dust} = \text{stellarUnits} \pmod{10}$$
- The 1-stroop remainder ($10^{-7}\text{ USDC}$) cannot be represented on a 6-decimal chain.

## Strict Implementation Invariants
1. **BigInt Only**: Never use JavaScript `Number` or floating point for amounts.
2. **Deterministic Rounding**: Round down on credit amounts; never round up (which would create unbacked USDC).
3. **Dust Routing**: Any non-zero dust is routed to the configured `dustCollectorAddress`.
4. **Conservation Invariant**: $\text{creditedAmount} + \text{dust} \le \text{sourceAmount}$.
5. **Validation**: Reject negative (`< 0n`) or zero (`=== 0n`) amounts with `InvalidAmountError`.
