import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, query, limitToLast, orderByKey } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryTable() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // आज की तारीख का पाथ (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const historyRef = query(
      ref(db, `results/${today}`),
      orderByKey(),
      limitToLast(20) // सिर्फ आखिरी 20 रिजल्ट्स दिखाएं
    );

    // रीयल-टाइम लिसनर
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // डेटा को एरे में बदलें और उल्टा सॉर्ट करें (Newest First)
        const formattedData = Object.entries(data)
          .map(([key, value]) => ({
            period: key,
            ...value
          }))
          .sort((a, b) => b.period - a.period); // Descending order
        
        setHistory(formattedData);
      }
    });

    return () => unsubscribe();
  }, []);

  // हेल्पर फंक्शन: नंबर से Big/Small पता करना
  const getSize = (num) => (num >= 5 ? 'Big' : 'Small');

  // हेल्पर फंक्शन: कलर के हिसाब से स्टाइल
  const getColorStyle = (color) => {
    switch(color) {
      case 'G': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'R': return 'bg-rose-500 shadow-rose-500/50';
      case 'V': return 'bg-violet-500 shadow-violet-500/50';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-8 px-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
        
        {/* हेडर */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <div className="pl-2">Period</div>
          <div className="text-center">Number</div>
          <div className="text-center">Size</div>
          <div className="text-right pr-2">Color</div>
        </div>

        {/* लिस्ट (Animated) */}
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          <AnimatePresence initial={false}>
            {history.map((row) => (
              <motion.div
                key={row.period}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-4 gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center"
              >
                {/* Period ID (Last 4 digits) */}
                <div className="font-mono text-sm text-gray-300">
                  {row.period.slice(-4)}
                </div>

                {/* Number (Gradient Text) */}
                <div className={`text-center font-bold text-lg bg-gradient-to-br ${
                  getSize(row.n) === 'Big' ? 'from-yellow-400 to-orange-500' : 'from-blue-400 to-cyan-500'
                } bg-clip-text text-transparent`}>
                  {row.n}
                </div>

                {/* Size Badge */}
                <div className="flex justify-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    getSize(row.n) === 'Big' 
                      ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' 
                      : 'border-blue-500/30 text-blue-500 bg-blue-500/10'
                  }`}>
                    {getSize(row.n)}
                  </span>
                </div>

                {/* Color Dot */}
                <div className="flex justify-end pr-2">
                  <div className={`w-4 h-4 rounded-full ${getColorStyle(row.c)} shadow-lg ring-2 ring-white/10`}></div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {history.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              Waiting for data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
