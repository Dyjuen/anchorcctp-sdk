import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal, Cpu } from 'lucide-react';

interface HeroSectionProps {
  onExploreDemo: () => void;
  onExploreDocs: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreDemo,
  onExploreDocs,
}) => {

  return (
    <section className="relative pt-8 pb-16 overflow-hidden border-b border-slate-800/80 w-full">
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="lg:col-span-7 space-y-6 text-left"
          >

            {/* Main Title */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
              Cross-Chain USDC <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3E6BFF] via-[#60A5FA] to-[#06B6D4]">
                Settlement
              </span> <br />
              for Stellar Anchors.
            </h1>

            {/* Description */}
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
              Accept 1:1 USDC deposits from <strong className="text-white">26+ Circle CCTP domains</strong> directly on Stellar. Verified via Circle Iris attestation, executed on Soroban, with automatic 6-to-7 decimal Stroop conversion.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExploreDemo}
                className="px-7 py-4 rounded-full font-extrabold text-sm bg-[#3E6BFF] hover:bg-[#345CE0] text-white shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>View catalog & demo</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExploreDocs}
                className="px-7 py-4 rounded-full font-extrabold text-sm bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-slate-400" />
                <span>SDK Documentation</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Right Column: Clean SVG Visual enlarged 2.5x */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-5 flex justify-center items-center relative overflow-visible"
          >
            <div className="relative w-full flex items-center justify-center group shrink-0 py-4">
              <img
                src="/assets/img/final.svg"
                alt="Anchor CCTP Logo"
                className="w-[420px] h-[420px] sm:w-[540px] sm:h-[540px] lg:w-[650px] lg:h-[650px] object-contain drop-shadow-[0_20px_50px_rgba(62,107,255,0.2)] transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
