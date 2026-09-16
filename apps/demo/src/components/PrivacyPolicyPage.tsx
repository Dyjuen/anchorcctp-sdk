import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

interface Props {
  onNavigate: (page: 'home' | 'privacy' | 'terms' | 'support') => void;
}

export const PrivacyPolicyPage: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div className="w-full max-w-[900px] mx-auto px-6 py-20 animate-fade-in relative z-10">
      <button 
        onClick={() => onNavigate('home')}
        className="group flex items-center gap-3 text-slate-400 hover:text-white transition-colors mb-12 font-mono text-sm uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Kembali ke Beranda
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-[#3E6BFF]/10 text-[#3E6BFF] rounded-xl border border-[#3E6BFF]/20">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Kebijakan Privasi</h1>
      </div>

      <div className="prose prose-invert prose-slate max-w-none font-medium leading-relaxed">
        <p className="text-xl text-slate-300 mb-10">
          Di AnchorCCTP, privasi dan keamanan data pengguna adalah fondasi dari infrastruktur kami. Dokumen ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda.
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">1. Pengumpulan Data</h2>
        <p className="text-slate-400 mb-6">
          Karena sifat terdesentralisasi dari protokol kami, kami hanya memproses data yang diperlukan secara kriptografis untuk memfasilitasi transaksi lintas rantai. Ini termasuk alamat publik, hash transaksi, dan metadata CCTP. Kami tidak mengumpulkan informasi pribadi (PII) tanpa persetujuan eksplisit.
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">2. Penggunaan Data</h2>
        <p className="text-slate-400 mb-6">
          Data on-chain diproses semata-mata untuk tujuan:
        </p>
        <ul className="list-disc pl-6 text-slate-400 space-y-3 mb-8">
          <li>Memverifikasi atestasi Circle Iris API.</li>
          <li>Menjalankan fungsi pencetakan pada Soroban Forwarder Contract.</li>
          <li>Mencegah serangan replay dan duplikasi transaksi.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">3. Transparansi Blockchain</h2>
        <p className="text-slate-400 mb-6">
          Mohon dipahami bahwa semua transaksi yang diselesaikan melalui jaringan Stellar dan asal (Ethereum, Solana, dll) bersifat publik dan permanen di buku besar blockchain.
        </p>
      </div>
    </div>
  );
};
