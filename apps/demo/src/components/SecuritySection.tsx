import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Network, FileCode, CheckCircle2, Terminal, Code2, Cpu, GitBranch, Key } from 'lucide-react';

export const SecuritySection: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const items = [
    {
      id: "tracking",
      filename: "tracking.ts",
      title: "Pesanan Bisa Dilacak",
      description: "Pantau proses pencetakan token secara real-time dari hash transaksi burn hingga konfirmasi ledger Stellar.",
      icon: <Terminal className="w-5 h-5 text-emerald-400" />,
      highlight: (
        <div className="font-mono text-sm space-y-2">
          <div className="flex items-center gap-3 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> [OK] Burn Hash Verified on Source Chain</div>
          <div className="flex items-center gap-3 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> [OK] Circle Iris Signature Confirmed</div>
          <div className="flex items-center gap-3 text-[#3E6BFF]"><span className="animate-pulse">_</span> Awaiting Stellar Ledger settlement...</div>
        </div>
      )
    },
    {
      id: "domains",
      filename: "domains.config.json",
      title: "Cek Domain CCTP",
      description: "Daftar 26+ domain Circle terverifikasi secara on-chain.",
      icon: <Network className="w-5 h-5 text-amber-400" />,
      highlight: (
        <pre className="font-mono text-sm text-amber-300/80">
{`{
  "active_domains": 26,
  "supported": [
    "Ethereum (0)",
    "Avalanche (1)",
    "Optimism (2)",
    "Arbitrum (3)",
    "Solana (5)",
    "Base (6)",
    "Polygon (7)",
    "Stellar (27)"
  ],
  "status": "ALL_SYSTEMS_OPERATIONAL"
}`}
        </pre>
      )
    },
    {
      id: "soroban",
      filename: "forwarder.rs",
      title: "Soroban Mint",
      description: "Pencetakan terdelegasi tanpa henti di ekosistem Stellar.",
      icon: <FileCode className="w-5 h-5 text-[#3E6BFF]" />,
      highlight: (
        <pre className="font-mono text-sm text-[#3E6BFF]/80">
{`#[contractimpl]
impl Forwarder {
    pub fn receive(
        env: Env,
        caller: Address,
        amount: i128,
        attestation: Bytes,
    ) {
        // High-precision decimal conversion
        let stroops = amount * 10;
        // Minting execution...
    }
}`}
        </pre>
      )
    },
    {
      id: "replay",
      filename: "idempotency.ts",
      title: "Proteksi Replay",
      description: "Klaim ganda otomatis ditolak oleh idempotency store.",
      icon: <Lock className="w-5 h-5 text-rose-400" />,
      highlight: (
        <div className="font-mono text-sm text-rose-400 bg-rose-950/20 p-4 border-l-4 border-rose-500">
          <span className="font-bold">Error:</span> REPLAY_TRANSFER_DETECTED<br/>
          <span className="text-slate-400">Details: The burn transaction hash has already been processed by the Stellar forwarder. Minting aborted to prevent double spending.</span>
        </div>
      )
    },
    {
      id: "limits",
      filename: "trustline.toml",
      title: "Batas Reserve XLM",
      description: "Pembuatan trustline otomatis dibatasi aman ≤ 2 XLM.",
      icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
      highlight: (
        <pre className="font-mono text-sm text-purple-300">
{`[security]
auto_trustline_creation = true
max_sponsor_reserve_xlm = 2.0

# Prevents malicious draining of sponsor wallets
# by capping the maximum XLM reserve per account.`}
        </pre>
      )
    },
    {
      id: "support",
      filename: "SUPPORT.md",
      title: "Dukungan Penuh",
      description: "Dokumentasi & bantuan integrasi GitHub secara terbuka.",
      icon: <GitBranch className="w-5 h-5 text-slate-300" />,
      highlight: (
        <div className="font-sans text-base text-slate-300">
          <h1 className="text-2xl font-bold text-white mb-4"># AnchorCCTP Documentation</h1>
          <p className="mb-4">Everything you need to integrate Stellar CCTP safely into your anchor operations.</p>
          <a href="https://github.com/mothersgrace/anchorcctp-sdk" target="_blank" rel="noreferrer" className="inline-block bg-white text-black px-6 py-2 rounded-md font-bold hover:bg-[#3E6BFF] hover:text-white transition-colors">
            View on GitHub
          </a>
        </div>
      )
    }
  ];

  return (
    <section id="security" className="py-24 relative bg-[#03060c] w-full border-t border-slate-800/60">
      <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 space-y-16">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-4 text-center max-w-3xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
            Keamanan Tingkat Tinggi
          </h2>
          <p className="text-slate-400 text-lg font-medium leading-relaxed">
            Infrastruktur on-chain yang sepenuhnya transparan, tak terhentikan, dan diaudit oleh arsitektur Soroban.
          </p>
        </motion.div>

        {/* IDE Interface */}
        <div className="w-full h-auto md:h-[650px] bg-[#0d1117] border border-slate-700/60 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-[0_0_80px_rgba(0,0,0,0.8)] font-sans">
          
          {/* Sidebar */}
          <div className="w-full md:w-72 bg-[#161b22] border-b md:border-b-0 md:border-r border-slate-700/60 flex flex-col shrink-0">
            {/* Sidebar Header */}
            <div className="px-5 py-4 text-xs font-bold text-slate-500 tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              EXPLORER
            </div>
            
            {/* File List */}
            <div className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto md:overflow-x-hidden py-2 px-2 md:px-0 scrollbar-hide">
              {items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`shrink-0 w-auto md:w-full text-left px-4 md:px-5 py-2 md:py-2.5 text-sm flex items-center gap-2 md:gap-3 transition-colors ${
                    activeIndex === idx 
                    ? 'bg-[#3E6BFF]/10 text-white border-b-2 md:border-b-0 md:border-l-2 border-[#3E6BFF] rounded-t-md md:rounded-none' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 border-b-2 md:border-b-0 md:border-l-2 border-transparent rounded-t-md md:rounded-none'
                  }`}
                >
                  {item.icon}
                  <span className="font-mono truncate">{item.filename}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor Window */}
          <div className="flex-1 flex flex-col relative bg-[#0a0d12]">
            {/* Top Tabs */}
            <div className="flex bg-[#161b22] border-b border-slate-700/60 overflow-x-auto">
              <div className="px-6 py-3 border-t-2 border-[#3E6BFF] bg-[#0a0d12] text-white text-sm flex items-center gap-2 min-w-max">
                {items[activeIndex].icon}
                <span className="font-mono">{items[activeIndex].filename}</span>
              </div>
            </div>

            {/* Code Content Area */}
            <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  {/* Title & Desc as Comments */}
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-white tracking-tight">
                      <span className="text-slate-600 font-mono font-normal mr-2">{'//'}</span>
                      {items[activeIndex].title}
                    </h3>
                    <p className="text-lg text-slate-400 font-medium max-w-2xl">
                      <span className="text-slate-600 font-mono font-normal mr-2">{'/*'}</span>
                      {items[activeIndex].description}
                      <span className="text-slate-600 font-mono font-normal ml-2">{'*/'}</span>
                    </p>
                  </div>

                  {/* Rendered Code Block */}
                  <div className="w-full bg-[#010409] border border-slate-800 rounded-xl p-6 shadow-inner">
                     {items[activeIndex].highlight}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Terminal Footer */}
            <div className="h-8 bg-[#3E6BFF] text-white px-4 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 0 Errors</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Secured by Soroban</span>
              </div>
              <div>UTF-8</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


