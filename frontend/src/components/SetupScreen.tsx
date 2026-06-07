import { useState } from 'react';
import { runPipeline } from '../api';
import { HelpCircle } from 'lucide-react';

export default function SetupScreen({ onStart }: { onStart: () => void }) {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [model, setModel] = useState('gpt-oss:120b-cloud');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError('Username is required');
      return;
    }
    if (!token) {
      setError('GitHub Token is required');
      return;
    }
    
    try {
      await runPipeline(username, token, model);
      onStart();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] items-center justify-center p-6 bg-app-bg px-4 sm:px-6">
      <div className="max-w-xl w-full space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter uppercase text-white mb-2">
            GitAudit
          </h1>
          <p className="text-app-text opacity-70 text-lg sm:text-xl max-w-sm mx-auto leading-relaxed font-serif italic">
            Know exactly why your GitHub isn't getting you hired.
          </p>
        </div>
 
        <form onSubmit={handleSubmit} className="space-y-6 mt-8 bg-bg-card p-6 sm:p-10 border border-line">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mono uppercase">
              {error}
            </div>
          )}
          
          <div className="space-y-2 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white opacity-40">GitHub Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-app-bg border border-line px-4 py-3 text-white focus:outline-none focus:border-accent transition-all placeholder:text-neutral-600 mono text-sm"
              placeholder="e.g. torvalds"
            />
          </div>
 
          <div className="space-y-2 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white opacity-40">GitHub Token</label>
              <div className="group relative flex items-center cursor-help">
                <HelpCircle className="w-4 h-4 text-white opacity-40 hover:opacity-100 transition-opacity" />
                <div className="absolute right-0 bottom-full mb-3 origin-bottom-right hidden w-56 p-3 bg-bg-card border border-line text-[11px] text-app-text group-hover:block z-10 leading-relaxed serif italic">
                  Mandatory to bypass public API rate limits and to accurately analyze your repositories.
                </div>
              </div>
            </div>
            <input 
              type="password" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-app-bg border border-line px-4 py-3 text-white focus:outline-none focus:border-accent transition-all placeholder:text-neutral-600 mono text-sm"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div className="space-y-2 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white opacity-40">Ollama Model</label>
            <input 
              type="text"
              list="models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-app-bg border border-line px-4 py-3 text-white focus:outline-none focus:border-accent transition-all mono text-sm"
            />
            <datalist id="models">
              <option value="gpt-oss:120b-cloud" />
              <option value="llama3" />
              <option value="mistral" />
              <option value="codellama" />
            </datalist>
          </div>

          <button 
            type="submit"
            className="w-full bg-accent hover:opacity-90 active:scale-95 text-black font-bold text-xs uppercase tracking-widest py-4 transition-all mt-6"
          >
            Audit My Profile
          </button>
        </form>
      </div>
    </div>
  );
}
