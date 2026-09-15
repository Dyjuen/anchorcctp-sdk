import React from 'react';
import {
  Globe,
  Lock,
  RefreshCcw,
  Cpu,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Source Chain Burn',
      description:
        'Sender executes depositForBurn on source blockchain (EVM, SVM, Cosmos) targeting Stellar CCTP Domain ID 27.',
      badge: 'Step 1: Source Burn',
    },
    {
      step: '02',
      title: 'Iris Proof Attestation',
      description:
        'SDK polls Circle Iris API v1 to fetch cryptographically signed attestation proof upon source finality.',
      badge: 'Step 2: Iris Attestation',
    },
    {
      step: '03',
      title: 'Soroban Mint Execution',
      description:
        'Anchor SDK submits proof to Soroban Forwarder contract, minting native Stellar USDC with 6-to-7 Stroop decimal scaling.',
      badge: 'Step 3: Stellar Settlement',
    },
  ];

  const features = [
    {
      icon: <Globe className="w-5 h-5 text-[#3E6BFF]" />,
      title: '26+ Circle CCTP Domains',
      description:
        'Support for Ethereum, Arbitrum, Optimism, Solana, Polygon, Base, Avalanche, and 20+ Circle CCTP domains.',
    },
    {
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      title: 'Iris Proof Verification',
      description:
        'Circle Iris API v1 integration with exponential backoff and signature validation before minting.',
    },
    {
      icon: <RefreshCcw className="w-5 h-5 text-cyan-400" />,
      title: '6-to-7 Stroop Precision Scale',
      description:
        'Exact mathematical conversion from 6-decimal EVM/SVM units to 7-decimal Stellar Stroop units.',
    },
    {
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      title: 'Soroban Forwarder Contract',
      description:
        'Delegated minting engine with automated Trustline creation and 2 XLM reserve protection cap.',
    },
    {
      icon: <FileCheck className="w-5 h-5 text-amber-400" />,
      title: 'Idempotency & Replay Store',
      description:
        'Single-spend protection tracking processed burn hashes in an append-only store.',
    },
    {
      icon: <ShieldAlert className="w-5 h-5 text-[#3E6BFF]" />,
      title: 'SEP-CCTP Specification',
      description:
        'Open Stellar ecosystem standard extending stellar.toml with forwarder metadata and dust rules.',
    },
  ];

  return (
    <section id="process" className="py-16 relative border-t border-b border-slate-800/80 bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section 1: 3-Step Process Timeline */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#3E6BFF]/15 border border-[#3E6BFF]/30 text-[#3E6BFF] shadow-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#3E6BFF]" />
              Simple 3-Step Workflow
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
              How Cross-Chain Ingestion Works
            </h2>
            <p className="text-slate-300 max-w-xl mx-auto text-sm font-medium">
              From source chain burn to final Soroban USDC minting in three automated steps.
            </p>
          </div>

          {/* 3 Step Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {steps.map((item, idx) => (
              <div
                key={idx}
                className="arch-card p-6 sm:p-8 rounded-2xl space-y-4 flex flex-col justify-between relative bg-slate-900/80 border border-slate-800"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-[#3E6BFF]">
                      {item.step}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-[#3E6BFF]/20 text-[#3E6BFF] border border-[#3E6BFF]/30">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>

                {idx < steps.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-[#3E6BFF] text-white items-center justify-center shadow-md">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Core Capabilities Grid */}
        <div className="space-y-8 pt-8 border-t border-slate-800">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-white">
              Engineered Architecture Features
            </h3>
            <p className="text-slate-400 max-w-xl mx-auto text-xs font-medium">
              Comprehensive security guarantees and developer primitives for Stellar anchors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="arch-card-interactive p-6 rounded-2xl space-y-3 bg-slate-900/80 border border-slate-800"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  {feat.icon}
                </div>
                <h4 className="text-base font-extrabold text-white">
                  {feat.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
