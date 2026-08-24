import React from 'react';
import { motion } from 'framer-motion';

const Navbar = () => {
  const links = [
    { name: 'CLI', href: '#taxonomy' },
    { name: 'Flow', href: '#solution' },
  ];

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id.replace('#', ''));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 md:px-12 py-8 bg-transparent">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-bold text-2xl tracking-tighter uppercase text-foreground cursor-pointer"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        AnchorCCTP<span className="text-accent">.</span>
      </motion.div>

      <div className="flex items-center gap-8">
        <div className="hidden lg:flex items-center gap-8">
          {links.map((link, i) => (
            <motion.a
              key={link.name}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-caption-s uppercase tracking-widest text-muted hover:text-foreground transition-colors relative group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all duration-500 group-hover:w-full" />
            </motion.a>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-border mx-2 hidden md:block" />

        <div className="flex items-center gap-6">
          <motion.a 
            href="#" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-caption-s uppercase tracking-widest text-foreground hover:text-accent transition-colors"
          >
            Join
          </motion.a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
