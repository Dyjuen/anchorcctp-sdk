#!/usr/bin/env bash
# Smoke: random testnet burn -> Stellar testnet receive.
# Prereqs: funded Sepolia/Base-Sepolia USDC (https://faucet.circle.com), Stellar testnet G... with USDC trustline.
# Usage: SOURCE_DOMAIN=6 BURN_TX=0x... DEST=G... ./scripts/testnet-receive-smoke.sh
set -euo pipefail
: "${SOURCE_DOMAIN:?set SOURCE_DOMAIN e.g. 6 for Base Sepolia}"
: "${BURN_TX:?set BURN_TX to source burn tx hash}"
: "${DEST:?set DEST to Stellar testnet G... recipient}"
node packages/cli/dist/index.js verify "$BURN_TX" --source-domain "$SOURCE_DOMAIN" --testnet
echo "[OK] attestation found; run receive() via SDK with attestationBaseUrl=https://iris-api-sandbox.circle.com network=testnet" >&2
