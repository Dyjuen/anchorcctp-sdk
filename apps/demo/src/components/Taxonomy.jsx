import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Taxonomy = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const domains = [
    {
      id: '01',
      title: 'anchor-cctp init',
      tags: ['stellar.toml', 'CCTP config', 'SEP-CCTP'],
      desc: 'Generate a stellar.toml CCTP config block in seconds. Drop-in CCTP deposit advertising anchors would otherwise write from scratch.'
    },
    {
      id: '02',
      title: 'anchor-cctp listen',
      tags: ['Streaming', 'JSON events', 'Chain source'],
      desc: 'Poll for inbound CCTP transfers to a Stellar address. Logs each event with chain source, amount, and settlement status — all JSON.'
    },
    {
      id: '03',
      title: 'anchor-cctp verify',
      tags: ['txHash', 'Attestation', 'Mint status'],
      desc: 'Check whether a CCTP burn transaction has been minted on Stellar and return the attestation.'
    },
    {
      id: '04',
      title: 'anchor-cctp domains',
      tags: ['23+ chains', 'Domain IDs', 'Mapping'],
      desc: 'List all supported CCTP domains with chain names and domain IDs — Ethereum, Solana, Base, Arbitrum and beyond.'
    }
  ];

  return (
    <section className="bg-transparent py-32 border-b border-border relative overflow-hidden">
      <div className="w-full px-8 md:px-12 lg:px-24">
        <h2 className="text-caption-s text-accent uppercase tracking-[0.3em] font-bold mb-16 flex items-center gap-3">
          <span className="w-8 h-[1px] bg-accent" /> / Section 03 / The CLI Commands
        </h2>

        <div className="flex flex-col border-t border-border">
          {domains.map((d, index) => (
            <div 
              key={d.id}
              onMouseEnter={() => setActiveIndex(index)}
              className="border-b border-border group cursor-pointer relative"
            >
              <div className="grid grid-cols-12 gap-8 py-12 px-4 transition-all duration-700 group-hover:bg-accent/[0.01]">
                {/* Left Side: ID + Title */}
                <div className="col-span-12 md:col-span-7 flex items-center gap-12">
                  <span className={`font-mono text-xl transition-colors duration-500 ${activeIndex === index ? 'text-accent' : 'text-muted/60'}`}>
                    {d.id}
                  </span>
                  <h3 className={`text-4xl md:text-7xl font-display uppercase tracking-tighter transition-all duration-700 ${activeIndex === index ? 'translate-x-4 text-foreground' : 'text-muted/40'}`}>
                    {d.title}
                  </h3>
                </div>

                {/* Right Side: Tags (always visible or hover) */}
                <div className="col-span-12 md:col-span-5 flex items-center md:justify-end gap-3 flex-wrap">
                  {d.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 border border-border text-[9px] uppercase font-mono tracking-widest text-muted whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pb-12 px-4 md:px-0 grid grid-cols-12 gap-8">
                      {/* Spacer to align with title */}
                      <div className="hidden md:block md:col-span-1" />
                      <div className="col-span-12 md:col-span-6 pl-12 md:pl-20">
                        <p className="text-lg text-muted leading-relaxed">
                          {d.desc}
                        </p>
                      </div>
                      <div className="col-span-12 md:col-span-5 flex flex-col justify-end items-end opacity-20">
                        <span className="text-[10px] uppercase font-mono tracking-[0.5em]">JSON_OUT_READY</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hover Line */}
              <motion.div 
                className="absolute bottom-0 left-0 h-[1px] bg-accent w-0"
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.5 }}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Dynamic Background Visual */}
      <div className="absolute top-1/2 right-[-10%] -translate-y-1/2 pointer-events-none select-none opacity-[0.03]">
        <h4 className="text-[30vw] font-display uppercase leading-none text-accent">
          {domains[activeIndex].id}
        </h4>
      </div>
    </section>
  );
};

export default Taxonomy;
