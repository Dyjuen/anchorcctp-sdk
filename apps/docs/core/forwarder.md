# Forwarder and addresses

For anchor engineers: how EVM hex destinations become Stellar accounts.

CCTP messages carry the destination as 32 bytes. Stellar accounts use `G...` StrKey with checksum. The SDK translates through the Soroban forwarder path:

```ts
import { translateToStellar } from '@anchor-cctp/core-sdk';

const stellarAddr = translateToStellar('0x1234567890123456789012345678901234567890');
```

Rules:

* Use `translateToStellar` or `receive()`. Do not write your own 32 byte to `G...` derivation.
* The SDK checks StrKey checksums before it uses an address as a credit target.
* It rejects zero and empty addresses, so you cannot burn or mint to null.
* It logs the forwarder transaction hash for audit. It never logs keys or full signing payloads.

If translation throws `INVALID_ADDRESS`, check for a truncated hash, a missing `0x` prefix, or a Stellar address passed where EVM hex was expected.

Next: [Trustlines](./trustline).
