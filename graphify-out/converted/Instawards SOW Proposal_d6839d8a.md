<!-- converted from Instawards SOW Proposal.docx -->


1. Project & Team Information



2. Instawards Overview & Intent

2.1 Instawards Purpose (for Builder Context)
Instawards are designed to support short, clearly scoped, execution-focused work that helps a project make tangible progress toward building on Stellar. Instawards are meant to fund specific, achievable outcomes that can be completed and demonstrated within 30 days or less.

This SOW represents a shared commitment between the Builder and the Ambassador Chapter Lead on what will be delivered, why it matters, and how success will be verified.

3. Problem Statement & Objective




4. Scope of Work (30-Day Deliverables)

Important guidance: This scope must be achievable within 30 calendar days. If the work feels larger, it should be reduced or split into more achievable phases.


4.1 In-Scope Deliverables


4.2 Deliverable-Aligned Budget Request



5. 30-Day Execution Plan & Timeline

5.1 Weekly Breakdown

6. Evidence of Completion (Required)

Important guidance: Evidence should be clear, verifiable, and easy to review by the Ambassador Chapter Lead with minimal technical expertise.

6.1 Planned Evidence to Be Submitted

6.2 Evidence Verification Checklist (For Ambassador Use)

For each deliverable, the Ambassador Chapter Lead will assess whether evidence is present and sufficient.

7. Next-Step Alignment

7.1 Anticipated Next Step After Completion

After this Instaward, the most likely next step is:
Apply to SCF Build Award
Continue development independently
Apply for a follow-on Instaward (if eligible)
Seek other ecosystem support
Other:
8. Instawards Constraints Acknowledgement

By submitting this SOW, the Builder acknowledges:
☐ This scope will be completed within 30 days or less.
☐ Instawards support execution, not open-ended exploration.
☐ A project may receive no more than two follow-on Instawards.
☐ Each Instaward is capped at $5,000.
☐ Total Instawards funding may not exceed $15,000.

9. Submission Confirmation
Once finalized, this Statement of Work will be submitted by the Ambassador Chapter Lead via the Instawards Airtable submission form for review and approval.

| Project Name: | AnchorCCTP SDK |
| --- | --- |
| Builder / Team Name: | Mother’s Grace |
| Primary Contact (Name + Email): | Juen(denardyjuen@gmail.com) |
| Ambassador Chapter: | Indonesia |
| Ambassador Chapter Lead: | Kenny Rivaldi |
| Date Submitted: | 29-07-2026 |
| Suggested Sprint Start Date: | 17-08-2026 |
| Problem Being Addressed | What specific problem, gap, or blocker is this Instaward intended to solve? | Stellar anchors today have no standardized way to accept USDC deposits from non-Stellar chains. Circle's CCTP went live on Stellar in May 2026, connecting Stellar to 23+ chains via native burn-and-mint USDC transfers  but every anchor must independently navigate a maze of integration friction: Stellar's 7-decimal USDC vs CCTP's 6-decimal format (with remainder dust), G... address format vs EVM 32-byte addresses requiring the CCTP forwarder contract, Circle Attestation API polling for mint proofs, domain ID mapping (Stellar = 27), and trustline management for inbound USDC. No existing SDK abstracts this. The result is that 37 live anchors on Stellar  across Africa, LATAM, Philippines, and Europe  cannot accept USDC from Ethereum, Solana, Base, Arbitrum, or 19 other chains without weeks of custom engineering per anchor. This is a structural gap in the Stellar anchor toolchain. Existing tools such as the Anchor Platform (SDF) handle SEP-6/24 fiat deposits but have zero CCTP awareness. Circle's own CCTP SDK covers each chain in isolation with no Stellar-specific abstraction. Crossmesh provides a generic CCTP UI for end-users but no integration library for anchors. The absence of an anchor-specific CCTP integration kit is blocking an entire class of cross-chain payment products from being built. |
| --- | --- | --- |
| Objective of This Instaward | In one or two sentences, what will be true at the end of 30 days if this Instaward is successful? | Within 30 days, this project will deliver a production-ready, open-source TypeScript SDK and CLI (published on npm) that lets any Stellar anchor accept USDC from any CCTP-connected chain with a single function call  abstracting decimal conversion, forwarder contracts, attestation polling, and trustline management  with a stellar.toml spec extension and a demo integration against a live testnet anchor. |
| Example prompts for builders: What is currently preventing progress? What is unclear, missing, or unbuilt today? Why is this problem worth solving now? | Example prompts for builders: What is currently preventing progress? What is unclear, missing, or unbuilt today? Why is this problem worth solving now? | Example prompts for builders: What is currently preventing progress? What is unclear, missing, or unbuilt today? Why is this problem worth solving now? |
| Deliverable | Description (What will be built or produced?) | Why this matters |
| --- | --- | --- |
| Deliverable 1 | Core SDK (@anchor-cctp/core)
TypeScript npm package with a single public API: AnchorCCTP.receive(params). Handles:
• Attestation Polling: CCTP transfer receipt detection via Circle Attestation API polling with configurable retry/backoff.
• Decimal Conversion: Stellar 7-decimal ↔ CCTP 6-decimal conversion with remainder dust handling (credited to a configurable dust-collector address).
• Address Translation: CCTP forwarder contract interaction for Stellar G... address translation.
• Trustline Management: Automatic USDC trustline detection and creation via Stellar SDK if missing.
• Domain Mapping: Domain ID mapping table for all 23+ CCTP chains.
• Event Emission: Typed callbacks (onReceiving, onSettled, onDustCollected).
Ships with full TypeScript declarations, 90%+ unit test coverage, and a comprehensive README with quickstart. | This is the core value. Every anchor currently rebuilds the same CCTP integration logic from scratch. A single receive() call replaces weeks of custom engineering. The dust-handling alone solves a known pain point Circle's own docs flag. |
| Deliverable 2 | CLI Tool (@anchor-cctp/cli)
Node.js CLI published on npm that wraps the core SDK as a command-line integration tool.
Commands:
• anchor-cctp init: Generates a stellar.toml CCTP config block.
• anchor-cctp listen <address>: Polls for inbound CCTP transfers to a Stellar address, logging events with chain source, amount, and settlement status.
• anchor-cctp verify <txHash>: Checks whether a CCTP burn transaction has been minted on Stellar and returns the attestation.
• anchor-cctp domains: Lists all supported CCTP domains with chain names and domain IDs.
All output is formatted in JSON for scriptability. | Lowers the barrier for anchors that don't use TypeScript or want to test CCTP flows without writing code. The init command alone gives anchors a drop-in stellar.toml config they'd otherwise write from scratch. |
| Out-of-Scope (Explicitly Not Included)
List anything that might be assumed but is not included in this Instaward scope. | Out-of-Scope (Explicitly Not Included)
List anything that might be assumed but is not included in this Instaward scope. | Out-of-Scope (Explicitly Not Included)
List anything that might be assumed but is not included in this Instaward scope. |
|  | This Instaward will not include a SEP-6/24 CCTP auto-deposit flow (triggering anchor off-ramp automatically on CCTP receipt that's Hook Relay, a separate project), an Anchor Platform plugin (that's a follow-on Phase 2 after the SEP is adopted), a CCTP-to-fiat withdrawal SDK (outbound is out of scope, the kit focuses on inbound receipts), a Soroban smart contract for CCTP routing, a production-grade observability dashboard (basic error monitoring is included; full APM/dashboarding is not), or multi-signature/institutional custody integration. The SDK operates at the integration layer only. It does not manage anchor KYC/AML, fiat settlement, or regulatory compliance. Support for CCTP Hooks (arbitrary metadata) is documented as a future extension point but not implemented. No native mobile app, no non-Freighter wallet integrations (Rabby, MetaMask Snap, etc.), and no on-chain CCTP event indexer will be included. Security auditing of the SDK itself and formal verification are also out of scope for this 30-day sprint. |  |
| Requested Budget Amount | Rationale for Budget Request |
| --- | --- |
| $4,500 (5hrs/day x 30 days x 
$30/hour) | The requested budget covers the builders’ time to complete the scoped deliverables within the 30 day period. |
| Week | Planned Work | Expected Output |
| --- | --- | --- |
| Week 1 | Configure monorepo workspace using npm workspaces, TypeScript, Jest, and ESLint. Conduct research and documentation on CCTP integration with Stellar, including domain ID 27, forwarder contract addresses for both testnet and mainnet environments, Circle Attestation API endpoints and polling behavior, Stellar USDC asset issuer details, and the mathematics behind 6 to 7 decimal conversion. Build the initial attestation polling module with support for configurable retry logic and backoff strategies. Start drafting the stellar.toml specification document. | Monorepo is structured and capable of publishing to npm (via dry-run verification). Technical specification document is completed, detailing all CCTP-Stellar integration requirements. Attestation polling module is functional and tested against Circle's testnet environment. First complete draft of SEP-CCTP.md specification is ready |
| Week 2 | Develop the core AnchorCCTP.receive() flow, encompassing attestation verification, forwarder contract interaction, decimal conversion handling, trustline validation, and USDC credit application. Write comprehensive unit tests covering each stage of the flow. Implement CLI commands for listen and verify operations. Begin setting up a demo anchor on Stellar testnet, including account creation, stellar.toml hosting, and trustline configuration. Start building the React and Vite-based demo user interface scaffold. | Core SDK successfully processes the full attestation-to-mint-to-credit workflow on testnet. CLI listen command displays inbound CCTP transfers as they arrive. Demo anchor account is operational on testnet with stellar.toml published and accessible. Demo UI scaffold is built with wallet connection functionality. |
| Week 3 | Implement dust remainder handling with configurable dust-collector address configuration. Add event emitters for onReceiving, onSettled, and onDustCollected lifecycle events. Expand unit test coverage to achieve 90% or higher line coverage. Implement CLI init and domains commands. Build full Freighter wallet integration into the demo UI, including connection flow, trustline approval prompts, transaction signing, and balance refresh functionality. Implement error state handling and simulation (rejected signing requests, insufficient XLM, network mismatches). Finalize the SEP-CCTP.md specification. | SDK reaches feature completeness. CLI reaches feature completeness with all planned commands functional. Demo UI is fully operational with Freighter integration, showcasing the complete lifecycle from wallet connection through CCTP transfer to settlement and credit. All error states are properly handled and displayed. SEP-CCTP.md is finalized and ready for submission. |
| Week 4 | Deploy the demo anchor to mainnet, including account funding, stellar.toml configuration, trustline setup, and a live CCTP test using real USDC. Publish both @anchor-cctp/core and @anchor-cctp/cli packages to npm. Submit SEP-CCTP.md as a draft pull request to the stellar/stellar-protocol repository. Execute a complete end-to-end test using Circle's CCTP mainnet infrastructure and Stellar mainnet through the deployed demo UI. Write comprehensive README documentation, full API documentation, and a migration guide. Record a demonstration video (3 to 5 minutes) showing the complete Freighter and CCTP workflow on mainnet. | Both npm packages are published and publicly available. Demo anchor is live on mainnet at a production URL. SEP-CCTP pull request is submitted and visible in the protocol repository. Test coverage meets or exceeds 90%. Demonstration video is published and shows real mainnet CCTP transfers through the Freighter interface. Complete documentation portal is accessible and ready for users. The entire system is integrated, deployed to production, and ready for review. |
| Deliverable | Evidence Type 
(link, repo, demo, screenshot, doc, tx hash, etc.) | Description |
| --- | --- | --- |
| Deliverable 1 | GitHub Repository, npm Package Links, Test Coverage Reports | Public GitHub repository containing complete TypeScript source code for @anchor-cctp/core. Active package listing on npmjs.com. Terminal output from test execution showing ‘npx jest --coverage’ results with 90% or higher line coverage. Execution logs demonstrating successful AnchorCCTP.receive() operation: detecting an inbound CCTP transfer from Sepolia testnet, correctly handling 6 to 7 decimal conversion, creating a trustline, and crediting USDC to the Stellar testnet account. |
| Deliverable 2 | npm CLI Package, Terminal Screenshots, JSON Output Examples | Published @anchor-cctp/cli package available on npmjs.com. Screenshots showing output from an ‘init’ command displaying the generated stellar.toml configuration block for CCTP support. Screenshots of ‘anchor-cctp listen GC…’ command showing real-time JSON event streaming for inbound CCTP transfers, including chain source, transfer amount, and processing status. Screenshots demonstrating ‘anchor-cctp domains’ command output with the complete domain mapping table. |
| Deliverable 3 | Live Mainnet URL, UI Screenshots, SEP-CCTP PR Link, Demo Video | Live mainnet deployment of the demo anchor (accessible at anchorcctp.io or similar) with a functional stellar.toml file that advertises CCTP deposit support. Screenshots of the Freighter-integrated web interface showing: wallet connection flow, trustline approval prompts, complete CCTP transfer lifecycle (source chain burn, attestation retrieval, Stellar mint transaction, SDK processing, dust collection, and final USDC credit to user's wallet balance), and error handling for scenarios such as rejected signing requests, insufficient XLM balance, or network configuration mismatches. Public pull request link to the SEP-CCTP.md specification on github.com/stellar/stellar-protocol. Public video link (3 to 5 minutes in length) demonstrating the full mainnet workflow end-to-end, using Freighter for all interactions. |
| Deliverable | Evidence Present | Evidence 
Partial | Evidence Missing | Comments |
| --- | --- | --- | --- | --- |
| Deliverable 1 | ☐ | ☐ | ☐ |  |
| Deliverable 2 | ☐ | ☐ | ☐ |  |
| Deliverable 3 | ☐ | ☐ | ☐ |  |