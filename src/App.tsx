import { useEffect, useState } from 'react';
import { useAnonymousAuth } from './store/auth';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from './store/preferences';
import { StatusPanel } from './components/StatusPanel';
import { UnderTheHood, type InferenceLogEntry } from './components/UnderTheHood';
import { GateTestHarness } from './features/gate/GateTestHarness';
import { DropZone } from './components/DropZone';
import { ProfileDashboard } from './features/profile/ProfileDashboard';
import { parseAndProfileCsv } from './csv/parserClient';
import type { DatasetProfile } from './csv/profiler';

export default function App() {
  const { user } = useAnonymousAuth();
  const [prefs, setPrefs] = useState<UserPreferences>({
    preferredMode: 'private',
    acceptedCloudNotice: false,
    requestCountsBySource: { onDevice: 0, cloud: 0 },
  });
  const [lastLog, setLastLog] = useState<InferenceLogEntry | null>(null);

  // Profile and CSV State
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'gate'>('profile');

  useEffect(() => {
    getUserPreferences(user?.uid).then((p) => {
      setPrefs(p);
    });
  }, [user]);

  const toggleMode = () => {
    const nextMode = prefs.preferredMode === 'private' ? 'auto' : 'private';
    const updated = { ...prefs, preferredMode: nextMode as 'private' | 'auto' };
    setPrefs(updated);
    saveUserPreferences(user?.uid, { preferredMode: nextMode });
  };

  const handleLoadCsv = async (csvContent: string, fileName: string, fileSizeBytes: number) => {
    setIsParsing(true);
    try {
      const result = await parseAndProfileCsv(csvContent, fileName, fileSizeBytes);
      setProfile(result);
      setActiveTab('profile');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error profiling CSV.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-xs">
            D
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">Dataveil</h1>
            <p className="text-[11px] text-slate-500">Private CSV Explainer</p>
          </div>
        </div>

        {/* Live Status Bar */}
        <StatusPanel preferredMode={prefs.preferredMode} onToggleMode={toggleMode} />
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center space-y-6">
        {/* Navigation Tabs */}
        <div className="w-full flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              📊 Profile Module (Zero AI)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gate')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'gate'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              🔒 Hybrid AI Verification Gate
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Phase 5 • Deterministic Core
          </span>
        </div>

        {/* Tab 1: Profile Module (Zero AI) */}
        {activeTab === 'profile' && (
          <div className="w-full space-y-6">
            {!profile ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Local CSV Profile & Analysis
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Upload your CSV or click any sample dataset. Inferred data types, outlier detection (IQR), 
                    missing values, duplicate counts, and default charts are computed 100% locally in a Web Worker with zero AI.
                  </p>
                </div>
                <DropZone onLoadCsv={handleLoadCsv} isLoading={isParsing} />
              </div>
            ) : (
              <ProfileDashboard profile={profile} onReset={() => setProfile(null)} />
            )}
          </div>
        )}

        {/* Tab 2: Hybrid AI Verification Gate */}
        {activeTab === 'gate' && (
          <div className="w-full flex flex-col items-center space-y-6">
            <div className="max-w-2xl text-center space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Hybrid AI Gate & Consent Inspector
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Verify strict on-device execution with Gemini Nano, inspect the one-time consent card,
                and review real SDK provenance and latency.
              </p>
            </div>
            <GateTestHarness preferredMode={prefs.preferredMode} onLogUpdate={setLastLog} />
            <UnderTheHood lastLog={lastLog} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
        Dataveil — Firebase AI Logic Hybrid Inference Hackathon Project • Phase 5 Deterministic Profile Complete
      </footer>
    </div>
  );
}
