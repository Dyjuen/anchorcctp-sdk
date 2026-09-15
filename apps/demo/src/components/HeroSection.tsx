import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Globe2, Sparkles, Terminal } from 'lucide-react';

interface HeroSectionProps {
  onExploreDemo: () => void;
  onExploreDocs: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreDemo,
  onExploreDocs,
}) => {
  return (
    <section className="relative pt-12 pb-12 overflow-hidden border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Bold Copy */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#3E6BFF]/15 border border-[#3E6BFF]/30 text-white shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#3E6BFF]" />
              <span className="text-xs font-bold tracking-wide uppercase text-[#3E6BFF]">
                Circle CCTP Engine for Stellar Anchors
              </span>
              <span className="bg-[#3E6BFF] text-white text-[10px] font-extrabold px-2 py-0.5 rounded">
                v1.0.0
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.08]">
              Universal USDC <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3E6BFF] via-[#60A5FA] to-[#06B6D4]">
                Cross-Chain Ingestion
              </span> <br />
              for Stellar.
            </h1>

            {/* Subhead */}
            <p className="text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed font-medium">
              Accept native 1:1 USDC deposits from <strong className="text-white">26+ Circle CCTP domains</strong> directly onto Stellar with single-step attestation, automated 6-to-7 decimal scaling, and Soroban minting.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button
                onClick={onExploreDemo}
                className="px-7 py-4 rounded-xl font-bold text-sm bg-[#3E6BFF] hover:bg-[#345CE0] text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Try Live Deposit Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onExploreDocs}
                className="px-7 py-4 rounded-xl font-bold text-sm bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
              >
                <Terminal className="w-4 h-4 text-slate-400" />
                <span>Developer SDK & Docs</span>
              </button>
            </div>
          </div>

          {/* Right Column: 3D Asset Display */}
          <div className="lg:col-span-5 flex justify-center items-center relative">
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
              {/* Decorative Glow Backdrop */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#3E6BFF]/20 to-purple-600/10 border border-slate-800 bg-grid-lines -rotate-2" />

              {/* High Resolution 3D Logo Graphic */}
              <img
                src="/assets/img/highppi.png"
                alt="AnchorCCTP 3D Emblem"
                className="relative z-10 w-4/5 h-4/5 object-contain filter drop-shadow-[0_20px_35px_rgba(62,107,255,0.3)] animate-float"
              />

              {/* Floating Badge */}
              <div className="absolute -bottom-2 -left-2 z-20 arch-card px-4 py-3 rounded-2xl flex items-center space-x-3 border border-slate-800 shadow-xl bg-slate-900/90 backdrop-blur-md">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-extrabold text-white">
                  Iris Attestation Polling Live
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Grid Bar */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="arch-card p-5 rounded-2xl space-y-1 bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-[#3E6BFF]">
              <Globe2 className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Connected Chains</span>
            </div>
            <div className="text-2xl font-black text-white">26+ Domains</div>
            <p className="text-xs text-slate-400 font-medium">EVM, SVM, Cosmos & Stellar</p>
          </div>

          <div className="arch-card p-5 rounded-2xl space-y-1 bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400">
              <Zap className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Decimal Scaling</span>
            </div>
            <div className="text-2xl font-black text-white">6 → 7 Stroop</div>
            <p className="text-xs text-slate-400 font-medium">Zero precision loss</p>
          </div>

          <div className="arch-card p-5 rounded-2xl space-y-1 bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Proof Security</span>
            </div>
            <div className="text-2xl font-black text-white">Circle Iris</div>
            <p className="text-xs text-slate-400 font-medium">100% Cryptographic proof</p>
          </div>

          <div className="arch-card p-5 rounded-2xl space-y-1 bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-purple-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Standard</span>
            </div>
            <div className="text-2xl font-black text-white">SEP-CCTP</div>
            <p className="text-xs text-slate-400 font-medium">Stellar TOML extension</p>
          </div>
        </div>
      </div>
    </section>
  );
};
