import { useState, useEffect } from 'react';
import { checkDeviceModelAvailability, type DeviceModelAvailability } from '../ai/guard';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [copiedFlag, setCopiedFlag] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<DeviceModelAvailability | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

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

  const handleCopy = (text: string, flagKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFlag(flagKey);
    setTimeout(() => setCopiedFlag(null), 2000);
  };

  const handleCheckBrowser = async () => {
    setIsChecking(true);
    try {
      const status = await checkDeviceModelAvailability();
      setModelStatus(status);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem('dataveil_onboarding_dismissed', 'true');
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-left space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-sky-500/20">
              ✨
            </div>
            <div>
              <h2 id="onboarding-modal-title" className="text-base font-bold text-slate-900">
                Chrome Gemini Nano Onboarding
              </h2>
              <p className="text-xs text-slate-500">
                Run zero-cost, 100% private AI inference directly on your laptop GPU/NPU
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-4 text-xs">
          {/* Step 1 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 inline-flex items-center justify-center text-[11px] font-bold">
                  1
                </span>
                Enable Prompt API in Chrome
              </span>
              <button
                type="button"
                onClick={() => handleCopy('chrome://flags/#prompt-api-for-gemini-nano', 'flag1')}
                className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
              >
                {copiedFlag === 'flag1' ? '✓ Copied' : '📋 Copy URL'}
              </button>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Open a new tab, navigate to <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 inline-flex items-center justify-center text-[11px] font-bold">
                  2
                </span>
                Bypass Model Hardware Check
              </span>
              <button
                type="button"
                onClick={() => handleCopy('chrome://flags/#optimization-guide-on-device-model', 'flag2')}
                className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
              >
                {copiedFlag === 'flag2' ? '✓ Copied' : '📋 Copy URL'}
              </button>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Go to <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">chrome://flags/#optimization-guide-on-device-model</code> and choose <strong>Enabled BypassPerfRequirement</strong>, then relaunch Chrome.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 inline-flex items-center justify-center text-[11px] font-bold">
                  3
                </span>
                Download Model Weights (First Time Only)
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Navigate to <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">chrome://components</code> and click <strong>Check for update</strong> on <em>Optimization Guide On Device Model</em>.
            </p>
          </div>
        </div>

        {/* Live Diagnostic Tester */}
        <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Live Browser AI Diagnostic</h4>
              <p className="text-[11px] text-slate-600">
                Test if your active browser session has on-device Gemini Nano ready
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckBrowser}
              disabled={isChecking}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isChecking ? 'Checking...' : 'Run Diagnostic'}
            </button>
          </div>

          {modelStatus && (
            <div className="pt-1 flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-700">Result:</span>
              {modelStatus === 'available' && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  🟢 Gemini Nano is READY on this device!
                </span>
              )}
              {modelStatus === 'downloadable' && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  🟡 Model Downloadable (Trigger an inference to start download)
                </span>
              )}
              {modelStatus === 'unsupported' && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold border border-slate-300">
                  ⚪ Not Detected (Follow Steps 1 & 2 above, or use Cloud Consent Mode)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <span>Don't show automatically on startup</span>
          </label>

          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
