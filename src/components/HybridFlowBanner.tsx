import { useState } from 'react';

export function HybridFlowBanner() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      icon: '📁',
      title: 'Local CSV File',
      desc: 'Up to 50 MB / 500k rows held strictly in browser memory',
      badge: 'Local Memory',
    },
    {
      icon: '⚙️',
      title: 'Web Worker Profiler',
      desc: 'IQR outliers, types, distributions computed client-side with 0 AI',
      badge: 'Deterministic',
    },
    {
      icon: '🛡️',
      title: 'Privacy Sanitizer',
      desc: 'Raw rows stripped; PII masked; only statistical metadata emitted',
      badge: '0 Raw Rows',
    },
    {
      icon: '🤖',
      title: 'Hybrid Inference',
      desc: 'Runs on Gemini Nano (On-Device). Cloud requires explicit consent',
      badge: 'Nano / Cloud Gate',
    },
    {
      icon: '📊',
      title: 'Deterministic Output',
      desc: 'Recharts and math engine compute all numbers locally',
      badge: 'Zero AI Math',
    },
  ];

  return (
    <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/60 rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-700/50 pb-3">
        <div className="flex items-center space-x-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Dataveil Hybrid AI Pipeline Architecture
          </h3>
        </div>
        <span className="text-[11px] font-mono text-sky-300 bg-sky-950/60 border border-sky-700/50 px-2 py-0.5 rounded-full">
          Zero Data Leak Guarantee
        </span>
      </div>

      {/* Horizontal Step Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3 text-left">
        {steps.map((s, idx) => {
          const isSelected = activeStep === idx;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActiveStep(isSelected ? null : idx)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-slate-800/90 border-sky-400 shadow-md shadow-sky-500/20 scale-[1.02]'
                  : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-base">{s.icon}</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-slate-700/80 text-slate-300 border border-slate-600/50">
                  {s.badge}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-100">{s.title}</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                {s.desc}
              </p>
            </button>
          );
        })}
      </div>

      {activeStep !== null && (
        <div className="mt-3 p-3 bg-slate-800/90 border border-sky-500/40 rounded-2xl text-xs text-sky-200 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white">Stage {activeStep + 1} Deep-Dive:</span>
            <span>{steps[activeStep].desc}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveStep(null)}
            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
