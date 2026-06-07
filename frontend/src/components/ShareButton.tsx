import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { AuditResult } from '../types';

export default function ShareButton({ data }: { data: AuditResult }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `🔍 My GitAudit Score: ${data.score}/100 — ⚡ ${data.tier}\nTop skills: ${data.skills.slice(0, 3).join(', ')}\nQuick wins: ${data.quickWins[0] || 'Clean up repos'}\nCheck yours → github.com/your-repo/gitaudit`;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button 
      onClick={handleShare}
      className={`px-8 py-3 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 ${
        copied 
          ? 'bg-green-500 hover:opacity-90 text-black' 
          : 'bg-accent hover:opacity-90 text-black'
      }`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      {copied ? 'Copied' : 'Copy Score Card'}
    </button>
  );
}
