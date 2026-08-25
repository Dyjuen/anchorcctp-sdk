import React, { useState } from 'react';
import { Copy, Check, FileText, Download } from 'lucide-react';

export const TomlInspector: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const tomlContent = `# SEP-CCTP Anchor Configuration
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

  const handleCopy = () => {
    navigator.clipboard.writeText(tomlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          Anchor stellar.toml Specification
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto text-base">
          Stellar ecosystem configuration advertising CCTP deposit support, supported source domain IDs, and Soroban forwarder addresses.
        </p>
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-red-400" />
            <span className="font-mono text-sm text-gray-300">/.well-known/stellar.toml</span>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy TOML
              </>
            )}
          </button>
        </div>

        <pre className="font-mono text-xs text-gray-300 overflow-x-auto p-2 leading-relaxed">
          {tomlContent}
        </pre>
      </div>
    </div>
  );
};
