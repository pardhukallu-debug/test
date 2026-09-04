import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RoutePlanner from './pages/RoutePlanner';
import Warehouses from './pages/Warehouses';
import Weather from './pages/Weather';
import CommandCenter from './pages/CommandCenter';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

function MainScrollContainer() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.substring(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location]);

  const TopFade = () => <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-slate-900 via-slate-900/60 to-transparent pointer-events-none z-[100]" />;
  const BottomFade = () => <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none z-[100]" />;

  return (
    <div 
      id="main-scroll"
      className="h-screen w-full overflow-y-auto scroll-smooth"
    >
      <div id="home" className="min-h-screen w-full relative">
        <Home />
        <BottomFade />
      </div>
      
      <div id="route" className="min-h-screen w-full relative">
        <TopFade />
        <RoutePlanner />
        <BottomFade />
      </div>
      
      <div id="warehouses" className="min-h-screen w-full relative">
        <TopFade />
        <Warehouses />
        <BottomFade />
      </div>
      
      <div id="weather" className="min-h-screen w-full relative">
        <TopFade />
        <Weather />
        <BottomFade />
      </div>
      
      <div id="dashboard" className="min-h-screen w-full relative">
        <TopFade />
        <CommandCenter />
      </div>
    </div>
  );
}

function App() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-900 text-white">
      <Navbar onOpenSignIn={() => setShowSignIn(true)} onOpenMenu={() => setShowMenu(true)} />
      
      <Routes>
        <Route path="/" element={<MainScrollContainer />} />
        <Route path="/route" element={<MainScrollContainer />} />
        <Route path="/warehouses" element={<MainScrollContainer />} />
        <Route path="/weather" element={<MainScrollContainer />} />
      </Routes>

      {/* Sign In Modal */}
      <AnimatePresence>
        {showSignIn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignIn(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-md bg-[#e8ecec]/95 backdrop-blur-md p-10 rounded-3xl border-[3px] border-black shadow-2xl text-black"
            >
              <button onClick={() => setShowSignIn(false)} className="absolute top-4 right-4 hover:opacity-70"><X size={24} /></button>
              <h2 className="text-3xl font-black uppercase tracking-widest mb-2">Login</h2>
              <p className="text-sm font-bold text-gray-600 mb-8 uppercase tracking-wider">Access Your Logistics Dashboard</p>
              
              <div className="space-y-4">
                <input type="email" placeholder="Work Email" className="w-full bg-white border border-black/20 rounded-xl px-4 py-3 mb-4 outline-none focus:border-blue-500 transition-colors" />
                <input type="password" placeholder="Password" className="w-full bg-white border border-black/20 rounded-xl px-4 py-3 mb-6 outline-none focus:border-blue-500 transition-colors" />
                <button className="w-full bg-black hover:bg-gray-800 text-white font-bold tracking-widest py-3 rounded-xl transition-colors uppercase">
                  Login to Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenu && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-10 w-full max-w-sm h-full bg-[#e8ecec]/95 backdrop-blur-md p-10 border-l-[3px] border-black shadow-2xl text-black flex flex-col"
            >
              <button onClick={() => setShowMenu(false)} className="absolute top-6 right-6 hover:opacity-70"><X size={24} /></button>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-10">Menu</h2>
              
              <div className="flex flex-col gap-6 text-lg font-bold tracking-wider uppercase">
                <a href="#home" onClick={() => setShowMenu(false)} className="hover:text-blue-600 transition-colors">Home</a>
                <a href="#route" onClick={() => setShowMenu(false)} className="hover:text-blue-600 transition-colors">Smart Route Planner</a>
                <a href="#warehouses" onClick={() => setShowMenu(false)} className="hover:text-blue-600 transition-colors">Logistics Network</a>
                <a href="#weather" onClick={() => setShowMenu(false)} className="hover:text-blue-600 transition-colors">Weather Systems</a>
                <div className="w-full h-px bg-black/20 my-4"></div>
                <a href="#" className="hover:text-emerald-600 transition-colors">API Documentation</a>
                <a href="#" className="hover:text-emerald-600 transition-colors">Contact Support</a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
