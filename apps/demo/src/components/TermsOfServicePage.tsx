import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface Props {
  onNavigate: (page: 'home' | 'privacy' | 'terms' | 'support') => void;
}

export const TermsOfServicePage: React.FC<Props> = ({ onNavigate }) => {
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
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Syarat & Ketentuan</h1>
      </div>

      <div className="prose prose-invert prose-slate max-w-none font-medium leading-relaxed">
        <p className="text-xl text-slate-300 mb-10">
          Dengan menggunakan perangkat lunak AnchorCCTP SDK, Anda menyetujui persyaratan penggunaan open-source kami.
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">1. Lisensi Open Source</h2>
        <p className="text-slate-400 mb-6">
          Perangkat lunak ini dirilis di bawah Lisensi MIT. Anda bebas menggunakan, memodifikasi, dan mendistribusikan kode sumber asalkan Anda menyertakan pemberitahuan hak cipta asli. Perangkat lunak ini disediakan "sebagaimana adanya", tanpa jaminan tersurat maupun tersirat.
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">2. Batasan Tanggung Jawab</h2>
        <p className="text-slate-400 mb-6">
          Penyedia AnchorCCTP tidak bertanggung jawab atas kerugian langsung, tidak langsung, insidental, khusus, atau konsekuensial yang timbul dari penggunaan atau ketidakmampuan menggunakan SDK ini, termasuk namun tidak terbatas pada kehilangan dana akibat interaksi smart contract.
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-6">3. Kepatuhan Hukum (Compliance)</h2>
        <p className="text-slate-400 mb-6">
          Sebagai entitas yang mengoperasikan Anchor di jaringan Stellar, Anda sepenuhnya bertanggung jawab untuk mematuhi semua regulasi KYC, AML, dan lisensi keuangan yang berlaku di yurisdiksi Anda. AnchorCCTP hanyalah alat teknis (infrastruktur perangkat lunak) dan bukan penyedia layanan keuangan.
        </p>
      </div>
    </div>
  );
};
