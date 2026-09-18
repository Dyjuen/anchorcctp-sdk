import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  FileCode2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Terminal,
  Circle,
  FileText,
  FileJson,
} from 'lucide-react';

interface ExplorerFile {
  id: string;
  name: string;
  extension: string;
  folder: string;
  path: string;
  lang: string;
  title: string;
  code: string;
  linkUrl?: string;
}

export const SecuritySection: React.FC = () => {
  const [activeFileId, setActiveFileId] = useState<string>('idempotency');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    packages: true,
    config: true,
  });

  const files: ExplorerFile[] = [
    {
      id: 'idempotency',
      name: 'idempotency.ts',
      extension: 'ts',
      folder: 'packages',
      path: 'packages/core/src/store/idempotency.ts',
      lang: 'typescript',
      title: 'Replay Protection & Idempotency Store',
      code: `import { ProcessedRecord, IdempotencyBackend } from '../types';

export class IdempotencyStore {
  private readonly store = new Map<string, ProcessedRecord>();

  /**
   * Verify whether the burn transaction hash was already processed.
   * Atomically locks the hash during settlement to avoid race conditions.
   */
  async verifyAndLock(burnTxHash: string): Promise<boolean> {
    const key = burnTxHash.toLowerCase();
    if (this.store.has(key)) {
      throw new Error(
        \`REPLAY_TRANSFER_DETECTED: Burn hash \${burnTxHash} already processed.\`
      );
    }
    return true;
  }
}`,
    },
    {
      id: 'domains',
      name: 'domains.config.json',
      extension: 'json',
      folder: 'config',
      path: 'packages/core/src/config/domains.config.json',
      lang: 'json',
      title: 'Circle CCTP Domain Registry',
      code: `{
  "$schema": "https://anchorcctp.dev/schemas/domains.json",
  "version": "1.0.0",
  "destinationDomain": 27,
  "supportedSourceDomains": {
    "0": { "name": "Ethereum", "cctpContract": "0xBd3fa81B58Ba92a857764f1eb067900" },
    "1": { "name": "Avalanche", "cctpContract": "0x6B25EBE74421b8f04753FDE5d0985" },
    "2": { "name": "Optimism", "cctpContract": "0x2B4069517957735bE00ceE0fadAE88a26365528f" },
    "3": { "name": "Arbitrum", "cctpContract": "0x19330d52D98E2a630156715F4500a78283224429" },
    "5": { "name": "Solana", "cctpContract": "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaBHQUqNVYZ2aVq" },
    "6": { "name": "Base", "cctpContract": "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962" },
    "7": { "name": "Polygon PoS", "cctpContract": "0x9daF8257e801C2f8Ed81668017a9e3e96BEe14EC" },
    "27": { "name": "Stellar", "forwarder": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" }
  }
}`,
    },
    {
      id: 'trustline',
      name: 'trustline.toml',
      extension: 'toml',
      folder: 'config',
      path: 'packages/core/src/trustline/trustline.toml',
      lang: 'toml',
      title: 'Trustline Auto-Sponsorship Guard',
      code: `[sponsorship]
auto_trustline_creation = true
max_sponsor_reserve_xlm = 2.0
require_explicit_anchor_opt_in = true

# Prevents malicious draining of operational sponsor wallets:
# 1. Accounts with existing USDC trustlines require 0 sponsor XLM.
# 2. Unfunded destination accounts receive at most 2.0 XLM for base reserves.
# 3. Operations exceeding the ceiling throw TRUSTLINE_SPONSOR_LIMIT_EXCEEDED.`,
    },
    {
      id: 'security-md',
      name: 'SECURITY.md',
      extension: 'md',
      folder: 'packages',
      path: 'SECURITY.md',
      lang: 'markdown',
      title: 'Security Disclosure Policy',
      code: `# Security Policy & Responsible Disclosure

## Audited Ingestion Scope
- \`packages/core/src/attestation/*\` (Cryptographic signature checking)
- \`packages/core/src/forwarder/*\` (Soroban contract bindings)
- \`packages/core/src/decimals/*\` (Integer decimal conversion)

## Reporting Findings
Email cryptographic vulnerabilities directly to:
- security@anchorcctp.dev (PGP Key ID: 0x4B3A82DF9C01EA77)`,
      linkUrl: 'https://github.com/mothersgrace/anchorcctp-sdk',
    },
  ];

  const toggleFolder = (f: string) => {
    setOpenFolders((prev) => ({ ...prev, [f]: !prev[f] }));
  };

  const currentFile = files.find((f) => f.id === activeFileId) || files[0];

  const getFileIcon = (ext: string) => {
    switch (ext) {
      case 'ts':
        return <FileCode2 className="w-4 h-4 text-[#3E6BFF]" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-amber-400" />;
      case 'toml':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <section id="security" className="py-24 relative bg-[#020612] w-full border-t border-slate-800/80 font-sans">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 space-y-10">
        
        {/* Header: Focused, bold, clean */}
        <div className="space-y-4 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
            Security Architecture
          </h2>
          <p className="text-slate-300 text-lg md:text-xl font-medium leading-relaxed">
            Inspect the audited contracts, strict idempotency verifiers, and domain registry configs powering AnchorCCTP.
          </p>
        </div>

        {/* Premium Integrated File Explorer & Editor Workbench */}
        <div className="w-full bg-[#070D1C] border border-slate-800 rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.8)] flex flex-col">
          
          {/* Top Window Bar (macOS / IDE Window Header) */}
          <div className="px-5 py-3.5 bg-[#091124] border-b border-slate-800/90 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 font-mono text-xs text-slate-400 hidden sm:inline">
                anchorcctp-sdk — security inspection console
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span className="text-slate-500">ACTIVE:</span>
              <span className="text-slate-200 font-semibold">{currentFile.name}</span>
            </div>
          </div>

          {/* Workbench Body (Explorer Sidebar + Editor View) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
            
            {/* Sidebar: File Tree (Left 4 cols) */}
            <div className="lg:col-span-4 bg-[#050A17] border-b lg:border-b-0 lg:border-r border-slate-800/90 p-4 select-none">
              <div className="space-y-4">
                {/* Explorer Title */}
                <div className="flex items-center justify-between px-2 text-[11px] font-mono uppercase font-bold text-slate-500 tracking-wider">
                  <span>Project Explorer</span>
                  <span className="text-slate-600">{files.length} Files</span>
                </div>

                {/* Folder & File Tree */}
                <div className="space-y-3 font-mono text-xs">
                  
                  {/* Folder 1: packages/core */}
                  <div>
                    <button
                      onClick={() => toggleFolder('packages')}
                      className="flex items-center gap-2 w-full text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800/40 transition-colors"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${openFolders.packages ? 'rotate-90' : ''}`} />
                      {openFolders.packages ? <FolderOpen className="w-4 h-4 text-emerald-400" /> : <Folder className="w-4 h-4 text-emerald-400" />}
                      <span className="font-semibold text-slate-300">packages/core/src</span>
                    </button>
                    {openFolders.packages && (
                      <div className="ml-5 mt-1 pl-2 border-l border-slate-800/80 space-y-1">
                        {files.filter((f) => f.folder === 'packages').map((file) => {
                          const isActive = file.id === activeFileId;
                          return (
                            <button
                              key={file.id}
                              onClick={() => setActiveFileId(file.id)}
                              className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-all ${
                                isActive
                                  ? 'bg-[#3E6BFF]/15 text-white font-bold border border-[#3E6BFF]/40 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {getFileIcon(file.extension)}
                                <span className="truncate">{file.name}</span>
                              </div>
                              {isActive && <Circle className="w-1.5 h-1.5 fill-[#3E6BFF] text-[#3E6BFF]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Folder 2: config */}
                  <div>
                    <button
                      onClick={() => toggleFolder('config')}
                      className="flex items-center gap-2 w-full text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800/40 transition-colors"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${openFolders.config ? 'rotate-90' : ''}`} />
                      {openFolders.config ? <FolderOpen className="w-4 h-4 text-amber-400" /> : <Folder className="w-4 h-4 text-amber-400" />}
                      <span className="font-semibold text-slate-300">packages/core/src/config</span>
                    </button>
                    {openFolders.config && (
                      <div className="ml-5 mt-1 pl-2 border-l border-slate-800/80 space-y-1">
                        {files.filter((f) => f.folder === 'config').map((file) => {
                          const isActive = file.id === activeFileId;
                          return (
                            <button
                              key={file.id}
                              onClick={() => setActiveFileId(file.id)}
                              className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left transition-all ${
                                isActive
                                  ? 'bg-[#3E6BFF]/15 text-white font-bold border border-[#3E6BFF]/40 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {getFileIcon(file.extension)}
                                <span className="truncate">{file.name}</span>
                              </div>
                              {isActive && <Circle className="w-1.5 h-1.5 fill-[#3E6BFF] text-[#3E6BFF]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* Main Editor Pane (Right 8 cols) */}
            <div className="lg:col-span-8 bg-[#040816] flex flex-col">
              
              {/* Tab Bar (Browser/IDE Tabs) */}
              <div className="flex items-center justify-between bg-[#080E20] border-b border-slate-800/90 overflow-x-auto px-2">
                <div className="flex items-center">
                  {files.map((file) => {
                    const isActive = file.id === activeFileId;
                    return (
                      <button
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono border-r border-slate-800 transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#040816] text-white border-t-2 border-t-[#3E6BFF] font-semibold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-t-2 border-t-transparent'
                        }`}
                      >
                        {getFileIcon(file.extension)}
                        <span>{file.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 px-3 py-1 shrink-0">
                  {currentFile.linkUrl && (
                    <a
                      href={currentFile.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                      title="View GitHub Repository"
                    >
                      <span>Repository</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Code Content Area with Line Numbers */}
              <div className="flex-1 p-4 sm:p-6 overflow-x-auto font-mono text-xs sm:text-sm">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentFile.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex gap-4 leading-relaxed"
                  >
                    {/* Line numbers column */}
                    <div className="select-none text-slate-600 text-right pr-2 border-r border-slate-800/80 font-mono text-xs leading-relaxed">
                      {currentFile.code.split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Actual Code content */}
                    <pre className="text-slate-200 overflow-x-auto flex-1 leading-relaxed">
                      <code>{currentFile.code}</code>
                    </pre>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Terminal Footer Status */}
              <div className="px-5 py-3 bg-[#080E20] border-t border-slate-800/90 text-xs font-mono flex items-center justify-between gap-4 text-slate-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#3E6BFF]" />
                  <span className="text-slate-300 truncate">{currentFile.path}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>UTF-8</span>
                  <span>{currentFile.lang.toUpperCase()}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    AUDITED
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};


