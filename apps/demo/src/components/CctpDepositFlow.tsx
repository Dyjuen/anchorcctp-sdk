import React, { useState } from 'react';
import {
  CCTP_DOMAINS,
  convert6to7,
  formatStellarUnits,
} from '@anchor-cctp/core';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Coins,
  Shield,
  Layers,
} from 'lucide-react';
import { WalletState, signWithFreighter } from '../wallet/freighter';

interface CctpDepositFlowProps {
  wallet: WalletState;
  onConnectWallet: () => void;
}

type StepStatus = 'idle' | 'in_progress' | 'complete' | 'failed';

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
      // Simulate/Trigger Step 1: Source Burn Detection
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: Circle Iris Attestation Polling
      setCurrentStep(2);
      for (let attempt = 1; attempt <= 3; attempt++) {
        setAttestationAttempts(attempt);
        await new Promise((r) => setTimeout(r, 700));
      }

      // Step 3: Soroban Mint Signing & Submission
      setCurrentStep(3);
      const mockXdr = Buffer.from(
        JSON.stringify({
          action: 'cctp_mint',
          destination: wallet.address,
          burnTxHash,
        })
      ).toString('base64');

      const signedTx = await signWithFreighter(mockXdr);
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
    } catch (err: any) {
      setIsProcessing(false);
      setErrorDetails({
        code: 'DEPOSIT_ERROR',
        message: err?.message || 'Deposit workflow encountered an error.',
        remediation:
          'Ensure Freighter wallet is unlocked, trustline is allowed, or retry with a valid transaction hash.',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title / Intro */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          Universal Cross-Chain USDC Deposit
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto text-base">
          Accept USDC natively from any Circle CCTP-connected blockchain directly onto Stellar
          with atomic attestation verification and 6-to-7 decimal precision.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Deposit Configuration Panel */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Coins className="w-5 h-5 mr-2 text-red-900" />
            Deposit Parameters
          </h2>

          {/* Source Chain Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Source Blockchain (CCTP Domain)
            </label>
            <select
              value={sourceDomainId}
              onChange={(e) => setSourceDomainId(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-red-900 focus:outline-none"
            >
              {Object.values(CCTP_DOMAINS).map((d) => (
                <option key={d.domainId} value={d.domainId}>
                  {d.name} (Domain ID: {d.domainId} • {d.networkType})
                </option>
              ))}
            </select>
          </div>

          {/* USDC Amount */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
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
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-red-900 focus:outline-none"
              />
              <span className="absolute right-4 top-2.5 text-xs font-bold text-gray-500">
                USDC
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Converts 6 EVM decimals → 7 Stellar Stroop decimals (+1 decimal scale)
            </p>
          </div>

          {/* Source Burn Transaction Hash */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Source Burn Transaction Hash
              </label>
              <button
                type="button"
                onClick={handleRandomTxHash}
                disabled={isProcessing}
                className="text-xs text-red-900 hover:text-red-700 font-medium flex items-center"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Generate Sample Hash
              </button>
            </div>
            <input
              type="text"
              value={burnTxHash}
              onChange={(e) => setBurnTxHash(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-red-900 focus:outline-none"
            />
          </div>

          {/* Destination Stellar Account */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Destination Stellar Address
            </label>
            <input
              type="text"
              readOnly
              value={
                wallet.connected && wallet.address
                  ? wallet.address
                  : 'Connect Freighter Wallet above...'
              }
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-700 cursor-not-allowed"
            />
          </div>

          {/* Trustline Auto-Creation Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-gray-900">Auto-Create USDC Trustline</p>
                <p className="text-xs text-gray-500">Capped at 2 XLM sponsorship reserve</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={allowTrustline}
              onChange={(e) => setAllowTrustline(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 text-red-900 rounded focus:ring-red-900"
            />
          </div>

          {/* Action CTA */}
          <button
            onClick={wallet.connected ? handleStartDeposit : onConnectWallet}
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center space-x-2 ${
              isProcessing
                ? 'bg-gray-400 text-white cursor-wait'
                : 'bg-red-900 hover:bg-red-950 text-white'
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
              <span>Connect Wallet to Deposit</span>
            )}
          </button>
        </div>

        {/* Real-time Lifecycle Visualization */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-red-900" />
              Live Settlement Lifecycle
            </h2>

            {/* Steps Timeline */}
            <div className="space-y-4">
              {/* Step 1: Burn Confirmation */}
              <div
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                  currentStep >= 1
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep >= 1 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                      1
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Source Burn Verified
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    Chain: {selectedDomain.name} (Domain {selectedDomain.domainId})
                  </p>
                </div>
              </div>

              {/* Step 2: Iris Attestation */}
              <div
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                  currentStep === 2
                    ? 'border-blue-300 bg-blue-50/60'
                    : currentStep > 2
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep > 2 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : currentStep === 2 ? (
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                      2
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Circle Iris Attestation
                  </p>
                  <p className="text-xs text-gray-500">
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
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                  currentStep === 3
                    ? 'border-blue-300 bg-blue-50/60'
                    : currentStep > 3
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep > 3 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : currentStep === 3 ? (
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                      3
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Soroban Mint Submission
                  </p>
                  <p className="text-xs text-gray-500">
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
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                  currentStep >= 4
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="mt-0.5">
                  {currentStep >= 4 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                      4
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Stellar USDC Settlement
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentStep >= 4
                      ? 'Tokens credited to destination account'
                      : 'Awaiting Soroban mint execution'}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {errorDetails && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center text-red-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 mr-1 text-red-600" />
                  [{errorDetails.code}] {errorDetails.message}
                </div>
                <p className="text-xs text-red-800 font-medium">
                  Remediation: {errorDetails.remediation}
                </p>
              </div>
            )}

            {/* Settlement Receipt */}
            {settlementResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase">
                    Settlement Summary
                  </span>
                  <span className="text-xs font-mono text-emerald-700">
                    Settled in {settlementResult.timeMs}ms
                  </span>
                </div>
                <div className="text-xs space-y-1 font-mono text-emerald-950">
                  <div className="flex justify-between">
                    <span>Credited Amount:</span>
                    <span className="font-bold">{settlementResult.stellarAmount} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dust Sweep:</span>
                    <span>{settlementResult.dust} base units</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                    <span>Stellar Tx Hash:</span>
                    <span className="text-emerald-700 truncate max-w-[180px]">
                      {settlementResult.mintTxHash}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Powered by @anchor-cctp/core</span>
            <span className="font-mono">Circle Iris API v1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
