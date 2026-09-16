"use client";

import { CinematicFooter } from "@/components/ui/motion-footer";

export default function Demo() {
  return (
    <div className="relative w-full bg-background min-h-screen font-sans selection:bg-white/20 overflow-x-hidden">
      <main className="relative z-10 w-full min-h-[120vh] bg-background flex flex-col items-center justify-center text-white border-b border-white/10 shadow-md rounded-b-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.03)_0%,transparent_60%)] pointer-events-none" />
        
        <h1 className="text-4xl md:text-5xl font-light tracking-[0.2em] text-neutral-400 mb-8 uppercase text-center px-4">
          Scroll down
        </h1>
        
        <div className="w-[1px] h-32 bg-gradient-to-b from-neutral-400 to-transparent" />
      </main>

      <CinematicFooter />
    </div>
  );
}
