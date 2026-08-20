# Test-Driven Development (TDD) Protocols

## The Red-Green-Refactor Loop
1. **Red**: Write a failing unit test under `packages/core/test/` before writing any feature code. Run `npm test` and confirm the test fails for the expected reason.
2. **Green**: Implement the minimum code necessary in `packages/core/src/` to make the test pass.
3. **Refactor**: Clean up the code while keeping all tests green.

## Mandatory Coverage Requirements
- **Coverage Target**: $\ge 90\%$ line coverage on `packages/core`.
- **Property-Based Testing**: Test decimal conversion with extreme boundaries:
  - 0 base units (should reject)
  - 1 base unit ($10^{-6}\text{ USDC}$)
  - Max `uint64` / `uint128` values
  - Large values with decimal dust
- **Test Scenarios by Domain**:
  - `attestation`: Test mock 200 OK complete, mock pending, mock timeout (exhausted retries), network failure with retry.
  - `decimals`: 6-to-7 exact scaling, 7-to-6 dust calculation, dust routing.
  - `domains`: Known domain acceptance, unknown domain rejection.
  - `trustline`: Existing trustline detection, missing trustline with auto-create enabled vs disabled.
  - `replay`: Replay of identical `burnTxHash` returns idempotent cached result without double credit.
