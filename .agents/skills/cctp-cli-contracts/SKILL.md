---
name: cctp-cli-contracts
description: CLI specifications and stdout JSON contracts for @anchor-cctp/cli commands (init, listen, verify, domains).
---

# CCTP CLI Contracts Skill

Load this skill when working on `packages/cli/src/`.

## 1. CLI Design Principles
- **Machine-Readable Standard**: All programmatic data must be emitted as valid JSON to `stdout`.
- **Human Logs**: All diagnostic messages, progress spinners, or human explanations must go to `stderr`.
- **Actionable Errors**: On failure, print structured JSON error with `error`, `code`, and actionable `remediation` message. Exit with non-zero exit code.

## 2. Command Specifications

### A. `anchor-cctp init`
- **Purpose**: Generates the `stellar.toml` CCTP configuration block for anchor operators.
- **Flags/Args**: `--domain <domain>`, `--usdc-issuer <address>`, `--output <filepath>`
- **Output JSON**:
```json
{
  "success": true,
  "configBlock": "[[CURRENCIES]]\ncode=\"USDC\"\n...",
  "writtenPath": "./stellar.toml"
}
```

### B. `anchor-cctp listen <address>`
- **Purpose**: Streams real-time inbound CCTP transfers for a target Stellar address.
- **Output Format**: Newline-delimited JSON stream (NDJSON).
```json
{"event":"inbound_burn_detected","sourceChain":"Ethereum","sourceDomain":0,"amount":"100.000000","status":"attesting","timestamp":"2026-08-20T07:30:00Z"}
{"event":"settled","sourceChain":"Ethereum","destination":"GB...","amount":"100.0000000","dust":"0","txHash":"0x...","timestamp":"2026-08-20T07:35:00Z"}
```

### C. `anchor-cctp verify <txHash>`
- **Purpose**: Checks the burn-to-mint attestation status for a source transaction hash.
- **Output JSON**:
```json
{
  "txHash": "0xabc...",
  "attested": true,
  "status": "complete",
  "sourceDomain": 0,
  "destinationDomain": 27,
  "mintTxHash": "0xdef..."
}
```

### D. `anchor-cctp domains`
- **Purpose**: Lists all supported CCTP domain IDs and chain details.
- **Output JSON**:
```json
[
  { "domainId": 0, "chain": "ethereum", "name": "Ethereum" },
  { "domainId": 27, "chain": "stellar", "name": "Stellar" }
]
```
