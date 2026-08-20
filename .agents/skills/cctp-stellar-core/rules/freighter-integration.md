# Freighter Wallet Integration & Demo UI

## Purpose
The demo web app (`apps/demo`) provides a real-world reference implementation for anchors and wallets, integrating Freighter for key management, trustline creation, and cross-chain CCTP deposit tracking.

## Integration Lifecycle
1. **Connection & State**:
   - Query Freighter availability: `isConnected()` from `@stellar/freighter-api`.
   - Request public key: `getPublicKey()`.
   - Request network: `getNetwork()` (Ensure match with Testnet / Mainnet).
2. **Trustline Flow**:
   - Check if the connected account has a trustline for USDC.
   - If missing, prompt user with explicit trustline setup dialog.
   - Request transaction signing via `signTransaction(xdr, { networkPassphrase })`.
3. **Inbound CCTP Transfer Monitoring**:
   - Display real-time progress stepper: `Burn Finalized` $\rightarrow$ `Attestation Polling` $\rightarrow$ `Soroban Minting` $\rightarrow$ `Credited`.
   - Update wallet balance upon receiving `onSettled` event.
4. **Error Simulation & Handling**:
   - Handle user rejection (`User declined signing request`).
   - Handle insufficient XLM reserves for transaction fees/trustlines.
   - Handle network mismatch (e.g. wallet on Testnet while app on Mainnet).
