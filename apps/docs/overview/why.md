# Why AnchorCCTP exists

For contributors and anchor engineers: the specific gap this project fills.

Circle CCTP connects Stellar to other chains with burn and mint USDC. Before AnchorCCTP, each Stellar anchor wrote the same plumbing by hand, which took weeks. The work always broke into five tasks:

1. Decimals. Stellar USDC uses 7 places. CCTP chains use 6. You must multiply by 10 with integer math and account for the remainder.
2. Addresses. EVM chains use 20 or 32 byte hex. Stellar uses `G...` StrKey. You must route through the Soroban forwarder contract.
3. Attestation. Circle Iris signs a mint proof after the source burn finalizes. You must poll with backoff, then check the signature before you credit anything.
4. Domains. Each chain has an integer ID. Stellar is 27. You must accept only IDs from the published table.
5. Trustlines. A Stellar account needs a USDC trustline before funds can land. You must check first and create only with permission and a spending cap.

Anchor Platform does not handle CCTP. Circle SDK has no Stellar path. Bridge UIs serve end users, not anchor backends.

AnchorCCTP covers this one layer and stops there. Out of scope by design: outbound CCTP, SEP-6/24 triggers, a Soroban router contract, custody, and compliance logic. The full boundary is in PRD section 4.2.

Next: [How it works](./how-it-works) shows the eight steps every deposit follows.
