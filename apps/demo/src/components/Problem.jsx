import React from 'react';
import { motion } from 'framer-motion';

const Problem = () => {
  const problems = [
    {
      id: '01',
      title: 'No CCTP Abstraction',
      desc: 'CCTP is live on Stellar since May 2026, but every anchor must rebuild the same integration logic from scratch — attestation polling, forwarders, decimal math.',
    },
    {
      id: '02',
      title: 'Decimal & Address Friction',
      desc: "Stellar's 7-decimal USDC vs CCTP's 6-decimal format leaves remainder dust. G... addresses need the forwarder contract. Domain IDs must be mapped per chain.",
    },
    {
      id: '03',
      title: 'Weeks of Custom Work',
      desc: '37 live anchors cannot accept USDC from Ethereum, Solana, Base, or 20+ other chains without weeks of bespoke engineering per anchor.',
    },
  ];

  return (
    <section className="text-foreground py-24 px-8 border-b border-border relative overflow-hidden">
      {/* Decorative vertical line */}
      <div className="absolute left-1/2 top-0 w-[1px] h-full bg-border -translate-x-1/2 opacity-30 hidden md:block" />

      <div className="w-full px-8 md:px-12 lg:px-24 relative z-10">
        <header className="mb-20 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-6">
            <h2 className="text-caption-s text-accent uppercase tracking-widest mb-4 flex items-center gap-2 font-bold">
              / Section 01 / The Problem
            </h2>
            <h3 className="text-heading-l uppercase font-display leading-tight max-w-xl">
              Stellar anchors are <span className="text-muted/50 underline decoration-accent/50 underline-offset-8">cut off</span> from 23+ chains.
            </h3>
          </div>
          <div className="col-span-12 md:col-span-6 flex items-end">
            <p className="text-muted text-lg border-l border-accent pl-6 py-2">
              The absence of an anchor-specific CCTP integration kit is a structural gap in the Stellar anchor toolchain.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-y-12 md:gap-x-12">
          {problems.map((p, index) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="col-span-12 md:col-span-4 group"
            >
              <div className="border border-border p-8 h-full hover:border-accent transition-colors duration-500 flex flex-col justify-between relative bg-background">
                {/* ID Number */}
                <span className="text-caption-s text-accent font-bold absolute top-4 right-4">{p.id}</span>
                
                <div>
                  <h4 className="text-xl font-display uppercase mb-4 group-hover:text-accent transition-colors duration-300">{p.title}</h4>
                  <p className="text-muted text-sm leading-relaxed">
                    {p.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-border group-hover:border-accent/30 transition-colors">
                  <div className="w-8 h-1 bg-border group-hover:bg-accent transition-all duration-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Highlight Quote */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 pt-12 border-t border-border grid grid-cols-12"
        >
          <p className="col-span-12 md:col-span-8 text-caption-s text-muted uppercase tracking-[0.2em]">
            "Anchors have no standardized way to accept USDC deposits from non-Stellar chains. No existing SDK abstracts this."
          </p>
          <div className="col-span-12 md:col-span-4 flex justify-end">
            <span className="text-[10px] uppercase font-mono text-muted/40 tracking-widest">Case_Study // CCTP-01</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Problem;
