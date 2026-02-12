import React, { useState, useEffect } from 'react';

export default function LiveCard() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState('Waiting'); // 'Betting' or 'Drawing'
  const [currentPeriod, setCurrentPeriod] = useState('Loading...');

  useEffect(() => {
    // टाइमर को हर सेकंड अपडेट करें
    const timer = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      const totalMinutes = now.getHours() * 60 + now.getMinutes();
      
      // 30-सेकंड का लॉजिक (0-29 और 30-59)
      const isSecondHalf = seconds >= 30;
      const remaining = isSecondHalf ? 60 - seconds : 30 - seconds;
      
      // Period ID कैलकुलेशन (YYYYMMDD + Total Rounds)
      // एक दिन में 2880 राउंड्स होते हैं (1440 mins * 2)
      const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const roundsToday = (totalMinutes * 2) + (isSecondHalf ? 2 : 1);
      const periodId = `${todayStr}${String(roundsToday).padStart(4, '0')}`;

      setTimeLeft(remaining);
      setCurrentPeriod(periodId);

      // स्टेटस अपडेट (आखिरी 5 सेकंड = Drawing)
      if (remaining <= 5) {
        setStatus('Drawing...');
      } else {
        setStatus('Betting Open');
      }
      
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/10 p-6 backdrop-blur-xl border border-white/20 shadow-2xl mx-4 mt-6">
      {/* बैकग्राउंड ग्लो इफेक्ट */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl -z-10"></div>

      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Current Period</p>
          <h2 className="text-2xl font-bold text-white tracking-tight font-mono">
            {currentPeriod}
          </h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
          status === 'Drawing...' 
            ? 'bg-red-500/20 border-red-500/50 text-red-200' 
            : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
        }`}>
          {status}
        </div>
      </div>

      {/* बड़ा टाइमर */}
      <div className="flex flex-col items-center justify-center py-4">
        <span className={`text-6xl font-black tracking-tighter transition-all duration-300 ${
          timeLeft <= 5 ? 'text-red-400 scale-110' : 'text-white'
        }`}>
          00:{String(timeLeft).padStart(2, '0')}
        </span>
        <p className="text-gray-400 text-sm mt-2">Time Remaining</p>
      </div>

      {/* प्रोग्रेस बार */}
      <div className="w-full bg-gray-700/50 h-1.5 rounded-full mt-4 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${(timeLeft / 30) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}
