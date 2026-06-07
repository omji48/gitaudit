import { useEffect, useState } from 'react';
import { getResults } from '../api';
import { AuditResult } from '../types';
import ScoreCircle from './ScoreCircle';
import TierBadge from './TierBadge';
import DimensionBar from './DimensionBar';
import ShareButton from './ShareButton';
import BadgeGenerator from './BadgeGenerator';
import { AlertCircle, History, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface HistoryItem {
  date: string;
  data: AuditResult;
}

export default function ResultsDashboard({ onRestart, initialData, onViewHistory }: { onRestart: () => void, initialData: AuditResult | null, onViewHistory: (data: AuditResult) => void }) {
  const [data, setData] = useState<AuditResult | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // Load history
    const saved = localStorage.getItem('gitaudit_history_v1');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }

    if (!initialData) {
      // Fetch new result
      getResults()
        .then((res) => {
          setData(res);
          const newItem = { date: new Date().toISOString(), data: res };
          setHistory(prev => {
            const filtered = prev.filter(h => h.data.username !== res.username || h.data.score !== res.score);
            const updated = [newItem, ...filtered].slice(0, 10);
            localStorage.setItem('gitaudit_history_v1', JSON.stringify(updated));
            return updated;
          });
        })
        .catch((err) => setError(err.message || 'Failed to load results.'));
    }
  }, [initialData]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto opacity-80" />
          <h2 className="text-2xl font-bold text-white">Couldn't load results</h2>
          <div className="text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</div>
          <button onClick={onRestart} className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors">Start Over</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
          <span className="font-medium tracking-wider">PREPARING DASHBOARD...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-10 py-6 border-b border-line shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-sm flex items-center justify-center font-bold text-black">G</div>
          <h1 className="text-xl font-bold tracking-tighter uppercase text-white">GitAudit</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-50 mono hidden sm:inline">v2.4.0-stable</span>
          <div className="h-4 w-[1px] bg-line hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
            <span className="mono">@{data.username}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10">
        
        {/* Left Column: Score Card */}
        <div className="lg:col-span-4 flex flex-col items-center text-center pt-4 md:pt-10">
          <ScoreCircle score={data.score} />
          
          <div className="mt-8 mb-6">
            <TierBadge tier={data.tier} />
          </div>
          
          <p className="text-sm text-balance px-4 serif leading-relaxed opacity-70 italic mb-8">
            "{data.summary}"
          </p>

          <div className="flex flex-col w-full px-4 gap-4 mt-auto justify-center">
            <ShareButton data={data} />
            <button 
              onClick={onRestart} 
              className="px-8 py-3 bg-transparent border border-line text-white font-bold text-xs uppercase tracking-widest hover:bg-white/5 active:scale-95 transition-all w-full"
            >
              Start Over
            </button>
          </div>
        </div>

        {/* Right Column: Dimensions & Lists */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          
          {/* Dimension Grid */}
          <section>
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40 mb-6">Analysis Dimensions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {data.dimensions.map((dim, i) => (
                <DimensionBar key={dim.name} dimension={dim} index={i} />
              ))}
            </div>
          </section>

          {/* Bottom Row Info */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Skill Tags */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-400">Top Skills</h3>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill) => (
                  <span key={skill} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] mono uppercase">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Column 2: Red Flags */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-400">Red Flags</h3>
              <ul className="text-[11px] space-y-2 opacity-80 serif">
                {data.redFlags.length === 0 ? (
                  <li className="opacity-50 italic">None found</li>
                ) : (
                  data.redFlags.map((flag, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0">•</span> 
                      <span className="leading-tight">{flag}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Column 3: Quick Wins */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-green-400">Quick Wins</h3>
              <ul className="text-[11px] space-y-2 opacity-80 serif">
                {data.quickWins.length === 0 ? (
                  <li className="opacity-50 italic">None found</li>
                ) : (
                  data.quickWins.map((win, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0">•</span> 
                      <span className="leading-tight">{win}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

          </section>
        </div>
      </main>

      {/* Strongest Repos Footer & Badge Generator & History */}
      <footer className="max-w-[1280px] mx-auto w-full p-6 md:p-10 pt-0 flex flex-col gap-10">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40 mb-4">Flagship Repositories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.topRepos.map((repo) => (
              <a 
                key={repo.name}
                href={`https://github.com/${data.username}/${repo.name}`}
                target="_blank"
                rel="noreferrer"
                className="repo-card p-4 rounded-r block hover:opacity-80 transition-opacity"
              >
                <h4 className="font-bold text-sm tracking-tight truncate pr-2">{repo.name}</h4>
                <p className="text-[10px] opacity-60 mt-1 serif leading-relaxed">{repo.reason}</p>
              </a>
            ))}
          </div>
        </div>

        <BadgeGenerator scoreData={data} />

        {history.length > 0 && (() => {
          const userHistory = history
            .filter(h => h.data.username === data.username)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const chartData = userHistory.map((h, i) => ({
            name: `Run ${i + 1}`,
            date: new Date(h.date).toLocaleDateString(),
            score: h.data.score,
          }));

          return (
            <div className="mt-8 space-y-10">
              {userHistory.length > 1 && (
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40 mb-6 flex items-center gap-2">
                    <History className="w-4 h-4" /> Score Progression
                  </h2>
                  <div className="h-64 w-full bg-bg-card border border-line p-6 rounded relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" stroke="#E0E0E0" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke="#E0E0E0" opacity={0.5} fontSize={12} tickLine={false} axisLine={false} width={30} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', color: '#E0E0E0' }}
                          itemStyle={{ color: '#A855F7', fontWeight: 'bold' }}
                        />
                        <Line type="monotone" dataKey="score" stroke="#A855F7" strokeWidth={3} dot={{ fill: '#A855F7', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40 mb-6 flex items-center gap-2">
                  <History className="w-4 h-4" /> Audit History
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {history.map((item, idx) => (
                    <button 
                      key={idx}
                      onClick={() => onViewHistory(item.data)}
                      className="flex flex-col text-left p-4 bg-bg-card border border-line rounded hover:bg-white/5 active:scale-95 transition-all group"
                    >
                      <div className="flex justify-between items-center w-full mb-2">
                        <span className="font-bold mono uppercase tracking-widest text-white">@{item.data.username}</span>
                        <span className="text-xl font-bold text-accent">{item.data.score}<span className="text-xs text-white/40">/100</span></span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/50">{item.data.tier}</span>
                        <span className="text-xs serif italic opacity-50">{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </footer>
    </div>
  );
}
