import React from 'react';
import { Wallet, ShieldCheck, ExternalLink, Terminal, BookOpen } from 'lucide-react';
import { WalletState } from '../wallet/freighter';

interface NavbarProps {
  wallet: WalletState;
  onConnect: () => void;
  activeTab: 'deposit' | 'toml' | 'code';
  setActiveTab: (tab: 'deposit' | 'toml' | 'code') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  wallet,
  onConnect,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-red-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ⚓
            </div>
            <div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">AnchorCCTP</span>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Stellar Testnet
              </span>
            </div>
          </div>

          <nav className="hidden md:flex space-x-1 ml-8">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'deposit'
                  ? 'bg-red-50 text-red-900 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Deposit Portal
            </button>
            <button
              onClick={() => setActiveTab('toml')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'toml'
                  ? 'bg-red-50 text-red-900 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              stellar.toml
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'code'
                  ? 'bg-red-50 text-red-900 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              SDK Integration
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onConnect}
            className={`inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium shadow-sm transition-all ${
              wallet.connected
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {wallet.connected ? (
              <span className="font-mono text-xs">
                {wallet.address?.slice(0, 5)}...{wallet.address?.slice(-4)}
                {wallet.isSimulated && ' (Sandbox)'}
              </span>
            ) : (
              'Connect Freighter'
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
