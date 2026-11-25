export default function App() {
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
        <div className="flex items-center space-x-3 text-xs">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Phase 2 Initialized
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200">
            Firebase 13.4.0
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Mode: Private (Default)
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl space-y-4">
          <div className="inline-block px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold tracking-wide uppercase">
            #BuildHybridAI 2026
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Understand your CSV data without uploading it.
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            Your raw rows never leave your device. The browser computes statistics and charts locally; 
            AI only sees deterministic summaries, powered on-device by default with consent-based cloud fallback.
          </p>

          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">1. Deterministic First</h3>
              <p className="text-xs text-slate-500 mt-1">
                Parsing, validation, stats, and charts are calculated by 100% reliable local code in a Web Worker.
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">2. Hybrid AI Inference</h3>
              <p className="text-xs text-slate-500 mt-1">
                On-device inference via Chrome Prompt API + Gemini Nano. Cloud is strictly consent-gated.
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">3. True Provenance</h3>
              <p className="text-xs text-slate-500 mt-1">
                Clear labels displaying real inference sources directly from the Firebase AI Logic SDK.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        Dataveil — Firebase AI Logic Hybrid Inference Hackathon Project • Phase 2 Ready
      </footer>
    </div>
  );
}
