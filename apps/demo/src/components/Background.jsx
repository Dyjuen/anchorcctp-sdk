import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const Background = () => {
  const { scrollYProgress } = useScroll();

  // Soft Crimson Theme
  // Base: Warm Off-White #FDFCFB
  // Glow: Subdued Deep Crimson #550C18
  
  const y = useTransform(scrollYProgress, [0, 1], ["70%", "0%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.4]);
  
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#FDFCFB] pointer-events-none">
      {/* Top Left Soft Crimson Wash */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[100%] h-[100%] rounded-full blur-[180px] opacity-[0.1]"
        style={{
          background: 'radial-gradient(circle, #550C18 0%, transparent 70%)'
        }}
      />

      {/* Main Soft Surge */}
      <motion.div 
        style={{
          y,
          opacity: 0.3,
          scale,
          background: 'radial-gradient(circle at center, #E5E7EB 0%, #FDFCFB 60%, transparent 80%)'
        }}
        className="absolute bottom-[-30%] left-[-10%] w-[130%] h-[130%] rounded-full blur-[150px]"
      />

      {/* Grain / Noise Texture - Multiply for Light Mode */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-multiply pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
};

export default Background;
