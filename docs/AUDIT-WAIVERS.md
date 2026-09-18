# npm audit waivers

## `toml` <=4.1.2 (high severity)

- **Affected:** `@stellar/stellar-sdk@13.3.0` → `toml` transitive dep
- **Finding:** Uncontrolled recursion + prototype pollution via `__proto__` key-path desynchronization
- **Fix available:** Upgrade `@stellar/stellar-sdk` to v17.1.0+ (breaking change)
- **Waiver reason:** C7 pins exact `13.3.0`. Upgrading to v17 requires API migration across
  all Stellar SDK call sites (Horizon, rpc, StrKey, TransactionBuilder, etc.). The `toml` dep
  is only used for parsing `stellar.toml` files — not in any runtime hot path and not
  user-controlled input in our codebase. No attacker can reach this code path.
- **Waived by:** AnchorCCTP team, 2026-09-18
- **Revisit:** When v17 migration is planned or when `toml` dep is removed from SDK
