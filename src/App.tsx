import { useEffect, useState } from 'react';
import { useAnonymousAuth } from './store/auth';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from './store/preferences';
import { StatusPanel } from './components/StatusPanel';
import { UnderTheHood, type InferenceLogEntry } from './components/UnderTheHood';
import { GateTestHarness } from './features/gate/GateTestHarness';

export default function App() {
  const { user } = useAnonymousAuth();
  const [prefs, setPrefs] = useState<UserPreferences>({
    preferredMode: 'private',
    acceptedCloudNotice: false,
    requestCountsBySource: { onDevice: 0, cloud: 0 },
  });
  const [lastLog, setLastLog] = useState<InferenceLogEntry | null>(null);

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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold tracking-wide uppercase">
            Phase 4 • Hybrid AI Verification Gate
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            On-Device First. Consent-Gated Cloud Fallback.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Dataveil guarantees your raw rows stay on your device. Test the hybrid AI execution gate below:
            see on-device inference run strictly locally, experience the consent card when local execution is unavailable,
            and inspect real SDK latency and provenance.
          </p>
        </div>

        {/* Gate Test Harness */}
        <GateTestHarness preferredMode={prefs.preferredMode} onLogUpdate={setLastLog} />

        {/* Under the Hood Drawer */}
        <UnderTheHood lastLog={lastLog} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
        Dataveil — Firebase AI Logic Hybrid Inference Hackathon Project • Phase 4 Gate Ready
      </footer>
    </div>
  );
}
