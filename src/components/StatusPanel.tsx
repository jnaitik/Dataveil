import { useEffect, useState } from 'react';
import { checkDeviceModelAvailability, type DeviceModelAvailability } from '../ai/guard';

interface StatusPanelProps {
  preferredMode: 'private' | 'auto';
  onToggleMode: () => void;
  onOpenOnboarding?: () => void;
  onOpenPrivacy?: () => void;
}

export function StatusPanel({
  preferredMode,
  onToggleMode,
  onOpenOnboarding,
  onOpenPrivacy,
}: StatusPanelProps) {
  const [modelStatus, setModelStatus] = useState<DeviceModelAvailability>('unsupported');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    checkDeviceModelAvailability().then((status) => {
      setModelStatus(status);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getModelBadge = () => {
    switch (modelStatus) {
      case 'available':
        return {
          text: 'Gemini Nano: Ready',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs shadow-emerald-500/10',
          dot: 'bg-emerald-500',
        };
      case 'downloadable':
        return {
          text: 'Gemini Nano: Downloadable',
          className: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'downloading':
        return {
          text: 'Gemini Nano: Downloading...',
          className: 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse',
          dot: 'bg-blue-500',
        };
      default:
        return {
          text: 'Gemini Nano: Flag Needed',
          className: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-400',
        };
    }
  };

  const badge = getModelBadge();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Model Status Pill with Click to Open Onboarding */}
      <button
        type="button"
        onClick={onOpenOnboarding}
        title="Click to check or configure Chrome Gemini Nano on-device AI flags"
        aria-label="Chrome Gemini Nano status. Click to open setup instructions."
        className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${badge.className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${badge.dot}`} />
        {badge.text}
      </button>

      {/* Connectivity Pill */}
      <span
        aria-label={`Network status: ${isOnline ? 'Online' : 'Offline'}`}
        className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
          isOnline
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        {isOnline ? 'Online' : 'Offline'}
      </span>

      {/* Mode Selector Toggle */}
      <button
        type="button"
        onClick={onToggleMode}
        aria-label={`Toggle inference mode. Current mode is ${preferredMode === 'private' ? 'Private' : 'Auto'}`}
        className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 shadow-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500"
        title="Toggle between Private (Strict local) and Auto modes"
      >
        <span>Mode:</span>
        <span className="font-bold text-sky-300 ml-1">
          {preferredMode === 'private' ? 'Private (On-Device)' : 'Auto (Hybrid)'}
        </span>
      </button>

      {/* Privacy Architecture Guide Button */}
      {onOpenPrivacy && (
        <button
          type="button"
          onClick={onOpenPrivacy}
          aria-label="Open Data Privacy & Architecture Guide"
          className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
        >
          🛡️ Privacy Policy
        </button>
      )}
    </div>
  );
}
