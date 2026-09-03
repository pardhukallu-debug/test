import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative h-screen w-full flex items-center">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ 
          backgroundImage: 'url("/hero-bg.jpg")',
        }}
      >
        {/* Very subtle gradient overlay from the left to pop the text slightly without obscuring the image */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent"></div>
      </div>

      {/* Hero Content */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative z-10 px-12 md:px-20 mt-10 max-w-5xl flex flex-col"
      >
        <h1 className="text-[4rem] md:text-[5rem] lg:text-[5.5rem] font-black text-white italic leading-[1.05] tracking-tight drop-shadow-2xl uppercase">
          Smarter Routes<br/>Safer Journeys
        </h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.6 }}
          className="text-white text-xl md:text-2xl font-bold italic mt-4 tracking-wider max-w-2xl drop-shadow-xl uppercase"
        >
          AI-POWERED ROAD INTELLIGENCE<br/>FOR NORTHEAST INDIA
        </motion.p>

        {/* CTAs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.9 }}
          className="mt-12 flex flex-col sm:flex-row gap-6"
        >
          <a 
            href="#route"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-black tracking-widest uppercase text-sm md:text-base flex items-center justify-center gap-3 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)] border-2 border-blue-500"
          >
            Plan a Safe Route <ArrowRight size={20} />
          </a>
          <a 
            href="#dashboard"
            className="bg-black/40 hover:bg-black/60 backdrop-blur-md border-[2px] border-white text-white px-8 py-4 rounded-full font-black tracking-widest uppercase text-sm md:text-base flex items-center justify-center transition-colors shadow-lg"
          >
            Explore Features
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
