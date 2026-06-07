import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import LoadingScreen from './components/LoadingScreen';
import ResultsDashboard from './components/ResultsDashboard';
import { AuditResult } from './types';

export default function App() {
  const [screen, setScreen] = useState<'setup' | 'loading' | 'results'>('setup');
  const [selectedHistoryData, setSelectedHistoryData] = useState<AuditResult | null>(null);

  const handleStartRun = () => {
    setSelectedHistoryData(null);
    setScreen('loading');
  };

  const handleViewHistory = (data: AuditResult) => {
    setSelectedHistoryData(data);
    setScreen('results');
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans selection:bg-accent/30 overflow-x-hidden">
      {screen === 'setup' && <SetupScreen onStart={handleStartRun} />}
      {screen === 'loading' && <LoadingScreen onComplete={() => setScreen('results')} />}
      {screen === 'results' && (
        <ResultsDashboard 
          onRestart={() => { setScreen('setup'); setSelectedHistoryData(null); }} 
          initialData={selectedHistoryData}
          onViewHistory={handleViewHistory}
        />
      )}
    </div>
  );
}
