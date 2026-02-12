'use client';

import LiveCard from '../components/LiveCard';
import HistoryTable from '../components/HistoryTable';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* एम्बिएंट बैकग्राउंड ग्लो (Apple Style) */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* कंटेंट कंटेनर */}
      <div className="relative z-10 max-w-md mx-auto pb-20">
        
        {/* हेडर */}
        <header className="pt-8 px-6 pb-4 flex justify-between items-center backdrop-blur-sm sticky top-0 z-50">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Aura Analyze
            </h1>
            <p className="text-xs text-gray-500 font-medium tracking-wider uppercase">
              Live Data Feed
            </p>
          </div>
          
          {/* स्टेटस इंडिकेटर */}
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase">Online</span>
          </div>
        </header>

        {/* लाइव टाइमर कार्ड */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <LiveCard />
        </section>

        {/* इतिहास टेबल */}
        <section className="mt-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          <div className="px-6 mb-2 flex justify-between items-end">
            <h3 className="text-sm font-semibold text-gray-400">Recent Rounds</h3>
            <button className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              View Analytics →
            </button>
          </div>
          <HistoryTable />
        </section>

      </div>
    </main>
  );
}
