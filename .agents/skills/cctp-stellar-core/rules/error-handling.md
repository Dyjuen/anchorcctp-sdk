# Typed Error Hierarchy & Handling

## Principles
1. **Never Throw Generic Errors**: Throw only typed, exported error subclasses that extend `AnchorCCTPError`.
2. **Actionable Remediation**: Every error instance must include:
   - `code`: Unique error string code (e.g. `ATTESTATION_TIMEOUT`).
   - `message`: Clear explanation of what failed.
   - `details`: Contextual metadata (e.g. transaction hash, domain ID, attempt count).
   - `remediation`: Next step for the developer or user to resolve the error.

## Error Class Hierarchy
```
AnchorCCTPError (Base)
├── AttestationError
│   ├── AttestationTimeoutError
│   ├── AttestationNotFoundError
│   └── AttestationVerificationError
├── MintError
│   ├── MintFailedError
│   └── ForwarderExecutionError
├── TrustlineError
│   ├── TrustlineMissingError
│   └── TrustlineCreationError
├── DomainError
│   └── InvalidDomainError
├── ValidationError
│   ├── InvalidAddressError
│   └── InvalidAmountError
└── ReplayError
    └── ReplayTransferError
```
