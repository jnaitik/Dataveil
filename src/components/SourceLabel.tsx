export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD';

interface SourceLabelProps {
  source: InferenceSource | string;
  className?: string;
  showTooltip?: boolean;
}

export function SourceLabel({ source, className = '', showTooltip = true }: SourceLabelProps) {
  const isOnDevice = source === 'ON_DEVICE';

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border shadow-xs ${
          isOnDevice
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-sky-50 text-sky-800 border-sky-300'
        }`}
        title={
          showTooltip
            ? isOnDevice
              ? 'Computed on your device with Chrome Gemini Nano. Zero data left your computer.'
              : 'Computed in Google Cloud with Gemini 3.5 Flash Lite after explicit consent.'
            : undefined
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            isOnDevice ? 'bg-emerald-600 animate-pulse' : 'bg-sky-600'
          }`}
        />
        {isOnDevice ? 'On your device' : 'In the cloud'}
      </span>
    </div>
  );
}
