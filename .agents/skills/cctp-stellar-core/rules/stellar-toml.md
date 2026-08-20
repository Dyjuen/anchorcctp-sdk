# stellar.toml CCTP Extensions

## Overview
Stellar anchors publish a `stellar.toml` file at `https://<domain>/.well-known/stellar.toml`. The AnchorCCTP standard extends this file with structured CCTP configuration tables.

## Proposed `stellar.toml` Schema
```toml
# Standard Stellar Anchor configuration
VERSION = "2.0.0"

[DOCUMENTATION]
ORG_NAME = "AnchorCCTP Demo Anchor"
ORG_URL = "https://anchorcctp.io"

[[CURRENCIES]]
code = "USDC"
issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
status = "live"
is_asset_anchored = true
anchor_asset_type = "fiat"
anchor_asset = "USD"
desc = "USDC with native CCTP cross-chain support"

# Proposed CCTP Extension Block
[CCTP]
CCTP_DOMAIN = 27
FORWARDER_ADDRESS = "CA3D5KRYMCMCZVAC7SSXCWYAWY6UMTMVC6DW3EUKKU5GTHUMCDDMDA5C"
SUPPORTED_SOURCE_DOMAINS = [0, 1, 2, 3, 5, 6, 7]
DUST_HANDLING = "collector_sweep"
DUST_COLLECTOR_ACCOUNT = "GDX6G35TAGKWBXXE2AU3KT7WSB645UETU266WJRXS2NTGBLJ2FNRNTVG"
POLL_INTERVAL_MS = 3000
```
