import React from 'react';
import { Wallet } from 'lucide-react';
import { WalletState } from '../wallet/freighter';

interface NavbarProps {
  wallet: WalletState;
  onConnect: () => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  wallet,
  onConnect,
  activeSection,
  setActiveSection,
}) => {
  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="arch-nav sticky top-0 z-50 border-b border-slate-800/80 bg-[#070C18]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <a href="#" className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/60 p-1.5 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              <img
                src="/assets/img/final.svg"
                alt="AnchorCCTP Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black text-white tracking-tight">
                Anchor<span className="text-[#3E6BFF]">CCTP</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3E6BFF]/20 text-[#3E6BFF] border border-[#3E6BFF]/40">
                SEP-CCTP
              </span>
            </div>
          </a>

          <nav className="hidden md:flex space-x-1 ml-6">
            <button
              onClick={() => scrollTo('demo')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSection === 'demo'
                  ? 'bg-[#3E6BFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Deposit Demo
            </button>
            <button
              onClick={() => scrollTo('process')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSection === 'process'
                  ? 'bg-[#3E6BFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollTo('playground')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSection === 'playground'
                  ? 'bg-[#3E6BFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Developer SDK
            </button>
            <button
              onClick={() => scrollTo('faq')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeSection === 'faq'
                  ? 'bg-[#3E6BFF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              FAQ
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="https://github.com/mothersgrace/anchorcctp-sdk"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors hidden sm:block border border-slate-800"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>

          <button
            onClick={onConnect}
            className={`inline-flex items-center px-4 py-2 border rounded-xl text-xs font-bold transition-all duration-200 shadow-sm cursor-pointer ${
              wallet.connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-[#3E6BFF] bg-[#3E6BFF] text-white hover:bg-[#345CE0]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 mr-2" />
            {wallet.connected ? (
              <span className="font-mono">
                {wallet.address?.slice(0, 5)}...{wallet.address?.slice(-4)}
              </span>
            ) : (
              'Connect Wallet'
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
