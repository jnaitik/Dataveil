import { useEffect, useState } from 'react';
import { useAnonymousAuth } from './store/auth';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from './store/preferences';
import { StatusPanel } from './components/StatusPanel';
import { UnderTheHood, type InferenceLogEntry } from './components/UnderTheHood';
import { GateTestHarness } from './features/gate/GateTestHarness';
import { DropZone } from './components/DropZone';
import { ProfileDashboard } from './features/profile/ProfileDashboard';
import { ExplainTab } from './features/explain/ExplainTab';
import { SuggestedChartsTab } from './features/charts/SuggestedChartsTab';
import { AskTab } from './features/ask/AskTab';
import { parseAndProfileCsv } from './csv/parserClient';
import type { DatasetProfile } from './csv/profiler';
import { OnboardingModal } from './components/OnboardingModal';
import { DataPrivacyModal } from './components/DataPrivacyModal';
import { HybridFlowBanner } from './components/HybridFlowBanner';

type TabKey = 'profile' | 'explain' | 'charts' | 'ask' | 'gate';

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
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    getUserPreferences(user?.uid).then((p) => {
      setPrefs(p);
    });

    // Check if onboarding was already dismissed
    const dismissed = localStorage.getItem('dataveil_onboarding_dismissed');
    if (!dismissed) {
      // Show onboarding on first launch
      setIsOnboardingOpen(true);
    }
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
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-md shadow-sky-500/20">
            D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                Dataveil
              </h1>
              <span className="text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                Hybrid AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              <span>Private CSV Explainer</span> • Chrome Gemini Nano
            </p>
          </div>
        </div>

        {/* Live Status Bar & Guide Shortcuts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            title="Setup Chrome Gemini Nano on-device AI"
            className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors cursor-pointer"
          >
            ✨ Nano Setup
          </button>

          <StatusPanel
            preferredMode={prefs.preferredMode}
            onToggleMode={toggleMode}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center space-y-6">
        {/* Dynamic Hybrid Pipeline Architecture Banner */}
        <HybridFlowBanner />

        {/* Navigation Tabs with ARIA Accessibility */}
        <div
          role="tablist"
          aria-label="Application Modules"
          className="w-full flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-2"
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              role="tab"
              id="tab-profile"
              aria-selected={activeTab === 'profile'}
              aria-controls="panel-profile"
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              📊 Profile (No AI)
            </button>

            {profile && (
              <>
                <button
                  role="tab"
                  id="tab-explain"
                  aria-selected={activeTab === 'explain'}
                  aria-controls="panel-explain"
                  type="button"
                  onClick={() => setActiveTab('explain')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === 'explain'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  💡 Explain Columns (AI)
                </button>

                <button
                  role="tab"
                  id="tab-charts"
                  aria-selected={activeTab === 'charts'}
                  aria-controls="panel-charts"
                  type="button"
                  onClick={() => setActiveTab('charts')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === 'charts'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  📈 Suggested Charts (AI)
                </button>

                <button
                  role="tab"
                  id="tab-ask"
                  aria-selected={activeTab === 'ask'}
                  aria-controls="panel-ask"
                  type="button"
                  onClick={() => setActiveTab('ask')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    activeTab === 'ask'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  💬 Ask (AI + Code)
                </button>
              </>
            )}

            <button
              role="tab"
              id="tab-gate"
              aria-selected={activeTab === 'gate'}
              aria-controls="panel-gate"
              type="button"
              onClick={() => setActiveTab('gate')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeTab === 'gate'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              🔒 Verification Gate
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              How your data is handled
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Phase 7 Hardened
            </span>
          </div>
        </div>

        {/* Tab 1: Profile Module (Zero AI) */}
        {activeTab === 'profile' && (
          <div id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" className="w-full space-y-6">
            {!profile ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Local CSV Profile & Analysis
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Upload your CSV (up to 50 MB / 500k rows) or click any synthetic dataset below. Inferred data types, outlier detection (IQR),
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

        {/* Tab 2: Explain Columns (AI) */}
        {activeTab === 'explain' && profile && (
          <div id="panel-explain" role="tabpanel" aria-labelledby="tab-explain" className="w-full">
            <ExplainTab
              profile={profile}
              preferredMode={prefs.preferredMode}
              onLogUpdate={setLastLog}
            />
          </div>
        )}

        {/* Tab 3: Suggested Charts (AI) */}
        {activeTab === 'charts' && profile && (
          <div id="panel-charts" role="tabpanel" aria-labelledby="tab-charts" className="w-full">
            <SuggestedChartsTab
              profile={profile}
              preferredMode={prefs.preferredMode}
              onLogUpdate={setLastLog}
            />
          </div>
        )}

        {/* Tab 4: Ask (AI Maps, Code Executes) */}
        {activeTab === 'ask' && profile && (
          <div id="panel-ask" role="tabpanel" aria-labelledby="tab-ask" className="w-full">
            <AskTab
              profile={profile}
              preferredMode={prefs.preferredMode}
              onLogUpdate={setLastLog}
            />
          </div>
        )}

        {/* Tab 5: Verification Gate */}
        {activeTab === 'gate' && (
          <div id="panel-gate" role="tabpanel" aria-labelledby="tab-gate" className="w-full flex flex-col items-center space-y-6">
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
          </div>
        )}

        {/* Persistent Under The Hood Drawer */}
        <UnderTheHood lastLog={lastLog} />
      </main>

      {/* Onboarding & Privacy Modals */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <DataPrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          Dataveil — Firebase AI Logic Hybrid Inference Hackathon Project • Phase 7 Complete
        </span>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:underline text-slate-600 cursor-pointer"
          >
            Privacy Details
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="hover:underline text-slate-600 cursor-pointer"
          >
            Gemini Nano Setup
          </button>
        </div>
      </footer>
    </div>
  );
}
