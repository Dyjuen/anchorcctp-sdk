import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(2); // Default to middle element

  const faqs = [
    {
      question: 'Apa itu AnchorCCTP?',
      answer: 'AnchorCCTP adalah TypeScript SDK open-source untuk menerima deposit USDC cross-chain 1:1 dari 26+ blockchain Circle CCTP langsung ke ekosistem Stellar tanpa batas.'
    },
    {
      question: 'Desimal 6 ke 7 Stroop',
      answer: 'Circle CCTP menggunakan 6 desimal untuk USDC, sedangkan Stellar menggunakan 7 desimal (Stroop). AnchorCCTP melakukan skala matematis otomatis presisi tinggi tanpa kerugian.'
    },
    {
      question: '26+ Domain Circle CCTP',
      answer: 'Mendukung semua domain mainnet Circle CCTP, termasuk Ethereum, Solana, Arbitrum, Optimism, Polygon, Base, Avalanche, dan tentunya Stellar (Domain 27).'
    },
    {
      question: 'Soroban Forwarder',
      answer: 'Bertindak sebagai proxy minting di Stellar yang memverifikasi tanda tangan atestasi Circle Iris dan membuat trustline USDC tujuan secara otomatis (dibatasi 2 XLM).'
    },
    {
      question: 'Status Pesanan Deposit',
      answer: 'Setiap transaksi memiliki hash burn yang divalidasi dan disimpan di idempotency store. Anda dapat memantaunya langsung secara on-chain real-time.'
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 relative bg-[#03060c] w-full border-t border-slate-800/60 font-sans overflow-hidden">
      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-16 space-y-16">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-4 text-left max-w-3xl"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500">
            // PERTANYAAN UMUM
          </p>
          <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
            Ada pertanyaan?
          </h2>
        </motion.div>

        {/* Responsive Horizontal/Vertical Accordion (Naleka Style) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 lg:mt-16"
        >
          <div className="flex flex-col lg:flex-row w-full h-auto lg:h-[600px] border border-slate-800/80 rounded-[2rem] overflow-hidden bg-[#070C18]">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <motion.div
                  key={idx}
                  layout
                  onClick={() => toggleFaq(idx)}
                  className={`group relative flex flex-col transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800 last:border-0 ${
                    isOpen ? 'lg:flex-[3] bg-slate-900/50 h-[500px] lg:h-full' : 'lg:flex-[0.5] hover:bg-slate-800/30 h-[80px] lg:h-full'
                  }`}
                >
                  {/* Desktop Closed State (Vertical Text) */}
                  <div className={`hidden lg:flex w-full h-full flex-col items-center justify-between py-10 absolute inset-0 transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex-1 flex items-center justify-center">
                      <h3 
                        className="text-lg font-bold text-slate-400 whitespace-nowrap tracking-wide group-hover:text-white transition-colors"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {faq.question}
                      </h3>
                    </div>
                    <div className="text-slate-500 group-hover:text-[#3E6BFF] transition-colors">
                      <Plus className="w-6 h-6" strokeWidth={2} />
                    </div>
                  </div>

                  {/* Mobile Closed State (Horizontal Text) */}
                  <div className={`lg:hidden w-full h-full flex items-center justify-between px-6 absolute inset-0 transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <h3 className="text-base font-bold text-slate-400 group-hover:text-white transition-colors">
                      {faq.question}
                    </h3>
                    <Plus className="w-5 h-5 text-slate-500" />
                  </div>

                  {/* Opened State Content */}
                  <div className={`w-full h-full flex flex-col justify-between p-8 md:p-12 relative z-10 transition-opacity duration-700 delay-100 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    
                    {/* Top Content: Question & Answer */}
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                      <div className="max-w-2xl">
                        <h3 className="text-3xl md:text-5xl font-black text-white leading-[1.1] tracking-tight">
                          {faq.question}
                        </h3>
                        <p className="mt-6 text-lg md:text-xl text-slate-400 font-medium leading-relaxed max-w-xl">
                          {faq.answer}
                        </p>
                      </div>
                      
                      {/* Close Button */}
                      <button className="hidden lg:flex items-center gap-3 text-rose-500 text-xs font-bold tracking-widest uppercase hover:text-white transition-colors">
                        TUTUP <Minus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom Content: Logo Visual (1.5x Larger) */}
                    <div className="self-center lg:self-end mt-12 lg:mt-auto relative w-full lg:w-auto flex justify-center lg:justify-end">
                      <div className="absolute inset-0 bg-[#3E6BFF]/20 blur-[100px] rounded-full pointer-events-none" />
                      <div className="relative flex items-center justify-center w-72 h-72 lg:w-[30rem] lg:h-[30rem]">
                        <img 
                          src="/assets/img/final.svg" 
                          alt="Logo" 
                          className="w-64 h-64 lg:w-[26rem] lg:h-[26rem] object-contain drop-shadow-[0_0_40px_rgba(62,107,255,0.5)] relative z-10 hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
