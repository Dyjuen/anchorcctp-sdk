import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CCTP_DOMAINS } from '@anchor-cctp/core-sdk';
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
  FeeQuote,
  StatusFrame,
  TransferMode,
  initialDeposit,
  reduceDeposit,
  parseUsdcBase6,
  assertAddressUnchanged,
  simErrorEvent,
  extractLiveAddress,
  isPollingStep,
  nextPollDelay,
  quoteFeeOverMax,
} from '../catalog/depositMachine';

interface CatalogSectionProps {
  wallet: WalletState;
  onConnectWallet: () => void;
}

/** CCTP domain of the Stellar destination (spec §4: the demo always mints to 27). */
const STELLAR_CCTP_DOMAIN = 27;

/**
 * Client-side copy of the fast window. The server owns the real threshold (it
 * computes `degraded` against the intent's `createdAt`) — this only decides when the
 * client's own clock says the window has passed, so a frame that omits `degraded`
 * cannot stall the "continuing as Standard" label.
 */
const FAST_WINDOW_FALLBACK_MS = 90_000;

/** One in-flight transfer: everything the poller and the settle call need. */
interface TransferRun {
  address: string;
  burnTxHash: string;
  amount: string;
  sourceDomain: number;
  /** Mode recorded on the intent at initiate — settle must match it byte-for-byte. */
  mode: TransferMode;
  intentId: string;
  maxFee?: string;
  startedAt: number;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  wallet,
  onConnectWallet,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<number>(0);
  const [burnTxHash, setBurnTxHash] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('100.00');
  const [simError, setSimError] = useState<string>('none');
  /** User's fee cap in USDC — empty means "no cap". */
  const [maxFee, setMaxFee] = useState<string>('');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Deposit state machine
  const [deposit, setDeposit] = useState<DepositState>(initialDeposit);

  // Balance + network state
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [networkLabel, setNetworkLabel] = useState<string>('');

  /** The transfer the poller is driving. Kept through `cancelled` so retry can resume it. */
  const runRef = useRef<TransferRun | null>(null);
  /** False once the wait is over (cancel/settle/unmount) — stops the next poll from arming. */
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Drops quote responses a newer request superseded. */
  const quoteSeqRef = useRef(0);

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

  const network = React.useMemo(() => {
    try { return loadNetworkConfig().network; } catch { return 'testnet'; }
  }, []);

  const getDomainLogo = (domainId: number) => {
    switch (domainId) {
      case 0: return '/logos/ethereum.svg';
      case 1: return '/logos/avalanche.svg';
      case 2: return '/logos/optimism.svg';
      case 3: return '/logos/arbitrum.svg';
      case 5: return '/logos/solana.svg';
      case 6: return '/logos/base.svg';
      case 7: return '/logos/polygon.svg';
      default: return '/logos/usdc.svg';
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
      setNetworkLabel(config.passphrase);
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
  }, [wallet.connected, wallet.address]);

  // Spec §7: the poller stops on settled/cancelled/error — and on unmount.
  useEffect(() => {
    if (isPollingStep(deposit.step)) return;
    pollingRef.current = false;
    stopPolling();
  }, [deposit.step]);

  useEffect(
    () => () => {
      pollingRef.current = false;
      stopPolling();
      runRef.current = null;
    },
    [],
  );

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  /** Spec §7: 5s with jitter, 15s after 2 minutes — never a fixed `setInterval`,
   *  because the delay changes with jitter and backoff. */
  const scheduleNextPoll = () => {
    stopPolling();
    const run = runRef.current;
    if (!run || !pollingRef.current) return;
    pollTimerRef.current = setTimeout(() => {
      void pollOnce();
    }, nextPollDelay(Date.now() - run.startedAt, Math.random));
  };

  const finishRun = () => {
    pollingRef.current = false;
    stopPolling();
  };

  /**
   * One status read. Terminates the wait on settled/failed; settles when the
   * attestation is ready; otherwise re-arms with the jittered delay.
   */
  const pollOnce = async () => {
    const run = runRef.current;
    if (!run || !pollingRef.current) return;

    let frame: StatusFrame;
    try {
      const query = new URLSearchParams({
        burnTxHash: run.burnTxHash,
        address: run.address,
        amount: run.amount,
      });
      const res = await fetch(`/api/receive/status?${query.toString()}`);
      const body = (await res.json().catch(() => ({}))) as StatusFrame & {
        error?: { remediation?: string };
      };
      if (!res.ok) {
        finishRun();
        setDeposit((s) =>
          reduceDeposit(s, {
            type: 'error',
            message: body?.error?.remediation ?? `Status request failed (${res.status})`,
          }),
        );
        return;
      }
      frame = body;
    } catch {
      finishRun();
      setDeposit((s) => reduceDeposit(s, { type: 'error', message: 'Status request failed — connection lost.' }));
      return;
    }

    if (!pollingRef.current) return; // cancelled while the request was in flight
    setDeposit((s) => reduceDeposit(s, { type: 'status', frame }));

    if (frame.status === 'settled' || frame.status === 'failed') {
      finishRun();
      return;
    }
    // §7: the Iris signal is handled by the frame itself; this is the elapsed-window
    // fallback, so "continuing as Standard" appears even if a frame omits `degraded`.
    if (frame.degraded || Date.now() - run.startedAt > FAST_WINDOW_FALLBACK_MS) {
      setDeposit((s) => reduceDeposit(s, { type: 'fast-window-expired' }));
    }
    if (frame.status === 'ready' || frame.attestationReady) {
      await settleRun(run);
      return;
    }
    scheduleNextPoll();
  };

  /** POST /api/receive/settle — the only call that mints (spec §4). */
  const settleRun = async (run: TransferRun) => {
    setDeposit((s) => reduceDeposit(s, { type: 'settle-ready' }));
    try {
      const res = await fetch('/api/receive/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          burnTxHash: run.burnTxHash,
          address: run.address,
          amount: run.amount,
          sourceDomain: run.sourceDomain,
          transferMode: run.mode,
          intentId: run.intentId,
          ...(run.maxFee ? { maxFee: run.maxFee } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        receipt?: { stellarAmount?: string; mintTxHash?: string; dust?: string };
        error?: { code?: string; remediation?: string };
      };
      if (!res.ok) {
        finishRun();
        setDeposit((s) =>
          reduceDeposit(s, {
            type: 'error',
            message: body?.error?.remediation ?? `Settle failed (${res.status})`,
          }),
        );
        return;
      }
      finishRun();
      setDeposit((s) =>
        reduceDeposit(s, {
          type: 'settled',
          simulated: false,
          txHash: body.receipt?.mintTxHash ?? 'UNKNOWN',
          stellarAmount: String(body.receipt?.stellarAmount ?? ''),
          ...(body.receipt?.dust === undefined ? {} : { dust: body.receipt.dust }),
        }),
      );
    } catch {
      finishRun();
      setDeposit((s) =>
        reduceDeposit(s, {
          type: 'error',
          message: 'Settle request failed — check the burn on a Stellar explorer before retrying.',
        }),
      );
    }
  };

  /** POST /api/receive/initiate, then start the status poller (spec §4/§7). */
  const startRun = async (mode: TransferMode) => {
    const address = wallet.address;
    if (!address) return;
    try {
      parseUsdcBase6(usdcAmount);

      // Re-fetch the address and assert no drift before recording the intent.
      const { getAddress } = await import('@stellar/freighter-api');
      const liveAddress = extractLiveAddress(await getAddress());
      if (liveAddress) {
        assertAddressUnchanged(address, liveAddress);
      }

      const trimmedMaxFee = maxFee.trim();
      const res = await fetch('/api/receive/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          burnTxHash,
          address,
          amount: usdcAmount,
          sourceDomain: activeDomain.domainId,
          transferMode: mode,
          ...(trimmedMaxFee ? { maxFee: trimmedMaxFee } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        intentId?: string;
        error?: { remediation?: string };
      };
      if (!res.ok) {
        throw new Error(body?.error?.remediation ?? `Initiate failed (${res.status})`);
      }

      runRef.current = {
        address,
        burnTxHash,
        amount: usdcAmount,
        sourceDomain: activeDomain.domainId,
        mode,
        intentId: body.intentId ?? '',
        ...(trimmedMaxFee ? { maxFee: trimmedMaxFee } : {}),
        startedAt: Date.now(),
      };
      pollingRef.current = true;
      setDeposit((s) => reduceDeposit(s, { type: 'burn-submitted', burnTxHash, mode }));
      scheduleNextPoll();
    } catch (err) {
      finishRun();
      runRef.current = null;
      setDeposit((s) =>
        reduceDeposit(s, {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        }),
      );
    }
  };

  /** Quote the fee for a mode. Stale responses are dropped, not rendered. */
  const refreshQuote = async (mode: TransferMode) => {
    const seq = ++quoteSeqRef.current;
    try {
      const query = new URLSearchParams({
        sourceDomain: String(activeDomain.domainId),
        destDomain: String(STELLAR_CCTP_DOMAIN),
        mode,
      });
      const res = await fetch(`/api/fees?${query.toString()}`);
      const body = (await res.json().catch(() => ({}))) as {
        minimumFee?: string;
        finalityThreshold?: number;
        fastTierAvailable?: boolean;
        cachedAt?: string;
        error?: { remediation?: string };
      };
      if (seq !== quoteSeqRef.current) return;
      if (!res.ok) {
        setQuoteError(body?.error?.remediation ?? `Fee quote unavailable (${res.status}).`);
        return;
      }
      setQuoteError(null);
      const quote: FeeQuote = {
        minimumFee: String(body.minimumFee ?? '0'),
        finalityThreshold: body.finalityThreshold ?? 0,
        fastTierAvailable: body.fastTierAvailable !== false,
        cachedAt: body.cachedAt ?? '',
        mode,
        fetchedAt: Date.now(),
      };
      setDeposit((s) => reduceDeposit(s, { type: 'quote-received', quote }));
    } catch {
      if (seq !== quoteSeqRef.current) return;
      setQuoteError('Fee quote unavailable — retry, or switch to Standard.');
    }
  };

  // The panel's inputs live in the machine so the quote rules see them.
  useEffect(() => {
    setDeposit((s) => reduceDeposit(s, { type: 'amount', amount: usdcAmount }));
  }, [usdcAmount]);

  useEffect(() => {
    setDeposit((s) => reduceDeposit(s, { type: 'max-fee', maxFee }));
  }, [maxFee]);

  // Panel quote: refetch when the route or the mode changes.
  useEffect(() => {
    if (!wallet.connected) return;
    void refreshQuote(deposit.mode);
  }, [wallet.connected, activeDomain.domainId, deposit.mode]);

  // Execute asked for a quote (fresh or after the 5-minute rule). `quoting` is the
  // machine's instruction to fetch; the frame's arrival moves it on to `burning`.
  useEffect(() => {
    if (deposit.step !== 'quoting') return;
    void refreshQuote(deposit.mode);
  }, [deposit.step]);

  // Execute cleared the panel: register the intent and start polling.
  useEffect(() => {
    if (deposit.step !== 'burning' || runRef.current) return;
    void startRun(deposit.mode);
  }, [deposit.step]);

  const handleModeChange = (mode: TransferMode) => {
    setDeposit((s) => reduceDeposit(s, { type: 'mode-change', mode }));
  };

  const handleExecuteDeposit = () => {
    if (!wallet.connected || !wallet.address) {
      onConnectWallet();
      return;
    }

    // Error simulation: inject synthetic event instead of starting a transfer.
    const simEvt = simErrorEvent(simError);
    if (simEvt) {
      setDeposit((s) => reduceDeposit({ ...s, step: 'burning' }, simEvt));
      return;
    }

    // A previous attempt's run must not block the new one.
    runRef.current = null;
    finishRun();
    setDeposit((s) => reduceDeposit(s, { type: 'execute' }));
  };

  /** Spec §7: cancel stops the wait only — the burn stays valid and retryable. */
  const handleCancel = () => {
    finishRun();
    setDeposit((s) => reduceDeposit(s, { type: 'cancel' }));
  };

  /** Retry as Standard: resume the same intent and wait on the Standard timeline. */
  const handleRetryStandard = () => {
    if (!runRef.current) return;
    runRef.current = { ...runRef.current, startedAt: Date.now() };
    pollingRef.current = true;
    setDeposit((s) => reduceDeposit(s, { type: 'retry-standard' }));
    scheduleNextPoll();
  };

  const handleDismissCancelled = () => {
    runRef.current = null;
    finishRun();
    setDeposit({ ...initialDeposit, mode: deposit.mode, amount: usdcAmount, maxFee });
  };

  /** Inputs and the mode toggle are live until the intent binds them (spec §7). */
  const isPreBurn = deposit.step === 'idle' || deposit.step === 'error' || deposit.step === 'quoting';
  const inputsDisabled = !isPreBurn;
  const waiting = isPollingStep(deposit.step);
  const inFlight = deposit.step === 'burning' || deposit.step === 'settling';
  const { quote } = deposit;
  const overMax = quoteFeeOverMax(deposit);
  const fastUnavailable = quote !== undefined && !quote.fastTierAvailable;

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
                    disabled={inputsDisabled}
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
                    disabled={inputsDisabled}
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
                    disabled={inputsDisabled}
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

              {/* Fee Quote Panel — shown before Execute (spec §7) */}
              {wallet.connected && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold">Transfer Mode</span>
                    <div className="flex items-center space-x-1.5">
                      {(['fast', 'standard'] as TransferMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleModeChange(mode)}
                          disabled={inputsDisabled || (mode === 'fast' && fastUnavailable)}
                          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            deposit.mode === mode
                              ? 'bg-[#3E6BFF] text-white shadow-md'
                              : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {mode === 'fast' ? 'Fast' : 'Standard'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Route:</span>
                    <span className="text-white font-bold">
                      {activeDomain.name} → Stellar ({STELLAR_CCTP_DOMAIN})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minimum fee:</span>
                    <span className="text-white font-bold">
                      {quote ? `${quote.minimumFee} bps` : quoteError ? 'unavailable' : 'quoting…'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Max Fee (USDC, optional)
                    </label>
                    <input
                      type="text"
                      value={maxFee}
                      onChange={(e) => setMaxFee(e.target.value)}
                      placeholder="No cap"
                      disabled={inputsDisabled}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  {overMax && (
                    <div className="flex items-start text-amber-400 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                      <span>
                        Quoted fee is above your max fee — raise the cap or switch to Standard, or this
                        transfer would continue as Standard.
                      </span>
                    </div>
                  )}
                  {fastUnavailable && (
                    <div className="flex items-start text-amber-400 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                      <span>Fast allowance unavailable for this route — use Standard.</span>
                    </div>
                  )}
                  {quoteError && (
                    <div className="flex items-start text-rose-300 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                      <span>{quoteError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action CTA Button */}
              <button
                onClick={wallet.connected ? handleExecuteDeposit : onConnectWallet}
                disabled={inputsDisabled}
                className="w-full py-4 rounded-xl bg-[#3E6BFF] hover:bg-[#345CE0] text-white font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {inFlight || waiting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{inFlight ? 'Processing CCTP Ingestion...' : 'Waiting for Circle attestation...'}</span>
                  </>
                ) : deposit.step === 'quoting' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Re-quoting the Circle fee...</span>
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
              {!wallet.connected && wallet.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-300">
                  <span className="font-bold">Wallet connection failed: </span>
                  {wallet.error}
                  {/install/i.test(wallet.error) && (
                    <>
                      {' — '}
                      <a
                        href="https://freighter.app"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold"
                      >
                        Install Freighter
                      </a>
                    </>
                  )}
                </div>
              )}
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
                  {deposit.receipt.simulated && deposit.receipt.txHash.startsWith('SIM-') ? (
                    <span className="truncate max-w-[140px] text-white">{deposit.receipt.txHash}</span>
                  ) : (
                    <a
                      href={`https://stellar.expert/explorer/${network}/tx/${deposit.receipt.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate max-w-[140px] text-white underline hover:text-emerald-400"
                    >
                      {deposit.receipt.txHash}
                    </a>
                  )}
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

            {/* Cancelled — the wait stopped, the burn did not go away (spec §7) */}
            {deposit.step === 'cancelled' && (
              <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-extrabold text-slate-200">Cancelled — no mint was attempted.</div>
                <p className="text-xs text-slate-400 font-mono">
                  Cancelling stops waiting; your burn stays valid — retry anytime.
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRetryStandard}
                    className="flex-1 py-3 rounded-xl bg-[#3E6BFF] hover:bg-[#345CE0] text-white font-extrabold text-xs transition-all cursor-pointer"
                  >
                    Retry as Standard
                  </button>
                  <button
                    onClick={handleDismissCancelled}
                    className="flex-1 py-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    Start a new transfer
                  </button>
                </div>
              </div>
            )}

            {/* Step Indicator */}
            {!isPreBurn && deposit.step !== 'settled' && deposit.step !== 'error' && deposit.step !== 'cancelled' && (
              <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono space-y-3">
                <div className="flex items-center space-x-2 text-slate-400">
                  {deposit.step === 'burning' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Verifying wallet and registering the burn…</span>
                    </>
                  )}
                  {deposit.step === 'fast-wait' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>
                        Fast Transfer: attestation expected in seconds (attempt {Math.max(deposit.attempts, 1)})
                      </span>
                    </>
                  )}
                  {deposit.step === 'degraded-standard' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      <span>
                        Fast allowance unavailable — continuing as Standard (minutes). Cancel or leave open.
                      </span>
                    </>
                  )}
                  {deposit.step === 'attesting' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>
                        Standard Transfer: attestation expected in minutes (attempt {Math.max(deposit.attempts, 1)})
                      </span>
                    </>
                  )}
                  {deposit.step === 'settling' && (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span>Submitting Soroban mint…</span>
                    </>
                  )}
                </div>
                {waiting && (
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <p className="text-slate-500">
                      Cancelling stops waiting; your burn stays valid — retry anytime.
                    </p>
                    <button
                      onClick={handleCancel}
                      className="w-full py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 hover:text-rose-300 text-slate-300 font-extrabold text-[11px] transition-all cursor-pointer"
                    >
                      Cancel waiting
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
