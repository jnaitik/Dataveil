import { useEffect, useState } from 'react';
import { useAnonymousAuth } from './store/auth';
import { getUserPreferences, type UserPreferences } from './store/preferences';
import { getShortPayloadCharLimit, initRemoteConfig } from './lib/remoteConfig';

export default function App() {
  const { user, loading: authLoading, isConfigured } = useAnonymousAuth();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [charLimit, setCharLimit] = useState<number>(4000);

  useEffect(() => {
    initRemoteConfig().then(() => {
      setCharLimit(getShortPayloadCharLimit());
    });

    getUserPreferences(user?.uid).then((p) => {
      setPrefs(p);
    });
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            D
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Dataveil</h1>
            <p className="text-xs text-slate-500">Private CSV Explainer</p>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Phase 3 Ready
          </span>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
              isConfigured
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isConfigured ? 'Firebase Connected' : 'Local Fallback (Awaiting .env)'}
          </span>

          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Auth: {authLoading ? 'Checking...' : user ? `Anon (${user.uid.slice(0, 6)}…)` : 'Offline / In-Memory'}
          </span>

          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Mode: {prefs?.preferredMode === 'auto' ? 'Auto' : 'Private'}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl space-y-4">
          <div className="inline-block px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold tracking-wide uppercase">
            Firebase AI Logic • Phase 3 Configured
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Understand your CSV data without uploading it.
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            Your raw rows never leave your device. The browser computes statistics and charts locally; 
            AI only sees deterministic summaries, powered on-device by default with consent-based cloud fallback.
          </p>

          {/* Phase 3 Architecture Live Verification Grid */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">1. AI Service Client</h3>
                <span className="text-[10px] uppercase font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  Isolated
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                <code>src/ai/aiClient.ts</code> manages <code>getAI</code> with <code>GoogleAIBackend</code>. Components never import <code>firebase/ai</code> directly.
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">2. Remote Config</h3>
                <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {charLimit} chars
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Payload budget key <code>short_payload_char_limit</code> active. Prevents on-device context overflow.
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">3. Anonymous Auth</h3>
                <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Isolated UID
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Firestore security rules enforce reading and writing strictly to <code>users/&#123;uid&#125;</code> for non-sensitive preferences only.
              </p>
            </div>
          </div>

          {/* Setup Guidance for the User / Developer */}
          <div className="mt-8 p-4 bg-slate-100 rounded-xl text-left border border-slate-200 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800">Phase 3 Firebase Integration Status:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>App Check & AI Logic:</strong> Initialized with debug token support for hackathon evaluation.
              </li>
              <li>
                <strong>Security:</strong> Tabular data is strictly forbidden from Firestore. Zero raw rows uploaded.
              </li>
              <li>
                <strong>Graceful Fallback:</strong> If no Firebase project keys are provided in <code>.env</code>, all preferences and profile calculations seamlessly run in memory.
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        Dataveil — Firebase AI Logic Hybrid Inference Hackathon Project • Phase 3 Complete
      </footer>
    </div>
  );
}
