# CLI Command Contracts & JSON Stdout Schemas

## Standard CLI Rules
1. **JSON Output Only on `stdout`**: Programs consuming `@anchor-cctp/cli` rely on pure parseable JSON.
2. **Diagnostics on `stderr`**: Progress spinners, error details, and user messages must be written to `stderr`.
3. **Exit Codes**: `0` on success, non-zero (`1` to `255`) on error.

## Commands

### 1. `anchor-cctp init`
Generates the `stellar.toml` CCTP configuration block.
```bash
anchor-cctp init --domain anchor.example.com --usdc-issuer GABC... --output ./stellar.toml
```
**JSON Schema**:
```json
{
  "success": true,
  "configBlock": "...",
  "writtenPath": "./stellar.toml"
}
```

### 2. `anchor-cctp listen <address>`
Streams incoming CCTP burn and mint events in real-time.
```bash
anchor-cctp listen GDMK...
```
**Output**: Newline-delimited JSON (NDJSON) stream.

### 3. `anchor-cctp verify <txHash>`
Verifies the cross-chain burn and attestation status.
```bash
anchor-cctp verify 0x9b4a...
```
**JSON Schema**:
```json
{
  "txHash": "0x9b4a...",
  "attested": true,
  "status": "complete",
  "sourceDomain": 0,
  "destinationDomain": 27,
  "mintTxHash": "3a7f..."
}
```

### 4. `anchor-cctp domains`
Prints the table of supported CCTP chains and domain IDs.
```bash
anchor-cctp domains
```
