import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar({ onOpenMenu, onOpenSignIn }: { onOpenMenu: () => void, onOpenSignIn: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 50);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);

    // Setup Intersection Observer for active section highlighting
    const sections = ['home', 'route', 'warehouses', 'weather', 'dashboard'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            // Optionally update the URL silently so refreshes keep position
            window.history.replaceState(null, '', `#${entry.target.id}`);
          }
        });
      },
      // rootMargin "-40% 0px -60% 0px" means the section only needs to cross the horizontal line slightly above the center of the screen to become active.
      // This prevents tall sections (like Warehouses) from being skipped when they are larger than 100vh.
      { root: scrollContainer, rootMargin: "-40% 0px -50% 0px", threshold: 0 } 
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const navLinks = [
    { name: 'HOME', path: '#home' },
    { name: 'SMART ROUTE', path: '#route' },
    { name: 'WAREHOUSE', path: '#warehouses' },
    { name: 'WEATHER', path: '#weather' },
    { name: 'DASHBOARD', path: '#dashboard' },
  ];

  return (
    <motion.nav 
      initial={false}
      animate={{
        paddingTop: isScrolled ? '1rem' : '2rem',
        paddingBottom: isScrolled ? '1rem' : '2rem',
        backgroundColor: isScrolled ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isScrolled ? 'blur(12px)' : 'blur(0px)'
      }}
      className={clsx(
        "fixed top-0 w-full z-50 px-12 flex items-center justify-between text-white transition-all duration-300",
        isScrolled && "border-b border-white/10 shadow-2xl"
      )}
    >
      <AnimatePresence>
        {!isScrolled && (
          <motion.a 
            href="#home" 
            className="flex flex-col tracking-tight overflow-hidden"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="font-bold text-3xl tracking-widest italic whitespace-nowrap">ROUTESHIELD</span>
            <span className="text-xs tracking-[0.2em] font-bold italic mt-0.5 whitespace-nowrap">AI ROAD INTELLIGENCE</span>
          </motion.a>
        )}
      </AnimatePresence>
      
      <div className={clsx("hidden md:flex items-center space-x-12 font-bold text-sm tracking-wider", isScrolled && "mx-auto")}>
        {navLinks.map((link) => {
          const isActive = activeSection === link.path.substring(1);
          return (
            <a 
              key={link.name} 
              href={link.path}
              className={clsx(
                "relative pb-2 hover:opacity-80 transition-opacity text-white font-bold hidden md:block"
              )}
            >
              {link.name}
              {isActive && (
                <motion.span 
                  layoutId="activeNavLine"
                  className="absolute left-0 bottom-0 w-full h-[4px] bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.9)]" 
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </a>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4 md:gap-6">
        <button 
          onClick={onOpenMenu} 
          className="text-white hover:opacity-80 transition-opacity font-bold tracking-widest text-sm md:hidden"
        >
          MENU
        </button>
        <button 
          onClick={onOpenSignIn}
          className="bg-white text-black px-6 py-2 rounded-full font-bold tracking-widest hover:bg-gray-200 transition-colors text-sm"
        >
          LOGIN
        </button>
      </div>
    </motion.nav>
  );
}
