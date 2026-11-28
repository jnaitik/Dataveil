import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { SAMPLE_DATASETS, type SyntheticDataset } from '../data/sampleDatasets';
import type { StreamingProgress } from '../csv/parserClient';

interface DropZoneProps {
  onLoadFile?: (file: File) => void;
  onLoadCsv?: (csvContent: string, fileName: string, fileSizeBytes: number) => void;
  isLoading?: boolean;
  progress?: StreamingProgress | null;
  onCancel?: () => void;
}

export function DropZone({
  onLoadFile,
  onLoadCsv,
  isLoading = false,
  progress = null,
  onCancel,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setLargeFileWarning(null);

    // Hard limit check: 500 MB
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File exceeds the 500 MB hard limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    // Warning for files over 100 MB
    if (file.size > 100 * 1024 * 1024) {
      setLargeFileWarning(
        `Large file detected (${(file.size / (1024 * 1024)).toFixed(1)} MB). Streaming single-pass analysis may take 15–45 seconds depending on hardware.`
      );
    }

    if (onLoadFile) {
      onLoadFile(file);
    } else if (onLoadCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onLoadCsv(content, file.name, file.size);
      };
      reader.onerror = () => {
        setErrorMsg('Failed to read the selected file.');
      };
      reader.readAsText(file);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const loadSample = (sample: SyntheticDataset) => {
    setErrorMsg(null);
    setLargeFileWarning(null);
    if (onLoadFile) {
      const blob = new Blob([sample.csvContent], { type: 'text/csv' });
      const file = new File([blob], `${sample.id}.csv`, { type: 'text/csv' });
      onLoadFile(file);
    } else if (onLoadCsv) {
      onLoadCsv(sample.csvContent, `${sample.id}.csv`, new Blob([sample.csvContent]).size);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Drag & Drop Card */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isLoading ? 'cursor-default border-sky-400 bg-sky-50/40' : 'cursor-pointer hover:border-slate-400 bg-white'
        } ${
          isDragging ? 'border-sky-500 bg-sky-50/70 scale-[1.01]' : 'border-slate-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileInputChange}
          disabled={isLoading}
          className="hidden"
        />

        {isLoading ? (
          <div className="space-y-4 max-w-md mx-auto py-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                Streaming & Profiling (Single-Pass)...
              </span>
              <span className="font-mono text-sky-600">{progress ? `${progress.percent}%` : 'Reading...'}</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-150 rounded-full"
                style={{ width: `${progress ? Math.max(5, progress.percent) : 15}%` }}
              />
            </div>

            {/* Progress Metrics */}
            {progress && (
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-slate-400 text-[9px] uppercase font-sans">Bytes Read</div>
                  <div className="font-semibold text-slate-700">
                    {(progress.bytesRead / (1024 * 1024)).toFixed(1)} / {(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[9px] uppercase font-sans">Speed</div>
                  <div className="font-semibold text-slate-700">
                    {progress.rowsPerSecond.toLocaleString()} rows/s
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[9px] uppercase font-sans">ETA</div>
                  <div className="font-semibold text-slate-700">
                    {progress.etaSeconds > 0 ? `${progress.etaSeconds}s` : 'Finishing...'}
                  </div>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            {onCancel && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                >
                  ✕ Cancel Parsing
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold">
              📄
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Single-pass streaming • Up to 500 MB • Bounded memory • Raw rows never leave your computer
              </p>
            </div>
          </div>
        )}
      </div>

      {largeFileWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-2">
          <span>⚠️</span>
          <span>{largeFileWarning}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 text-left">
          {errorMsg}
        </div>
      )}

      {/* Synthetic Dataset Quick Picks */}
      {!isLoading && (
        <div className="text-left space-y-2">
          <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Or load a synthetic sample dataset (Instant &lt; 1s):</span>
            <span className="text-[11px] font-normal text-slate-500">Labeled fictional data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SAMPLE_DATASETS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => loadSample(sample)}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all shadow-2xs hover:border-sky-300 cursor-pointer"
              >
                <div className="text-xs font-semibold text-slate-800">{sample.name}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">{sample.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
