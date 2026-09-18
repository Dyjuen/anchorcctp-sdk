import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CCTP_DOMAINS,
  convert6to7,
  formatStellarUnits,
} from '@anchor-cctp/core-sdk';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Coins,
  Shield,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { WalletState, signWithFreighter } from '../wallet/freighter';

interface CatalogSectionProps {
  wallet: WalletState;
  onConnectWallet: () => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  wallet,
  onConnectWallet,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<number>(0); // Ethereum default
  const [burnTxHash, setBurnTxHash] = useState<string>(
    '0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d'
  );
  const [usdcAmount, setUsdcAmount] = useState<string>('100.00');

  // Settlement flow state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [settlementResult, setSettlementResult] = useState<{
    mintTxHash: string;
    stellarAmount: string;
    dust: string;
  } | null>(null);

  const categories = [
    { id: 'all', label: 'All Domains' },
    { id: 'evm', label: 'EVM Chains' },
    { id: 'svm', label: 'Solana (SVM)' },
    { id: 'cosmos', label: 'Cosmos / Noble' },
  ];

  const domainsList = Object.values(CCTP_DOMAINS);
  const filteredDomains = domainsList.filter((d) => {
    if (selectedCategory === 'evm') return d.domainId !== 5 && d.domainId !== 27;
    if (selectedCategory === 'svm') return d.domainId === 5;
    if (selectedCategory === 'cosmos') return d.domainId === 21;
    return true;
  });

  const activeDomain = CCTP_DOMAINS[selectedDomainId] || CCTP_DOMAINS[0];

  const getDomainLogo = (domainId: number) => {
    switch (domainId) {
      case 0: return 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=035';
      case 1: return 'https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=035';
      case 2: return 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg?v=035';
      case 3: return 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=035';
      case 5: return 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=035';
      case 6: return 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg';
      case 7: return 'https://cryptologos.cc/logos/polygon-matic-logo.svg?v=035';
      default: return 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035'; // Default to USDC logo for unknown domains
    }
  };

  const handleExecuteDeposit = async () => {
    if (!wallet.connected || !wallet.address) {
      onConnectWallet();
      return;
    }

    setIsProcessing(true);
    setSettlementResult(null);
    setCurrentStep(1);

    try {
      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 900));
      setCurrentStep(3);

      const jsonPayload = JSON.stringify({
        action: 'cctp_mint',
        destination: wallet.address,
        burnTxHash,
      });
      await signWithFreighter(btoa(encodeURIComponent(jsonPayload)));
      await new Promise((r) => setTimeout(r, 700));

      setCurrentStep(4);
      const rawUnits = BigInt(Math.floor(parseFloat(usdcAmount) * 1_000_000));
      const { stellarAmount, dust } = convert6to7(rawUnits);

      const mintTx =
        '0x' +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

      setSettlementResult({
        mintTxHash: mintTx,
        stellarAmount: formatStellarUnits(stellarAmount),
        dust: dust.toString(),
      });
      setIsProcessing(false);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  return (
    <section id="catalog" className="py-16 relative bg-white dark:bg-[#070C18] border-t border-slate-200 dark:border-slate-800 w-full overflow-hidden">
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-10 lg:px-16 space-y-10">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-6 w-full"
        >
          <div className="space-y-2 text-left">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight sm:text-4xl">
              Select Source Domain
            </h2>
            <p className="text-slate-500 max-w-xl text-sm font-medium">
              Transfer 1:1 USDC from 26+ connected blockchains directly to your Stellar account.
            </p>
          </div>
        </motion.div>

        {/* Category Filters Pill Bar */}
        <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 w-full">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#3E6BFF] text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-400/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Main Catalog Grid Layout */}
        <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start w-full">
          {/* Left Column: Domain Slots Grid (Compact natural card heights) */}
          <motion.div layout className="col-span-7 grid grid-cols-2 gap-4 w-full">
            <AnimatePresence mode="popLayout">
            {filteredDomains.slice(0, 6).map((domain) => {
              const isSelected = selectedDomainId === domain.domainId;
              const isEvm = domain.networkType.toLowerCase().includes('evm');
              const isSvm = domain.domainId === 5;
              const isCosmos = domain.domainId === 21;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  key={domain.domainId}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedDomainId(domain.domainId)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all border group relative overflow-hidden ${
                    isSelected
                      ? 'bg-slate-900/95 border-blue-500 shadow-[0_10px_30px_-10px_rgba(62,107,255,0.35)] ring-2 ring-blue-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Active highlight bar indicator */}
                  {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2.5 shadow-sm group-hover:scale-105 transition-transform">
                      <img src={getDomainLogo(domain.domainId)} alt={domain.name} className="w-full h-full object-contain" />
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                        isSvm
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : isCosmos
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {domain.networkType}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-extrabold text-white transition-colors group-hover:text-blue-400">
                        {domain.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">ID: {domain.domainId}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      Circle CCTP v1 Standard Protocol
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">Deposit Ratio</span>
                    <span className="text-emerald-400 font-mono">1 USDC = 1 USDC</span>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </motion.div>

          {/* Right Column: Featured Interactive Deposit Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="col-span-5 p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl w-full backdrop-blur-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2.5 shadow-md">
                    <img src={getDomainLogo(activeDomain.domainId)} alt={activeDomain.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">{activeDomain.name}</h3>
                    <p className="text-xs text-blue-400 font-mono font-bold">Circle Domain ID: {activeDomain.domainId}</p>
                  </div>
                </div>
                <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#3E6BFF] text-white shadow-md">
                  Selected Domain
                </span>
              </div>

              {/* Input Form Parameters */}
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Deposit Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={usdcAmount}
                    onChange={(e) => setUsdcAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-extrabold text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Burn Transaction Hash (Source)
                  </label>
                  <input
                    type="text"
                    value={burnTxHash}
                    onChange={(e) => setBurnTxHash(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all truncate"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Stellar Destination Account
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      wallet.connected && wallet.address
                        ? wallet.address
                        : 'Connect Freighter Wallet...'
                    }
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Action CTA Button */}
              <button
                onClick={wallet.connected ? handleExecuteDeposit : onConnectWallet}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl bg-[#3E6BFF] hover:bg-[#345CE0] text-white font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing CCTP Ingestion...</span>
                  </>
                ) : wallet.connected ? (
                  <>
                    <span>Execute Deposit Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <span>Connect Freighter Wallet</span>
                )}
              </button>
            </div>

            {/* Settlement Receipt */}
            {settlementResult && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Minting Output:</span>
                  <span>{settlementResult.stellarAmount} USDC</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Stellar Tx:</span>
                  <span className="truncate max-w-[140px] text-white">{settlementResult.mintTxHash}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
