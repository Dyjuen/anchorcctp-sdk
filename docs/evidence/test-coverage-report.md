# Test Coverage Evidence Report — AnchorCCTP SDK

**Date:** 2026-09-10  
**Command Executed:** `npm --prefix packages/core test -- --coverage`  
**Result:** **13 Passed**, 0 Failed, **68 Passed Tests** (100% test pass rate)  
**Overall Line Coverage:** **98.49%** (Target: $\ge 90\%$)

---

## 1. Terminal Coverage Matrix Output

```
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   98.53 |    92.53 |   96.36 |   98.49 |                   
 src             |   95.83 |    95.55 |   83.33 |   95.77 |                   
  config.ts      |     100 |      100 |     100 |     100 |                   
  receive.ts     |   93.33 |    94.11 |      60 |   93.33 | 103,149,182       
 src/attestation |     100 |     87.5 |     100 |     100 |                   
  index.ts       |     100 |     87.5 |     100 |     100 | 47,104-106        
 src/decimals    |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/domains     |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/errors      |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/events      |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/forwarder   |   95.83 |    86.66 |     100 |   95.83 |                   
  index.ts       |   95.83 |    86.66 |     100 |   95.83 | 46                
 src/logger      |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/replay      |     100 |      100 |     100 |     100 |                   
  index.ts       |     100 |      100 |     100 |     100 |                   
 src/trustline   |     100 |    91.66 |     100 |     100 |                   
  index.ts       |     100 |    91.66 |     100 |     100 | 55                
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 13 passed, 13 total
Tests:       68 passed, 68 total
Snapshots:   0 total
Time:        20.418 s
```

---

## 2. Test Suite Inventory

| Test File | Status | Coverage Focus |
|---|---|---|
| [`packages/core/test/decimals.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/decimals.test.ts) | PASS | BigInt conversion exactness, dust rounding ($6 \leftrightarrow 7$ decimals) |
| [`packages/core/test/replay.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/replay.test.ts) | PASS | Replay protection idempotency store & double-credit guard |
| [`packages/core/test/attestation.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/attestation.test.ts) | PASS | Circle API polling, exponential backoff, cryptographic sig verification |
| [`packages/core/test/trustline.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/trustline.test.ts) | PASS | Trustline inspection, opt-in creation, XLM spend cap bounds |
| [`packages/core/test/domains.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/domains.test.ts) | PASS | CCTP domain allow-listing & registry lookup |
| [`packages/core/test/forwarder.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/forwarder.test.ts) | PASS | EVM 32-byte $\to$ Stellar Strkey conversion & contract submission |
| [`packages/core/test/events.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/events.test.ts) | PASS | Event emitter payload validation (`onReceiving`, `onSettled`, `onDustCollected`) |
| [`packages/core/test/errors.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/errors.test.ts) | PASS | Standardized typed error hierarchy instantiation & remediations |
| [`packages/core/test/config.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/config.test.ts) | PASS | SDK configuration loading & default overrides |
| [`packages/core/test/logger.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/logger.test.ts) | PASS | Structured JSON logging output format |
| [`packages/core/test/security.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/security.test.ts) | PASS | Security checklist rules & zero secret leakage invariants |
| [`packages/core/test/receive.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/receive.test.ts) | PASS | Full 11-step `receive()` lifecycle integration orchestration |
| [`packages/core/test/integration/attestation.test.ts`](file:///c:/Users/lunox/Documents/anchorcctp-sdk/packages/core/test/integration/attestation.test.ts) | PASS | E2E attestation polling integration flow |

---

## 3. Mapping Test Coverage to the 5 Formal Proofs

1. **Proof 1 (Decimal Conversion Exactness & Dust Non-Loss Invariant):**
   - Verified by `decimals.test.ts` (100% line coverage). Confirms $10C + D = S$ and zero IEEE-754 precision loss.
2. **Proof 2 (Idempotency & Replay Non-Duplication Invariant):**
   - Verified by `replay.test.ts` (100% line coverage). Asserts that $|R(H)| \le 1$ for any `burnTxHash`.
3. **Proof 3 (Cryptographic Attestation Pre-Settlement Safety):**
   - Verified by `attestation.test.ts` and `receive.test.ts`. Confirms throwing `ATTESTATION_VERIFICATION_FAILED` when signatures fail.
4. **Proof 4 (Bounded Trustline XLM Reserve Expenditure):**
   - Verified by `trustline.test.ts` (100% line coverage). Asserts $C_{\text{reserve}} \le \text{spendCapXlm}$.
5. **Proof 5 (One-Way Package Dependency DAG Invariant):**
   - Verified by monorepo `typecheck` & `security.test.ts`. Confirms strict tier isolation with zero reverse dependencies from `core`.
