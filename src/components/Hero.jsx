import React from 'react';
import { motion } from 'framer-motion';

const Hero = () => {
  const containerVars = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVars = {
    initial: { y: 100, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.23, 1, 0.32, 1], // circ-out
      },
    },
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col justify-end p-8 pt-32 border-b border-border">
      <motion.div 
        variants={containerVars}
        initial="initial"
        animate="animate"
        className="relative z-10 w-full"
      >
        <div className="mb-12">
          <motion.p variants={itemVars} className="text-caption-s text-muted uppercase mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent inline-block" />
            AnchorCCTP SDK / Stellar Instaward
          </motion.p>

          <div className="overflow-hidden">
            <motion.h1
              variants={itemVars}
              className="font-display text-7xl md:text-[10vw] leading-[0.85] uppercase tracking-tight"
            >
              Accepting<br />
              <span className="text-accent italic font-light">Cross-Chain</span><br />
              USDC.
            </motion.h1>
          </div>
        </div>

        <motion.div variants={itemVars} className="flex flex-col md:flex-row justify-between items-end gap-8 pb-12">
          <p className="max-w-xl text-muted text-xl leading-relaxed">
            AnchorCCTP SDK lets any Stellar anchor accept USDC from any CCTP-connected chain with a single function call — abstracting decimal conversion, forwarder contracts, attestation polling, and trustline management.
          </p>
          
          <div className="flex gap-4">
            <a href="https://www.npmjs.com/package/@anchor-cctp/core" target="_blank" rel="noreferrer" className="px-8 py-4 bg-foreground text-background uppercase text-caption-s font-bold hover:bg-accent transition-colors duration-400">
              Get the SDK
            </a>
            <a href="https://anchorcctp.io" target="_blank" rel="noreferrer" className="px-8 py-4 border border-border uppercase text-caption-s font-bold hover:bg-foreground hover:text-background transition-all duration-400">
              Live Demo
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
