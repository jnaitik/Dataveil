import { useEffect, useState } from 'react';
import { checkDeviceModelAvailability, type DeviceModelAvailability } from '../ai/guard';

interface StatusPanelProps {
  preferredMode: 'private' | 'auto';
  onToggleMode: () => void;
}

export function StatusPanel({ preferredMode, onToggleMode }: StatusPanelProps) {
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
          text: 'On-device Model: Ready',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'downloadable':
        return {
          text: 'On-device Model: Downloadable',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'downloading':
        return {
          text: 'On-device Model: Downloading...',
          className: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
        };
      default:
        return {
          text: 'On-device Model: Unavailable / Flag Needed',
          className: 'bg-slate-100 text-slate-600 border-slate-200',
        };
    }
  };

  const badge = getModelBadge();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Model Status */}
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${badge.className}`}
        title="Status of Chrome's built-in Gemini Nano model"
      >
        {badge.text}
      </span>

      {/* Connectivity */}
      <span
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
        className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
        title="Toggle between Private (Strict local) and Auto modes"
      >
        Mode: <span className="font-semibold ml-1">{preferredMode === 'private' ? 'Private (Default)' : 'Auto'}</span>
      </button>
    </div>
  );
}
