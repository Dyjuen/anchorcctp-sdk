import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is AnchorCCTP and SEP-CCTP?',
      answer:
        'AnchorCCTP is an open-source TypeScript SDK and CLI suite developed for Stellar Anchors to accept native 1:1 cross-chain USDC deposits from 26+ Circle CCTP connected blockchains directly onto Stellar. SEP-CCTP defines the standardized metadata extension for stellar.toml.',
    },
    {
      question: 'How does the 6-to-7 decimal precision scaling work?',
      answer:
        'Circle CCTP on EVM and SVM networks uses 6 decimal places for USDC, whereas Stellar asset precision uses 7 decimal places (Stroop units). AnchorCCTP scales raw units mathematically (base units * 10) without floating-point precision loss.',
    },
    {
      question: 'Which Circle CCTP source domain IDs are supported?',
      answer:
        'AnchorCCTP supports all 26 registered Circle CCTP mainnet and testnet domains, including Ethereum (0), Solana (5), Arbitrum (3), Optimism (2), Polygon (7), Base (6), Avalanche (1), and Stellar (27).',
    },
    {
      question: 'What is the role of the Soroban Forwarder Contract?',
      answer:
        'The Soroban Forwarder contract acts as a delegated minting proxy on Stellar. It verifies Circle Iris attestation signatures, checks idempotency replay protection, creates destination USDC trustlines if missing (capped at 2 XLM reserve), and mints USDC.',
    },
    {
      question: 'How does idempotency and replay protection operate?',
      answer:
        'Every incoming deposit tracks the source chain burn transaction hash in a persistent store before balance allocation. Duplicate submissions of already-processed burn transactions return a typed REPLAY_TRANSFER error.',
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 relative border-t border-slate-800/80 bg-slate-950/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-[#3E6BFF]/15 border border-[#3E6BFF]/30 text-[#3E6BFF] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#3E6BFF]" />
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
            Protocol & SDK FAQ
          </h2>
          <p className="text-slate-300 text-sm font-medium">
            Everything you need to know about SEP-CCTP integration.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="arch-card rounded-2xl overflow-hidden transition-all duration-200 bg-slate-900/80 border border-slate-800"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-extrabold text-white text-sm sm:text-base hover:text-[#3E6BFF] transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ml-4 ${
                      isOpen ? 'rotate-180 text-[#3E6BFF]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed font-medium border-t border-slate-800/80 pt-4 bg-slate-950/40">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
