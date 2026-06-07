import { Tier } from '../types';

export default function TierBadge({ tier }: { tier: Tier }) {
  const colors = {
    Ghost: 'bg-neutral-800 text-neutral-300 border-neutral-700 shadow-neutral-900/50',
    Lurker: 'bg-blue-900/40 text-blue-400 border-blue-500/40 shadow-blue-900/30',
    Builder: 'bg-amber-900/40 text-amber-400 border-amber-500/40 shadow-amber-900/30',
    Operator: 'bg-purple-900/40 text-purple-400 border-purple-500/40 shadow-purple-900/30',
    Rockstar: 'bg-coral-900/40 text-red-400 border-red-500/40 shadow-red-900/30', // Fallback to red palette for coral
  };

  const prefixes = {
    Ghost: '👻',
    Lurker: '👀',
    Builder: '🛠️',
    Operator: '⚡',
    Rockstar: '🌟'
  };

  return (
    <div className={`px-6 py-2 rounded-full flex items-center gap-2 ${colors[tier] || colors.Ghost}`}>
      <span className="text-lg">{prefixes[tier]}</span>
      <span className="text-sm font-bold uppercase tracking-widest">{tier} Tier</span>
    </div>
  );
}
