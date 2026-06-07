import { useEffect, useState } from 'react';
import { getStatus } from '../api';
import { Cloud, Sparkles, LineChart, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) return;

    let consecutiveErrors = 0;
    const interval = setInterval(async () => {
      try {
        const data = await getStatus();
        
        if (data.status === 'failed') {
          setError(data.error || 'An error occurred during the audit.');
          clearInterval(interval);
          return;
        }

        // Map backend string steps to numeric steps
        let numericStep = 1;
        if (data.step === 'analyzing') {
          numericStep = 2;
        } else if (data.step === 'scoring') {
          numericStep = 3;
        }
        setStep(numericStep);

        if (data.completed === true || data.status === 'success') {
          clearInterval(interval);
          onComplete();
        }
        
        consecutiveErrors = 0; // Reset on success
      } catch (err: any) {
        consecutiveErrors++;
        if (consecutiveErrors > 3) {
          setError(err.message || 'Lost connection to backend. Ensure it is running on localhost:8000.');
          clearInterval(interval);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [error, onComplete]);

  const steps = [
    { id: 1, label: 'Fetching GitHub data', icon: Cloud },
    { id: 2, label: 'AI is analyzing your repos', icon: Sparkles },
    { id: 3, label: 'Calculating your score', icon: LineChart },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] items-center justify-center p-6 bg-app-bg text-app-text">
      <div className="w-full max-w-lg space-y-12">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="w-24 h-24 mx-auto rounded-full border-t-2 border-accent border-r-2 flex items-center justify-center mb-8 shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]"
          >
            <div className="w-20 h-20 rounded-full border-b-2 border-white/50 border-l-2" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-2 uppercase tracking-tighter">Analyzing Profile</h2>
          <p className="opacity-50 text-sm mono">This might take a minute or two...</p>
        </div>
        
        {error ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/30 p-8 flex flex-col items-center text-center space-y-5">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div className="text-red-400 font-medium leading-relaxed mono text-sm">{error}</div>
            <button 
              onClick={() => setError(null)}
              className="mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold flex items-center gap-2 transition-all uppercase tracking-widest text-xs"
            >
              <RefreshCw className="w-4 h-4" /> Start Over
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4 bg-bg-card p-6 border border-line">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;

              return (
                <div 
                  key={s.id} 
                  className={`flex items-center gap-5 p-4 transition-all duration-500 ${isActive ? 'bg-white/5 border border-line' : isCompleted ? 'border border-transparent' : 'opacity-40 border border-transparent'}`}
                >
                  <div className={`p-4 transition-colors duration-500 ${isActive ? 'bg-accent text-black shadow-lg' : isCompleted ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-white/40'}`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg transition-colors duration-500 serif italic ${isActive ? 'text-white' : isCompleted ? 'text-white/40' : 'text-white/40'}`}>
                      {s.label}
                    </h3>
                  </div>
                  {isCompleted && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/30">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
