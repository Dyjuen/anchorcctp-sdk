import React, { useState, useEffect, useRef } from 'react';
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
  Wifi,
  WifiOff,
} from 'lucide-react';
import { WalletState, fetchBalances } from '../wallet/freighter';
import { loadNetworkConfig } from '../config/network';
import {
  DepositState,
  initialDeposit,
  reduceDeposit,
  parseUsdcBase6,
  buildEventsUrl,
  assertAddressUnchanged,
} from '../catalog/depositMachine';

interface CatalogSectionProps {
  wallet: WalletState;
  onConnectWallet: () => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  wallet,
  onConnectWallet,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<number>(0);
  const [burnTxHash, setBurnTxHash] = useState<string>(
    '0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d'
  );
  const [usdcAmount, setUsdcAmount] = useState<string>('100.00');
  const [simError, setSimError] = useState<string>('none');

  // Deposit state machine
  const [deposit, setDeposit] = useState<DepositState>(initialDeposit);

  // Balance + network state
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [networkLabel, setNetworkLabel] = useState<string>('');

  const esRef = useRef<EventSource | null>(null);
  const connectedAddressRef = useRef<string | null>(null);

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
      default: return 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035';
    }
  };

  const refreshBalances = async () => {
    if (!wallet.address) return;
    try {
      const balances = await fetchBalances(wallet.address);
      let xlm: string | null = null;
      let usdc: string | null = null;
      for (const b of balances) {
        if (b.asset_type === 'native') {
          xlm = b.balance;
        } else if (
          b.asset_type === 'credit_alphanum12' &&
          'asset_code' in b &&
          (b as { asset_code?: string }).asset_code === 'USDC'
        ) {
          usdc = b.balance;
        }
      }
      setXlmBalance(xlm);
      setUsdcBalance(usdc);
    } catch {
      setXlmBalance(null);
      setUsdcBalance(null);
    }
  };

  const checkNetwork = () => {
    try {
      const config = loadNetworkConfig();
      setNetworkOk(true);
      setNetworkLabel(config.network.toUpperCase());
    } catch {
      setNetworkOk(false);
      setNetworkLabel('Config error');
    }
  };

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      refreshBalances();
      checkNetwork();
    } else {
      setXlmBalance(null);
      setUsdcBalance(null);
      setNetworkOk(null);
      setNetworkLabel('');
    }
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [wallet.connected, wallet.address]);

  const handleExecuteDeposit = async () => {
    if (!wallet.connected || !wallet.address) {
      onConnectWallet();
      return;
    }

    // Close any existing EventSource
    esRef.current?.close();

    const startTime = Date.now();
    setDeposit({ ...initialDeposit, step: 'verifying' });
    connectedAddressRef.current = wallet.address;

    try {
      const rawUnits = parseUsdcBase6(usdcAmount);

      const config = loadNetworkConfig();

      // Re-fetch address from wallet and assert no drift
      const { getAddress } = await import('@stellar/freighter-api');
      const liveAddress = await getAddress();
      if (liveAddress) {
        assertAddressUnchanged(wallet.address, liveAddress);
      }

      const url = buildEventsUrl({
        address: wallet.address,
        burnTxHash,
        sourceDomain: activeDomain.domainId,
      });

      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'receiving') {
            setDeposit((s) => reduceDeposit(s, { type: 'receiving', attempt: data.attempt ?? 1 }));
          } else if (data.type === 'submitting') {
            setDeposit((s) => reduceDeposit(s, { type: 'submitting' }));
          } else if (data.type === 'settled') {
            const { stellarAmount, dust } = convert6to7(rawUnits);
            setDeposit((s) =>
              reduceDeposit(s, {
                type: 'settled',
                stellarAmount: formatStellarUnits(stellarAmount),
                dust: dust.toString(),
                txHash: data.txHash ?? 'SIM-0001',
                simulated: data.simulated ?? (data.txHash ?? '').startsWith('SIM-'),
              })
            );
            es.close();
            esRef.current = null;
          } else if (data.type === 'error') {
            setDeposit((s) => reduceDeposit(s, { type: 'error', message: data.message ?? 'Unknown error' }));
            es.close();
            esRef.current = null;
          }
        } catch {
          // Ignore malformed SSE events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setDeposit((s) => reduceDeposit(s, { type: 'error', message: 'SSE connection lost' }));
      };
    } catch (err) {
      setDeposit({
        ...initialDeposit,
        step: 'error',
        errorDetails: err instanceof Error ? err.message : 'Unknown error',
      });
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
          {/* Left Column: Domain Slots Grid */}
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
                    disabled={deposit.step !== 'idle' && deposit.step !== 'error'}
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
                    disabled={deposit.step !== 'idle' && deposit.step !== 'error'}
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

              {/* Balance + Network Badge */}
              {wallet.connected && wallet.address && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-4 text-xs font-mono">
                      <span className="text-slate-400">
                        XLM <span className="text-white font-bold">{xlmBalance ?? '…'}</span>
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        USDC <span className="text-white font-bold">{usdcBalance ?? '…'}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {networkOk === true ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <Wifi className="w-3 h-3 mr-1" />
                        {networkLabel} ✓
                      </span>
                    ) : networkOk === false ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                        <WifiOff className="w-3 h-3 mr-1" />
                        {networkLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Error Simulation Select */}
              {wallet.connected && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Simulate Error
                  </label>
                  <select
                    value={simError}
                    onChange={(e) => setSimError(e.target.value)}
                    disabled={deposit.step !== 'idle' && deposit.step !== 'error'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="none" className="bg-slate-900 text-white">None</option>
                    <option value="rejected-signing" className="bg-slate-900 text-white">Freighter signing rejected</option>
                    <option value="insufficient-xlm" className="bg-slate-900 text-white">Insufficient XLM balance</option>
                    <option value="network-mismatch" className="bg-slate-900 text-white">Network mismatch (mainnet)</option>
                  </select>
                </div>
              )}

              {/* Review Line */}
              {wallet.connected && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="text-white font-bold">{usdcAmount} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="text-white font-bold truncate max-w-[200px]">{wallet.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Network:</span>
                    <span className="text-white font-bold">{networkLabel || '…'}</span>
                  </div>
                </div>
              )}

              {/* Action CTA Button */}
              <button
                onClick={wallet.connected ? handleExecuteDeposit : onConnectWallet}
                disabled={deposit.step !== 'idle' && deposit.step !== 'error'}
                className="w-full py-4 rounded-xl bg-[#3E6BFF] hover:bg-[#345CE0] text-white font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {deposit.step !== 'idle' && deposit.step !== 'error' ? (
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
            {deposit.step === 'settled' && deposit.receipt && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs font-mono">
                {deposit.receipt.simulated && deposit.receipt.txHash.startsWith('SIM-') && (
                  <div className="text-center text-amber-400 font-extrabold text-[11px] uppercase tracking-wider mb-2">
                    ⚠ SIMULATED — No real transaction submitted
                  </div>
                )}
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Minting Output:</span>
                  <span>{deposit.receipt.stellarAmount} USDC</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Dust Sweep:</span>
                  <span>{deposit.receipt.dust} base units</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Stellar Tx:</span>
                  <span className="truncate max-w-[140px] text-white">{deposit.receipt.txHash}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {deposit.step === 'error' && deposit.errorDetails && (
              <div className="mt-4 p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2">
                <div className="flex items-center text-rose-300 font-extrabold text-xs">
                  <AlertCircle className="w-4 h-4 mr-1.5 text-rose-400 shrink-0" />
                  {deposit.errorDetails}
                </div>
              </div>
            )}

            {/* Step Indicator */}
            {deposit.step !== 'idle' && deposit.step !== 'settled' && deposit.step !== 'error' && (
              <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono">
                <div className="flex items-center space-x-2 text-slate-400">
                  {deposit.step === 'verifying' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Verifying wallet address…</span>
                    </>
                  )}
                  {deposit.step === 'attesting' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Polling Iris attestation (attempt {deposit.attempts})…</span>
                    </>
                  )}
                  {deposit.step === 'submitting' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Submitting Soroban mint…</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
