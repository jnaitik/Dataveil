import { useEffect } from 'react';

interface DataPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataPrivacyModal({ isOpen, onClose }: DataPrivacyModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-left space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-emerald-500/20">
              🛡️
            </div>
            <div>
              <h2 id="privacy-modal-title" className="text-base font-bold text-slate-900">
                How Dataveil Handles Your Data
              </h2>
              <p className="text-xs text-slate-500">
                A transparent, zero-trust architecture built for sensitive tabular datasets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1.5">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <span>⚡</span> 100% In-Browser Worker
            </div>
            <p className="text-emerald-800/80 text-[11px] leading-relaxed">
              Files up to 50 MB are parsed and profiled on your computer inside a dedicated Web Worker. The raw file never touches our backend or Firestore.
            </p>
          </div>

          <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-1.5">
            <div className="font-bold text-sky-900 flex items-center gap-1.5">
              <span>🧹</span> Zero Raw Rows to AI
            </div>
            <p className="text-sky-800/80 text-[11px] leading-relaxed">
              The AI never receives customer names, records, or row cells. Only high-level statistical summaries (min, max, mean, count) are used.
            </p>
          </div>

          <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-1.5">
            <div className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>💻</span> On-Device First (Nano)
            </div>
            <p className="text-indigo-800/80 text-[11px] leading-relaxed">
              In Private mode, inference executes on Chrome's built-in Gemini Nano using your local GPU/NPU. Zero network packets are sent to AI servers.
            </p>
          </div>

          <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-1.5">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>🚦</span> Explicit Consent Gate
            </div>
            <p className="text-amber-800/80 text-[11px] leading-relaxed">
              If on-device inference is unavailable, Dataveil halts and shows an interactive Consent Card previewing the exact payload before calling the cloud.
            </p>
          </div>
        </div>

        {/* Comparison: Traditional vs Dataveil */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Architecture Comparison
          </h4>
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="grid grid-cols-2 bg-slate-100/80 border-b border-slate-200 p-2.5 font-bold text-slate-700">
              <div className="text-rose-700 flex items-center gap-1">❌ Traditional Cloud AI Tools</div>
              <div className="text-emerald-700 flex items-center gap-1">✅ Dataveil Hybrid AI</div>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              <div className="grid grid-cols-2 p-2.5 text-[11px] text-slate-600">
                <div>Sends entire raw CSV rows to remote cloud servers</div>
                <div className="font-semibold text-slate-800">
                  Parses 100% in browser; sends zero raw records
                </div>
              </div>
              <div className="grid grid-cols-2 p-2.5 text-[11px] text-slate-600 bg-slate-50/40">
                <div>Exposes sensitive PII (emails, names, salaries) in prompts</div>
                <div className="font-semibold text-slate-800">
                  PII automatically detected and excluded by default
                </div>
              </div>
              <div className="grid grid-cols-2 p-2.5 text-[11px] text-slate-600">
                <div>AI hallucinates calculations and arithmetic</div>
                <div className="font-semibold text-slate-800">
                  100% deterministic local calculation engine
                </div>
              </div>
              <div className="grid grid-cols-2 p-2.5 text-[11px] text-slate-600 bg-slate-50/40">
                <div>Opaque: user cannot see what left their device</div>
                <div className="font-semibold text-slate-800">
                  Transparent: Inspect Payload drawer & live telemetry
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 99.9% Payload Compression Highlight */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-sky-400">99.99% Data Reduction Ratio</div>
            <p className="text-[11px] text-slate-300">
              A 50 MB dataset (500,000 rows) is reduced to a ~1.8 KB statistical summary before any AI inference.
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-emerald-400">0</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Raw Rows Shared</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
