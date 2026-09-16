import React, { useState } from 'react';
import { Copy, Check, FileText, Code2, Terminal } from 'lucide-react';

export const DevPlaygroundSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'toml' | 'code' | 'cli'>('code');
  const [copied, setCopied] = useState(false);

  const tomlContent = `# SEP-CCTP Anchor Configuration Specification
# Published at /.well-known/stellar.toml

[[CURRENCIES]]
code = "USDC"
issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
cctp_domain = 27
cctp_forwarder = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

[CCTP]
CCTP_DOMAIN = 27
FORWARDER_ADDRESS = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
SUPPORTED_SOURCE_DOMAINS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 16, 18, 19, 21, 22, 25, 28, 29, 30, 31, 32, 37]
DUST_HANDLING = "collector_sweep"
DUST_COLLECTOR_ACCOUNT = "GDDUSTCOLLECTOR00000000000000000000000000000000000000000000"
`;

  const codeContent = `import { createAnchorCCTP } from '@anchor-cctp/core-sdk';

// 1. Initialize SDK with anchor configuration & trustline parameters
const cctp = createAnchorCCTP({
  dustCollectorAddress: 'GDDUSTCOLLECTOR00000000000000000000000000000000000000000000',
  trustline: { allowCreation: true, spendCapXlm: 2 }
});

// 2. Subscribe to real-time deposit lifecycle events
cctp.on('onReceiving', (evt) => console.log('Attesting Iris Proof:', evt.burnTxHash));
cctp.on('onSettled', (evt) => console.log('Settled on Stellar:', evt.amount, evt.txHash));

// 3. Receive cross-chain USDC with single async function call
const result = await cctp.receive({
  sourceDomain: 0, // Ethereum
  burnTxHash: '0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
  destinationAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
});

console.log('Credited Stellar Amount:', result.amount, 'Dust:', result.dust);`;

  const cliContent = `# Install AnchorCCTP CLI Globally
npm install -g @anchor-cctp/cli

# 1. Initialize Anchor CCTP Configuration & stellar.toml
anchor-cctp init --domain 27 --usdc-issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --forwarder CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC --dust-collector GDDUSTCOLLECTOR00000000000000000000000000000000000000000000 --output ./stellar.toml

# 2. Inspect Supported Circle CCTP Domains
anchor-cctp domains

# 3. Stream inbound transfers for an address (simulated)
anchor-cctp listen GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --simulate

# 4. Check burn-to-mint attestation status
anchor-cctp verify 0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d --testnet
`;

  const getCurrentText = () => {
    if (activeTab === 'toml') return tomlContent;
    if (activeTab === 'code') return codeContent;
    return cliContent;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="playground" className="py-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#3E6BFF]/15 border border-[#3E6BFF]/30 text-[#3E6BFF] shadow-sm">
            <Code2 className="w-3.5 h-3.5 mr-1.5 text-[#3E6BFF]" />
            Developer Integration Suite
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
            Integration in Minutes
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm font-medium">
            TypeScript SDK, CLI terminal daemon, and SEP-CCTP metadata configuration.
          </p>
        </div>

        <div className="arch-card rounded-2xl overflow-hidden shadow-lg max-w-5xl mx-auto bg-slate-900/90 border border-slate-800">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80 gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-[#3E6BFF] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>TypeScript SDK</span>
              </button>

              <button
                onClick={() => setActiveTab('toml')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'toml'
                    ? 'bg-[#3E6BFF] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>stellar.toml</span>
              </button>

              <button
                onClick={() => setActiveTab('cli')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'cli'
                    ? 'bg-[#3E6BFF] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>CLI Terminal</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-extrabold text-white transition-colors border border-slate-700 shadow-sm cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Copy {activeTab.toUpperCase()}
                </>
              )}
            </button>
          </div>

          {/* Code Window */}
          <div className="p-6 overflow-x-auto bg-[#070C18]">
            <pre className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed">
              {getCurrentText()}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
