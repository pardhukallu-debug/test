import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldAlert, TrendingUp, Radio, AlertTriangle, CheckCircle2, BarChart3, PieChart } from 'lucide-react';

export default function CommandCenter() {
  const [activeFleets, setActiveFleets] = useState(1248);
  const [hazardsAvoided, setHazardsAvoided] = useState(342);
  const [latency, setLatency] = useState(42);
  const [throughput, setThroughput] = useState(1.23);
  
  const initialAlerts = [
    { id: 1, time: "2 mins ago", msg: "Landslide risk elevated on NH-27 (Silchar route). Traffic rerouted.", type: "critical" },
    { id: 2, time: "14 mins ago", msg: "Heavy rainfall detected near Jorabat node. Decreasing speed limits.", type: "warning" },
    { id: 3, time: "1 hr ago", msg: "Fleet #402 successfully bypassed flooded sector in Nagaon.", type: "success" },
  ];
  
  const [liveAlerts, setLiveAlerts] = useState(initialAlerts);

  useEffect(() => {
    const simInterval = setInterval(() => {
      // 1. Tick up stats
      if (Math.random() > 0.4) {
        setActiveFleets(prev => prev + Math.floor(Math.random() * 4));
      }
      if (Math.random() > 0.8) {
        setHazardsAvoided(prev => prev + 1);
      }
      
      // 2. Fluctuate server telemetry
      setLatency(Math.floor(Math.random() * 15) + 35); // 35 to 50ms
      setThroughput(Number((Math.random() * 0.4 + 1.1).toFixed(2))); // 1.10 to 1.50
      
      // 3. Generate new alerts occasionally
      if (Math.random() > 0.8) {
        const possibleAlerts = [
          { msg: "Sudden heavy rainfall reported on NH-37. Speed limits reduced.", type: "warning" },
          { msg: "Landslide detected near Tura. Alternate routes activated.", type: "critical" },
          { msg: "Fleet #892 successfully rerouted around flood zone.", type: "success" },
          { msg: "Bridge structural warning at Brahmaputra crossing. Monitoring.", type: "warning" },
          { msg: "Clear weather detected ahead of Fleet #210. Resuming normal speed.", type: "success" }
        ];
        const randomAlert = possibleAlerts[Math.floor(Math.random() * possibleAlerts.length)];
        const newAlert = { 
          id: Date.now(), 
          time: "Just now", 
          ...randomAlert 
        };
        
        setLiveAlerts(prev => {
          const updated = [newAlert, ...prev];
          return updated.slice(0, 3).map((a, idx) => ({
            ...a,
            time: idx === 0 ? "Just now" : idx === 1 ? "1 min ago" : "Few mins ago"
          }));
        });
      }
    }, 2500);

    return () => clearInterval(simInterval);
  }, []);

  const stats = [
    { label: "Active Fleets", value: activeFleets.toLocaleString(), icon: <Radio size={32} className="text-emerald-500" /> },
    { label: "Hazards Avoided", value: hazardsAvoided.toLocaleString(), icon: <ShieldAlert size={32} className="text-amber-500" /> },
    { label: "Random Forest Accuracy", value: "94.8%", icon: <TrendingUp size={32} className="text-blue-500" /> }
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col pt-28 px-12 md:px-24 pb-16 font-sans text-white">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop")' }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-8">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h1 className="text-5xl font-black tracking-widest uppercase">Command Center</h1>
            <span className="bg-blue-600/20 border border-blue-500 text-blue-300 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full w-fit">
              Simulated Telemetry Demo
            </span>
          </div>
          <div className="w-24 h-[3px] bg-blue-500 mb-2 mt-2"></div>
          <p className="text-lg text-gray-300 tracking-wider font-bold">Live Network Telemetry & ML Analytics</p>
        </motion.div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl flex items-center gap-6"
            >
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 shrink-0">
                {stat.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">{stat.label}</span>
                <motion.span 
                  key={stat.value}
                  initial={{ opacity: 0.5, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-black mt-1"
                >
                  {stat.value}
                </motion.span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ML Visualizations Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Risk Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl flex flex-col"
          >
            <h2 className="text-xl font-bold tracking-widest uppercase text-white mb-8 flex items-center gap-3">
              <PieChart className="text-blue-400" size={24} /> Risk Distribution
            </h2>
            <div className="flex flex-col gap-6 w-full">
              <div className="flex justify-between items-center text-white font-bold text-lg">
                <span className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div> Low Risk
                </span> 
                <span className="text-2xl">68%</span>
              </div>
              <div className="flex justify-between items-center text-white font-bold text-lg">
                <span className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div> Moderate Risk
                </span> 
                <span className="text-2xl">23%</span>
              </div>
              <div className="flex justify-between items-center text-white font-bold text-lg">
                <span className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div> High Risk
                </span> 
                <span className="text-2xl">9%</span>
              </div>
              
              {/* Stacked Bar */}
              <div className="w-full h-4 rounded-full flex overflow-hidden mt-4 bg-white/10">
                <motion.div initial={{width:0}} whileInView={{width:'68%'}} transition={{duration:1, ease:"easeOut"}} className="h-full bg-emerald-500"></motion.div>
                <motion.div initial={{width:0}} whileInView={{width:'23%'}} transition={{duration:1, ease:"easeOut"}} className="h-full bg-amber-500"></motion.div>
                <motion.div initial={{width:0}} whileInView={{width:'9%'}} transition={{duration:1, ease:"easeOut"}} className="h-full bg-red-500"></motion.div>
              </div>
            </div>
          </motion.div>

          {/* Route Analytics */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl flex flex-col"
          >
            <h2 className="text-xl font-bold tracking-widest uppercase text-white mb-6 flex items-center gap-3">
              <BarChart3 className="text-blue-400" size={24} /> Route Analytics
            </h2>
            
            {/* Simple Bar Chart */}
            <div className="flex-1 flex w-full h-48 pl-8 pt-4 pb-6 relative">
              {/* Y Axis Labels */}
              <div className="absolute left-0 top-4 bottom-6 w-8 flex flex-col justify-between text-xs font-bold text-gray-400 items-end pr-2">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>
              
              {/* Chart Area */}
              <div className="flex-1 flex items-end justify-around border-b-2 border-l-2 border-white/20 h-full relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px bg-white/5"></div>
                  <div className="w-full h-px"></div>
                </div>

                <div className="relative flex flex-col items-center justify-end w-12 md:w-16 h-full group z-10">
                  <span className="absolute -top-6 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">85</span>
                  <motion.div initial={{height:0}} whileInView={{height:'85%'}} transition={{duration:1, delay:0.2}} className="w-full bg-red-500 rounded-t-sm shadow-[0_0_15px_rgba(239,68,68,0.5)]"></motion.div>
                  <span className="absolute -bottom-6 text-xs text-gray-300 font-bold uppercase tracking-wider">Rt A</span>
                </div>
                <div className="relative flex flex-col items-center justify-end w-12 md:w-16 h-full group z-10">
                  <span className="absolute -top-6 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">60</span>
                  <motion.div initial={{height:0}} whileInView={{height:'60%'}} transition={{duration:1, delay:0.3}} className="w-full bg-amber-500 rounded-t-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"></motion.div>
                  <span className="absolute -bottom-6 text-xs text-gray-300 font-bold uppercase tracking-wider">Rt B</span>
                </div>
                <div className="relative flex flex-col items-center justify-end w-12 md:w-16 h-full group z-10">
                  <span className="absolute -top-6 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">40</span>
                  <motion.div initial={{height:0}} whileInView={{height:'40%'}} transition={{duration:1, delay:0.4}} className="w-full bg-blue-500 rounded-t-sm shadow-[0_0_15px_rgba(59,130,246,0.5)]"></motion.div>
                  <span className="absolute -bottom-6 text-xs text-gray-300 font-bold uppercase tracking-wider">Rt C</span>
                </div>
                <div className="relative flex flex-col items-center justify-end w-12 md:w-16 h-full group z-10">
                  <span className="absolute -top-6 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">20</span>
                  <motion.div initial={{height:0}} whileInView={{height:'20%'}} transition={{duration:1, delay:0.5}} className="w-full bg-emerald-500 rounded-t-sm shadow-[0_0_15px_rgba(16,185,129,0.5)]"></motion.div>
                  <span className="absolute -bottom-6 text-xs text-gray-300 font-bold uppercase tracking-wider">Rt D</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
          
          {/* Live Map / ML Graph Placeholder */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="bg-[#e8ecec]/95 backdrop-blur-xl border-[3px] border-black rounded-3xl p-8 shadow-2xl text-black flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <Activity size={24} className="text-blue-600" />
              <h2 className="text-2xl font-black tracking-wider">System Status</h2>
            </div>
            
            <div className="flex-1 bg-black/5 rounded-2xl border-2 border-black/20 flex flex-col items-center justify-center p-8 text-center min-h-[250px]">
              <div className="relative w-32 h-32 mb-6">
                <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-2 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-black text-2xl text-emerald-600">OK</span>
                </div>
              </div>
              <p className="font-bold text-gray-600 tracking-widest">All ML microservices operational</p>
              <p className="text-sm text-gray-500 font-semibold mt-2 font-mono">
                Latency: <span className="text-black font-bold">{latency}ms</span> | Throughput: <span className="text-black font-bold">{throughput}k req/s</span>
              </p>
            </div>
          </motion.div>

          {/* Live Alerts Feed */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl flex flex-col h-[400px]"
          >
            <h2 className="text-2xl font-black tracking-wider mb-6 flex items-center gap-3">
              <Radio size={24} className="text-red-500 animate-pulse" />
              Live Hazard Feed
            </h2>
            
            <div className="flex flex-col gap-4 overflow-hidden relative flex-1">
              <AnimatePresence initial={false}>
                {liveAlerts.map((alert) => (
                  <motion.div 
                    key={alert.id} 
                    layout
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 items-start w-full origin-top"
                  >
                    {alert.type === 'critical' ? (
                      <AlertTriangle size={20} className="text-red-500 shrink-0 mt-1" />
                    ) : alert.type === 'warning' ? (
                      <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-1" />
                    ) : (
                      <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-1" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 tracking-wider mb-1">{alert.time}</span>
                      <p className="text-sm font-semibold text-gray-200 leading-relaxed">{alert.msg}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

