import React from 'react';
import { motion } from 'framer-motion';
import { Package, GitBranch, FileCode, CheckCircle2, Cpu, ShieldCheck, Zap } from 'lucide-react';

const Deliverables = () => {
  const assets = [
    {
      icon: <Cpu className="w-8 h-8" />,
      title: "Core SDK",
      platform: "TypeScript / npm",
      desc: "@anchor-cctp/core. A single receive() call handling attestation polling, 6→7 decimal conversion with dust handling, forwarder interaction, and trustline management. 90%+ test coverage.",
      link: "https://www.npmjs.com/package/@anchor-cctp/core"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "CLI Tool",
      platform: "Node.js / npm",
      desc: "@anchor-cctp/cli. Commands: init (stellar.toml CCTP config), listen (stream inbound transfers), verify (attestation check), domains (23+ chain mapping). All output JSON.",
      link: "https://www.npmjs.com/package/@anchor-cctp/cli"
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Demo Anchor + SEP-CCTP",
      platform: "Mainnet / Freighter",
      desc: "Live mainnet demo anchor with stellar.toml advertising CCTP_DIRECT, full Freighter wallet integration, and a SEP-style spec proposed as a PR to stellar/stellar-protocol.",
      link: "https://anchorcctp.io"
    }
  ];

  return (
    <section className="text-foreground py-32 border-b border-border">
      <div className="w-full px-8 md:px-12 lg:px-24">
        <header className="mb-24">
          <h2 className="text-caption-s text-accent uppercase tracking-[0.3em] font-bold mb-6 flex items-center gap-3">
            <span className="w-8 h-[1px] bg-accent" /> / Section 05 / Core Deliverables
          </h2>
          <h3 className="text-display-xl uppercase leading-[0.85] mb-8">
            Deliverables<br />
            <span className="italic text-muted/50">30 Days.</span>
          </h3>
          <p className="max-w-2xl text-xl text-muted leading-relaxed">
            SDK, CLI, and a mainnet demo proving production readiness. Built for the
            Stellar Instaward program — one integration, every CCTP chain.
          </p>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {assets.map((item, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.8 }}
              className="col-span-12 md:col-span-4 border border-border p-10 hover:bg-white/[0.03] transition-all duration-700 group relative overflow-hidden"
            >
              <div className="text-accent mb-12 group-hover:scale-110 transition-transform duration-700 relative z-10">
                {item.icon}
              </div>
              
              <div className="mb-8 relative z-10">
                <span className="text-caption-s text-muted uppercase tracking-widest block mb-2 font-mono">{item.platform}</span>
                <h4 className="text-3xl font-display uppercase leading-tight group-hover:text-accent transition-colors">{item.title}</h4>
              </div>

              <p className="text-muted leading-relaxed mb-12 min-h-[100px] relative z-10">
                {item.desc}
              </p>

              <a href={item.link} target="_blank" rel="noreferrer" className="w-full py-4 border border-border uppercase text-caption-s font-bold tracking-widest hover:bg-white hover:text-black transition-all duration-500 flex items-center justify-center gap-2 relative z-10 group/btn">
                <span>View Package</span>
                <CheckCircle2 className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </a>

              {/* Background Accent */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </motion.div>
          ))}
        </div>

        {/* Technical Summary Footer */}
        <div className="mt-24 p-12 border border-border border-dashed flex flex-col md:flex-row items-center justify-between gap-12 opacity-60">
          <div className="flex flex-col gap-2 max-w-sm">
            <p className="text-caption-s uppercase tracking-widest font-bold">Cross-Chain Settlement</p>
            <p className="text-sm text-muted">
              One integration for every CCTP-connected chain. Verifiable evidence for mainnet readiness.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="text-center">
              <p className="text-3xl font-display">23+</p>
              <p className="text-[10px] uppercase text-muted tracking-tighter">CCTP Chains</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-display">1</p>
              <p className="text-[10px] uppercase text-muted tracking-tighter">Call To Settle</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Deliverables;
