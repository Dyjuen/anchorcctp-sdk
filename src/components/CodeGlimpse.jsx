import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const HUDMarker = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[7px] uppercase tracking-[0.2em] text-muted/40 font-mono">{label}</span>
    <span className="text-[9px] uppercase tracking-widest text-foreground/60 font-mono">{value}</span>
  </div>
);

const CodeGlimpse = () => {
  const containerRef = useRef(null);

  // Mouse tilt logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const parameters = [
    { label: "Attestation Poll", value: "5-15 MIN", status: "RETRY_BACKOFF", progress: 85, color: "bg-accent" },
    { label: "Decimal Ratio", value: "7 ↔ 6", status: "DUST_HANDLED", progress: 92, color: "bg-accent" },
    { label: "Domain Mapping", value: "STELLAR 27", status: "23+ CHAINS", progress: 35, color: "bg-foreground" },
    { label: "Forwarder Call", value: "EVM → G...", status: "ADDR_TRANSLATED", progress: 60, color: "bg-accent" },
  ];

  return (
    <section className="text-foreground py-32 border-b border-border relative overflow-hidden bg-white/[0.01]">
      <div className="w-full px-8 md:px-12 lg:px-24 grid grid-cols-12 gap-8 lg:gap-16 items-center">
        <div className="col-span-12 lg:col-span-5 pr-8">
          <h2 className="text-caption-s text-accent uppercase tracking-[0.3em] font-bold mb-6 flex items-center gap-3">
            <span className="w-8 h-[1px] bg-accent" /> / Section 04 / The Engine
          </h2>
          <h3 className="text-display-xl uppercase font-display leading-tight mb-8">
            Engineered<br />
            <span className="italic text-muted/30">Receipt.</span>
          </h3>
          <p className="text-lg text-muted leading-relaxed mb-8">
            The AnchorCCTP core is a surgical instrument for cross-chain settlement. It watches the
            Circle Attestation API, translates addresses and decimals, and settles USDC into your
            anchor's pipeline before mainnet load ever shows up.
          </p>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <HUDMarker label="Core Runtime" value="TypeScript" />
            <HUDMarker label="Coverage" value="90%+ Tests" />
            <HUDMarker label="Architecture" value="Stellar SDK" />
            <HUDMarker label="Safety" value="Typed Events" />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 perspective-1000">
          <motion.div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d"
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-background border border-border p-1 md:p-1 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group"
          >
            {/* Inner Dashboard Border */}
            <div className="border border-border/40 p-6 md:p-12 relative overflow-hidden">
              
              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] opacity-20" />

              {/* HUD Header */}
              <div className="flex items-start justify-between mb-16 relative z-10">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-accent animate-ping" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-foreground">AnchorCCTP Receive Unit</span>
                  </div>
                  <div className="flex gap-4 opacity-40 italic">
                    <span className="text-[8px] font-mono uppercase tracking-widest">Sys_Id: CCTP-27-X</span>
                    <span className="text-[8px] font-mono uppercase tracking-widest">Poll: ATT-API</span>
                  </div>
                </div>
                
                <div className="hidden md:flex flex-col items-end gap-1 font-mono text-[8px] text-muted opacity-30">
                  <span>0x63 0x63 0x74 0x70</span>
                  <span>0x5f 0x73 0x74 0x65</span>
                  <span>0x6c 0x6c 0x61 0x72</span>
                </div>
              </div>

              {/* Simulation Grid */}
              <div className="grid grid-cols-12 gap-12 relative z-10">
                <div className="col-span-12 lg:col-span-8 space-y-12">
                  {parameters.map((param, i) => (
                    <div key={i} className="group/item">
                      <div className="flex justify-between items-end mb-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] uppercase tracking-[0.3em] text-muted font-bold group-hover/item:text-accent transition-colors">
                            {param.label} / 0{i+1}
                          </span>
                          <span className="text-3xl font-display uppercase text-foreground leading-none">
                            {param.value}
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <div className="flex gap-1 h-1">
                            {[...Array(5)].map((_, idx) => (
                              <div key={idx} className={`w-3 h-full ${idx < (i + 2) ? 'bg-accent' : 'bg-border/20'}`} />
                            ))}
                          </div>
                          <span className="text-[8px] font-mono text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 border border-accent/20">
                            {param.status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Segmented Progress Bar */}
                      <div className="flex gap-1">
                        {[...Array(20)].map((_, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: idx < (param.progress / 5) ? 1 : 0.1 }}
                            transition={{ delay: (idx * 0.05) + (i * 0.1) }}
                            className={`h-1 flex-1 ${idx < (param.progress / 5) ? param.color : 'bg-border'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Internal HUD Sidebar */}
                <div className="hidden lg:col-span-4 lg:flex flex-col justify-between border-l border-border/20 pl-12 py-2">
                  <div className="space-y-8">
                    <div className="flex flex-col gap-3">
                      <span className="text-[8px] uppercase tracking-[0.4em] text-muted font-bold">Attestation_Status</span>
                      <div className="w-full h-24 border border-border/30 bg-accent/[0.02] relative overflow-hidden">
                        <motion.div
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent"
                        />
                        <div className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-accent/40 rotate-90 tracking-[1em]">
                          POLLING
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <span className="text-[8px] uppercase tracking-[0.4em] text-muted font-bold">Log_Stream</span>
                      <div className="font-mono text-[7px] text-muted/40 space-y-1">
                        <p>&gt; BURN_DETECTED: ETH</p>
                        <p>&gt; ATT_POLL: 3/10</p>
                        <p>&gt; FORWARDER_CALLED</p>
                        <p>&gt; DUST_ROUTED: 0.0000042</p>
                        <p className="text-accent/60">&gt; ALRT: TRUSTLINE_ABSENT</p>
                        <p>&gt; SETTLED [OK]</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-12 border-t border-border/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-accent/30 flex items-center justify-center">
                        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      </div>
                      <span className="text-[7px] uppercase tracking-[0.3em] text-muted font-bold">Relay Ready</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Corner Elements */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-accent opacity-40" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-accent opacity-40" />
            </div>

            {/* Background Branding */}
            <div style={{ transform: "translateZ(80px)" }} className="absolute -bottom-10 -left-10 text-[180px] font-display opacity-[0.02] pointer-events-none select-none leading-none tracking-tighter">
              99
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CodeGlimpse;