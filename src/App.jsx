import React from 'react';
import './styles/globals.css';
import AdvancedHero from './components/AdvancedHero';
import Problem from './components/Problem';
import Solution from './components/Solution';
import Taxonomy from './components/Taxonomy';
import CodeGlimpse from './components/CodeGlimpse';
import Deliverables from './components/Deliverables';
import Background from './components/Background';
import Navbar from './components/Navbar';

function App() {
  return (
    <div className="bg-transparent min-h-screen selection:bg-accent selection:text-white">
      <Background />
      <Navbar />

      <main className="relative">
        {/* Blueprint Grid Lines - Adjusted for Light Mode */}
        <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12 pointer-events-none opacity-10">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-r border-border h-full last:border-r-0" />
          ))}
        </div>
        <AdvancedHero />
        <Problem />
        <Solution />
        <Taxonomy />
        <CodeGlimpse />
        <Deliverables />
      </main>
    </div>
  );
}

export default App;
