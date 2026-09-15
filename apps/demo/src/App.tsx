import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { CctpDepositFlow } from './components/CctpDepositFlow';
import { DevPlaygroundSection } from './components/DevPlaygroundSection';
import { ArchitectureDocsSection } from './components/ArchitectureDocsSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { WalletState, connectFreighter } from './wallet/freighter';

export function App() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
  });
  const [activeSection, setActiveSection] = useState<string>('hero');

  const handleConnectWallet = async () => {
    const res = await connectFreighter();
    setWallet(res);
  };

  useEffect(() => {
    connectFreighter().then((res) => {
      if (res.connected) {
        setWallet(res);
      }
    });
  }, []);

  const scrollToDemo = () => {
    setActiveSection('demo');
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToDocs = () => {
    setActiveSection('playground');
    document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#070C18] text-slate-100 selection:bg-[#3E6BFF] selection:text-white bg-grid-lines font-sans">
      {/* Background Ambient Glows */}
      <div className="bg-mesh-glow">
        <div className="bg-blob-1" />
        <div className="bg-blob-2" />
      </div>

      <Navbar
        wallet={wallet}
        onConnect={handleConnectWallet}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <main className="relative z-10 flex-1 space-y-16 pb-16">
        <HeroSection
          onExploreDemo={scrollToDemo}
          onExploreDocs={scrollToDocs}
        />

        <CctpDepositFlow
          wallet={wallet}
          onConnectWallet={handleConnectWallet}
        />

        <FeaturesSection />

        <DevPlaygroundSection />

        <ArchitectureDocsSection />

        <FaqSection />
      </main>

      <Footer />
    </div>
  );
}

export default App;
