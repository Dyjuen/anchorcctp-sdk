import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-gray-200 bg-white py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500 space-y-2">
        <p>
          AnchorCCTP SDK • Developed for Stellar Community Fund & Circle CCTP Interoperability
        </p>
        <p className="font-mono text-gray-400">
          Apache-2.0 / MIT Open Source • Built by Mother's Grace
        </p>
      </div>
    </footer>
  );
};
