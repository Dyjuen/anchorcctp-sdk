import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CctpDepositFlow } from './components/CctpDepositFlow';
import { TomlInspector } from './components/TomlInspector';
import { CodeSnippet } from './components/CodeSnippet';
import { Footer } from './components/Footer';
import { WalletState, connectFreighter } from './wallet/freighter';

export function App() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
  });
  const [activeTab, setActiveTab] = useState<'deposit' | 'toml' | 'code'>('deposit');

  const handleConnectWallet = async () => {
    const res = await connectFreighter();
    setWallet(res);
  };

  useEffect(() => {
    // Attempt auto-connect on mount if previously connected
    connectFreighter().then((res) => {
      if (res.connected) {
        setWallet(res);
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCFB] text-gray-900">
      <Navbar
        wallet={wallet}
        onConnect={handleConnectWallet}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {activeTab === 'deposit' && (
          <CctpDepositFlow
            wallet={wallet}
            onConnectWallet={handleConnectWallet}
          />
        )}
        {activeTab === 'toml' && <TomlInspector />}
        {activeTab === 'code' && <CodeSnippet />}
      </main>

      <Footer />
    </div>
  );
}

export default App;
