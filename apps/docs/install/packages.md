# Packages

For anchor engineers and ops staff: which npm package to install.

| Package | Install | Use it when you |
|---|---|---|
| `@anchor-cctp/core-sdk` | `npm install @anchor-cctp/core-sdk` | Settle deposits in a backend with `receive()` |
| `@anchor-cctp/cli` | `npm install -g @anchor-cctp/cli` | Run `init`, `listen`, `verify`, `domains` from a terminal |

Crypto and Stellar dependencies pin exact versions with no caret or tilde: `@stellar/stellar-sdk 13.3.0` and `viem 2.56.5`. The lockfile is committed and `npm audit` runs in CI. See [Audit status](../security/audit-status) for the one waived transitive finding.

Next: [From source](./from-source) for local development, or [Verify the install](./verify) for checks.
