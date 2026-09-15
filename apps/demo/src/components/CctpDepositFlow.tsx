import React, { useState } from 'react';
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
} from 'lucide-react';
import { WalletState, signWithFreighter } from '../wallet/freighter';

interface CctpDepositFlowProps {
  wallet: WalletState;
  onConnectWallet: () => void;
}

export const CctpDepositFlow: React.FC<CctpDepositFlowProps> = ({
  wallet,
  onConnectWallet,
}) => {
  const [sourceDomainId, setSourceDomainId] = useState<number>(0); // Default: Ethereum
  const [burnTxHash, setBurnTxHash] = useState<string>(
    '0x9a8f4c2e1b3d7a8c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d'
  );
  const [usdcAmount, setUsdcAmount] = useState<string>('100.00');
  const [allowTrustline, setAllowTrustline] = useState<boolean>(true);

  // Flow lifecycle state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [attestationAttempts, setAttestationAttempts] = useState<number>(0);
  const [settlementResult, setSettlementResult] = useState<{
    mintTxHash: string;
    stellarAmount: string;
    dust: string;
    timeMs: number;
  } | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code: string;
    message: string;
    remediation: string;
  } | null>(null);

  const selectedDomain = CCTP_DOMAINS[sourceDomainId] || CCTP_DOMAINS[0];

  const handleRandomTxHash = () => {
    const randomHex =
      '0x' +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
    setBurnTxHash(randomHex);
  };

  const handleStartDeposit = async () => {
    if (!wallet.connected || !wallet.address) {
      onConnectWallet();
      return;
    }

    setIsProcessing(true);
    setErrorDetails(null);
    setSettlementResult(null);
    setCurrentStep(1); // Step 1: Burn Verified
    const startTime = Date.now();

    try {
      // Step 1: Source Burn Detection
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: Circle Iris Attestation Polling
      setCurrentStep(2);
      for (let attempt = 1; attempt <= 3; attempt++) {
        setAttestationAttempts(attempt);
        await new Promise((r) => setTimeout(r, 700));
      }

      // Step 3: Soroban Mint Signing & Submission
      setCurrentStep(3);
      const jsonPayload = JSON.stringify({
        action: 'cctp_mint',
        destination: wallet.address,
        burnTxHash,
      });
      const mockXdr = btoa(encodeURIComponent(jsonPayload));

      await signWithFreighter(mockXdr);
      await new Promise((r) => setTimeout(r, 800));

      // Step 4: Settlement & Decimal Scaling (6 -> 7 decimals)
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
        timeMs: Date.now() - startTime,
      });
      setIsProcessing(false);
    } catch (err: unknown) {
      setIsProcessing(false);
      setErrorDetails({
        code: 'DEPOSIT_ERROR',
        message: err instanceof Error ? err.message : 'Deposit workflow encountered an error.',
        remediation:
          'Ensure Freighter wallet is unlocked, trustline is allowed, or retry with a valid transaction hash.',
      });
    }
  };

  return (
    <div id="demo" className="max-w-6xl mx-auto space-y-8 scroll-mt-24 px-4 sm:px-6 lg:px-8">
      {/* Title / Intro */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#3E6BFF]/15 border border-[#3E6BFF]/30 text-[#3E6BFF] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#3E6BFF]" />
          Interactive Settlement Portal
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
          Execute Cross-Chain USDC Deposit
        </h2>
        <p className="text-slate-300 max-w-2xl mx-auto text-sm sm:text-base font-medium leading-relaxed">
          Test real-time Circle Iris attestation, Soroban mint execution, and 6-to-7 decimal precision scaling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Deposit Configuration Panel */}
        <div className="lg:col-span-6 arch-card rounded-2xl p-6 sm:p-8 space-y-6 bg-slate-900/80 border border-slate-800">
          <h3 className="text-lg font-extrabold text-white flex items-center border-b border-slate-800 pb-4">
            <Coins className="w-5 h-5 mr-2.5 text-[#3E6BFF]" />
            Deposit Parameters
          </h3>

          {/* Source Chain Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Source Blockchain (CCTP Domain)
            </label>
            <select
              value={sourceDomainId}
              onChange={(e) => setSourceDomainId(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:ring-2 focus:ring-[#3E6BFF] focus:border-[#3E6BFF] focus:outline-none transition-all"
            >
              {Object.values(CCTP_DOMAINS).map((d) => (
                <option key={d.domainId} value={d.domainId} className="bg-slate-900 text-white">
                  {d.name} (Domain ID: {d.domainId} • {d.networkType})
                </option>
              ))}
            </select>
          </div>

          {/* USDC Amount */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Amount (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:ring-2 focus:ring-[#3E6BFF] focus:border-[#3E6BFF] focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-3 text-xs font-extrabold text-slate-400">
                USDC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Converts 6 EVM decimals → 7 Stellar Stroop decimals (+1 decimal scale)
            </p>
          </div>

          {/* Source Burn Transaction Hash */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Source Burn Transaction Hash
              </label>
              <button
                type="button"
                onClick={handleRandomTxHash}
                disabled={isProcessing}
                className="text-xs text-[#3E6BFF] hover:underline font-bold flex items-center transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Randomize Hash
              </button>
            </div>
            <input
              type="text"
              value={burnTxHash}
              onChange={(e) => setBurnTxHash(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono font-medium text-white focus:ring-2 focus:ring-[#3E6BFF] focus:border-[#3E6BFF] focus:outline-none transition-all"
            />
          </div>

          {/* Destination Stellar Account */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Destination Stellar Address
            </label>
            <input
              type="text"
              readOnly
              value={
                wallet.connected && wallet.address
                  ? wallet.address
                  : 'Connect Freighter Wallet to set destination...'
              }
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Trustline Auto-Creation Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs font-extrabold text-white">Auto-Create USDC Trustline</p>
                <p className="text-[11px] text-slate-400 font-medium">Capped at 2 XLM sponsorship reserve</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={allowTrustline}
              onChange={(e) => setAllowTrustline(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 text-[#3E6BFF] rounded focus:ring-[#3E6BFF] cursor-pointer"
            />
          </div>

          {/* Action CTA */}
          <button
            onClick={wallet.connected ? handleStartDeposit : onConnectWallet}
            disabled={isProcessing}
            className={`w-full py-4 px-4 rounded-xl font-extrabold text-xs sm:text-sm shadow-md transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer ${
              isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-wait'
                : 'bg-[#3E6BFF] hover:bg-[#345CE0] text-white active:scale-[0.99]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Processing CCTP Settlement...
              </>
            ) : wallet.connected ? (
              <>
                <span>Execute CCTP Deposit</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <span>Connect Freighter Wallet to Start</span>
            )}
          </button>
        </div>

        {/* Real-time Lifecycle Visualization */}
        <div className="lg:col-span-6 arch-card rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between bg-slate-900/80 border border-slate-800">
          <div className="space-y-6">
            <h3 className="text-lg font-extrabold text-white flex items-center border-b border-slate-800 pb-4">
              <Layers className="w-5 h-5 mr-2.5 text-[#3E6BFF]" />
              Live Settlement Lifecycle
            </h3>

            {/* Steps Timeline */}
            <div className="space-y-3.5">
              {/* Step 1: Burn Confirmation */}
              <div
                className={`flex items-start space-x-3.5 p-4 rounded-xl border transition-all duration-300 ${
                  currentStep >= 1
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep >= 1 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                      1
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    Source Burn Verified
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Chain: {selectedDomain.name} (Domain {selectedDomain.domainId})
                  </p>
                </div>
              </div>

              {/* Step 2: Iris Attestation */}
              <div
                className={`flex items-start space-x-3.5 p-4 rounded-xl border transition-all duration-300 ${
                  currentStep === 2
                    ? 'border-[#3E6BFF]/60 bg-[#3E6BFF]/15'
                    : currentStep > 2
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep > 2 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : currentStep === 2 ? (
                    <RefreshCw className="w-5 h-5 text-[#3E6BFF] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                      2
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    Circle Iris Attestation
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {currentStep === 2
                      ? `Polling Iris proof (Attempt ${attestationAttempts})...`
                      : currentStep > 2
                      ? 'Iris cryptographic proof verified'
                      : 'Awaiting source finality'}
                  </p>
                </div>
              </div>

              {/* Step 3: Soroban Mint */}
              <div
                className={`flex items-start space-x-3.5 p-4 rounded-xl border transition-all duration-300 ${
                  currentStep === 3
                    ? 'border-[#3E6BFF]/60 bg-[#3E6BFF]/15'
                    : currentStep > 3
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep > 3 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : currentStep === 3 ? (
                    <RefreshCw className="w-5 h-5 text-[#3E6BFF] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                      3
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    Soroban Mint Submission
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {currentStep === 3
                      ? 'Submitting delegated transaction via Forwarder...'
                      : currentStep > 3
                      ? 'Forwarder contract executed mint'
                      : 'Awaiting attestation verification'}
                  </p>
                </div>
              </div>

              {/* Step 4: Stellar Settlement */}
              <div
                className={`flex items-start space-x-3.5 p-4 rounded-xl border transition-all duration-300 ${
                  currentStep >= 4
                    ? 'border-emerald-500/40 bg-emerald-500/15'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep >= 4 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                      4
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white">
                    Stellar USDC Settlement
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {currentStep >= 4
                      ? 'Tokens credited to destination account'
                      : 'Awaiting Soroban mint execution'}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {errorDetails && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2">
                <div className="flex items-center text-rose-300 font-extrabold text-xs">
                  <AlertCircle className="w-4 h-4 mr-1.5 text-rose-400 shrink-0" />
                  [{errorDetails.code}] {errorDetails.message}
                </div>
                <p className="text-xs text-rose-400 font-medium">
                  Remediation: {errorDetails.remediation}
                </p>
              </div>
            )}

            {/* Settlement Receipt */}
            {settlementResult && (
              <div className="p-5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                    Settlement Summary
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Settled in {settlementResult.timeMs}ms
                  </span>
                </div>
                <div className="text-xs space-y-1.5 font-mono text-white">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credited Amount:</span>
                    <span className="font-extrabold text-emerald-400">{settlementResult.stellarAmount} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dust Sweep:</span>
                    <span className="font-medium text-white">{settlementResult.dust} base units</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-800/50 flex justify-between items-center">
                    <span className="text-slate-400">Stellar Tx Hash:</span>
                    <span className="text-emerald-300 font-bold truncate max-w-[180px]">
                      {settlementResult.mintTxHash}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Powered by @anchor-cctp/core</span>
            <span className="font-mono text-slate-400">Circle Iris API v1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
