import React from 'react';
import { motion } from 'framer-motion';

const AdvancedHero = () => {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative h-screen w-full bg-transparent overflow-hidden border-b border-border/5">
      {/* Static Background Grid - Crimson Tone */}
      <div className="absolute inset-0 z-0 opacity-[0.05]">
        <div className="absolute inset-0 bg-[radial-gradient(#550C18_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Main Container - Removed max-width centering to allow far-left alignment */}
      <div className="w-full h-full px-8 md:px-12 lg:px-20 grid grid-cols-12 relative z-10">
        {/* Foreground Content - Flushed to the far left with reduced span to separate from graphic */}
        <div className="col-span-12 lg:col-span-7 flex flex-col justify-center pt-24 z-20">

          <h1 className="font-display text-[10vw] lg:text-[11vw] leading-[0.75] uppercase tracking-tighter text-foreground mb-12 ml-[-12px]">
            ACCEPTING<br />
            <span className="text-accent italic drop-shadow-[0_0_15px_rgba(85,12,24,0.15)]">CROSS-CHAIN.</span>
          </h1>

          <div className="max-w-md">
            <p className="text-muted text-sm md:text-base leading-relaxed uppercase tracking-wider mb-14 opacity-60">
              One SDK for CCTP on Stellar. Every USDC deposit from 23+ chains —
              decimal conversion, forwarder calls, attestation polling, and trustlines handled for you.
            </p>

            <div className="flex gap-6 relative z-30">
              <button
                className="group relative px-10 py-5 border border-border text-foreground font-bold uppercase text-[10px] tracking-[0.2em] overflow-hidden transition-all duration-700 hover:border-accent"
                onClick={() => window.open('https://www.npmjs.com/package/@anchor-cctp/core', '_blank')}
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-accent/5 translate-y-[101%] group-hover:translate-y-0 transition-transform duration-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Resilience Core - Shifted slightly left into view as requested */}
        <div className="absolute top-1/2 right-[-20%] lg:right-[-10%] -translate-y-1/2 w-[600px] h-[600px] lg:w-[1200px] lg:h-[1200px] pointer-events-none flex items-center justify-center opacity-30 lg:opacity-40 z-10">
          <div className="relative w-full h-full">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_40px_rgba(85,12,24,0.05)]">
              {/* Concentric Rotating Rings */}
              <motion.circle
                cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.02" strokeDasharray="1 3"
                className="opacity-20 text-foreground"
                animate={{ rotate: 360 }}
                transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
              />
              <motion.circle
                cx="50" cy="50" r="35" fill="none" stroke="#550C18" strokeWidth="0.15" strokeDasharray="5 5"
                className="opacity-40"
                animate={{ rotate: -360 }}
                transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
              />
              <motion.circle
                cx="50" cy="50" r="28" fill="none" stroke="#550C18" strokeWidth="0.3" strokeDasharray="15 5"
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              />

              {/* Scanning Laser Line */}
              <motion.line
                x1="0" y1="50" x2="100" y2="50" stroke="#550C18" strokeWidth="0.4"
                animate={{ y: [-45, 45, -45] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            {/* Central Node */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-accent rounded-full blur-[10px] animate-pulse shadow-[0_0_40px_rgba(85,12,24,0.3)]" />
          </div>
        </div>
      </div>

      {/* Subtle Sidebar HUD */}
      <div className="absolute right-12 bottom-12 flex flex-col gap-3 opacity-40 hidden md:flex">
        <p className="text-[8px] font-mono tracking-[0.5em] uppercase text-foreground">Registry: npm</p>
        <p className="text-[8px] font-mono tracking-[0.5em] uppercase text-foreground">Chains: 23+ / Stellar: 27</p>
      </div>
    </section>
  );
};

export default AdvancedHero;
