import { useEffect, useState } from 'react';
import { animate } from 'motion';

export default function ScoreCircle({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const controls = animate(0, score, {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplayScore(Math.round(latest)),
    });
    return controls.stop;
  }, [score]);

  // Visual classes based on score bracket
  const getColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBorderColor = () => {
    if (score >= 80) return 'border-green-500/20';
    if (score >= 60) return 'border-amber-500/20';
    return 'border-red-500/20';
  };

  const getStrokeColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="score-circle w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center shrink-0">
      <div className="text-6xl sm:text-7xl font-bold tracking-tight text-white drop-shadow-lg">
        {displayScore}
      </div>
      <div className="text-xs uppercase tracking-widest opacity-50 font-semibold mt-1">
        of 100 points
      </div>
    </div>
  );
}
