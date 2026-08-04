import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const Solution = () => {
  const targetRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);
  // Move numbers at 0.5x speed relative to cards (depth effect)
  const bgX = useTransform(scrollYProgress, [0, 1], ["0%", "37.5%"]);

  const features = [
    {
      id: '01',
      title: 'One Receive Call',
      desc: 'The Core. AnchorCCTP.receive() replaces weeks of custom engineering — detect the burn, settle the mint, credit the USDC.',
    },
    {
      id: '02',
      title: 'Attestation Polling',
      desc: 'The Watcher. Polls the Circle Attestation API with configurable retry/backoff until the mint proof is ready.',
    },
    {
      id: '03',
      title: 'Forwarder & Decimals',
      desc: 'The Translator. 32-byte EVM address → G... via the forwarder contract. 6-decimal CCTP → 7-decimal Stellar, dust to collector.',
    },
    {
      id: '04',
      title: 'Trustline & Events',
      desc: 'The Settler. Auto-creates missing USDC trustlines, credits the destination, and emits onReceiving / onSettled / onDustCollected.',
    },
  ];

  return (
    <section ref={targetRef} className={`relative ${isMobile ? 'h-auto py-24' : 'h-[400vh]'}`}>
      <div className={`${isMobile ? 'relative' : 'sticky top-0 h-screen'} flex flex-col justify-center overflow-hidden`}>
        <div className="w-full px-8 md:px-12 lg:px-24 relative z-10 mb-12">
          <header className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-2xl">
              <h2 className="text-caption-s text-accent uppercase tracking-[0.3em] font-bold mb-6 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-accent" /> / Section 02 / The Fix
              </h2>
              <h3 className="text-display-xl leading-[0.85] uppercase mb-8 text-foreground">
                Cross-Chain<br />
                <span className="text-muted/40 italic">Receipt.</span>
              </h3>
              <p className="text-xl text-muted leading-relaxed">
                AnchorCCTP provides the missing link in the Stellar anchor toolchain,
                making the CCTP leg invisible to the anchor — receive() returns settled USDC
                ready for the existing SEP-24/6 off-ramp flow.
              </p>
            </div>
            
            <div className="bg-accent p-8 md:mt-12 group hover:bg-foreground transition-colors duration-500 cursor-pointer">
              <p className="text-background text-caption-s font-bold uppercase tracking-widest mb-2">Deliverable 01 Status</p>
              <p className="text-3xl font-display uppercase text-background">In Development</p>
            </div>
          </header>
        </div>

        <motion.div 
          style={isMobile ? {} : { x }} 
          className={`flex ${isMobile ? 'flex-col gap-32 px-8' : 'gap-24 px-24'}`}
        >
          {features.map((f) => (
            <div key={f.id} className={`relative ${isMobile ? 'w-full' : 'w-[80vw] md:w-[600px]'} shrink-0 group`}>
              <motion.div 
                style={isMobile ? {} : { x: bgX }}
                className="absolute -top-24 -left-12 text-[18rem] md:text-[22rem] font-display text-accent/[0.03] pointer-events-none select-none"
              >
                {f.id}
              </motion.div>
              <div className="border border-border p-12 bg-background relative z-10 hover:bg-accent/[0.02] transition-colors duration-500">
                <h4 className="text-4xl md:text-5xl font-display uppercase mb-8 group-hover:text-accent transition-colors leading-tight text-foreground">
                  {f.title}
                </h4>
                <p className="text-xl text-muted leading-relaxed">
                  {f.desc}
                </p>
                <div className="mt-12 flex items-center gap-2 group cursor-pointer">
                  <span className="text-caption-s uppercase font-bold tracking-widest text-muted group-hover:text-accent transition-colors">Documentation</span>
                  <div className="h-[1px] w-0 bg-accent group-hover:w-12 transition-all duration-500" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Technical Footer */}
        <div className={`w-full px-8 md:px-12 lg:px-24 ${isMobile ? 'mt-32' : 'mt-24'} grid grid-cols-12 gap-8 items-center opacity-50 relative z-10`}>
          <div className="col-span-12 md:col-span-6">
            <p className="text-caption-s uppercase font-mono tracking-tighter text-muted">
              Build v1.0.0-alpha // Architecture: TypeScript (Stellar SDK) // Registry: npm
            </p>
          </div>
          <div className="col-span-12 md:col-span-6 md:text-right">
            <p className="text-caption-s uppercase font-mono tracking-tighter text-muted">
              Validated on Stellar Testnet // Mainnet May 2026 CCTP
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Solution;
