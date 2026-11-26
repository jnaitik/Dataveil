import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { SAMPLE_DATASETS, type SyntheticDataset } from '../data/sampleDatasets';

interface DropZoneProps {
  onLoadCsv: (fileOrContent: File | string, fileName: string, fileSizeBytes: number) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  progress?: { rowsProcessed: number; percent: number } | null;
}

export function DropZone({ onLoadCsv, isLoading = false, onCancel, progress }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);

    // Limit check: 500 MB streaming limit
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File exceeds the 500 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    if (file.size === 0) {
      setErrorMsg('Selected file is empty (0 bytes).');
      return;
    }

    // Direct streaming: pass File object directly without loading entire string into RAM
    onLoadCsv(file, file.name, file.size);
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
    onLoadCsv(sample.csvContent, `${sample.id}.csv`, new Blob([sample.csvContent]).size);
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
          isLoading
            ? 'border-sky-300 bg-sky-50/50 cursor-wait'
            : isDragging
            ? 'border-sky-500 bg-sky-50/70 scale-[1.01] cursor-pointer'
            : 'border-slate-300 hover:border-slate-400 bg-white cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileInputChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold">
            {isLoading ? '⏳' : '📄'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {isLoading
                ? `Parsing & profiling in Web Worker... ${progress ? `(${progress.rowsProcessed.toLocaleString()} rows)` : ''}`
                : 'Drop your CSV file here, or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Streaming Web Worker engine • Up to 500 MB / ~500,000 rows • 100% local in your browser
            </p>
          </div>

          {isLoading && (
            <div className="max-w-xs mx-auto space-y-2 pt-2">
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-sky-600 h-2 rounded-full transition-all duration-150 animate-pulse"
                  style={{ width: `${progress?.percent || 35}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>{progress ? `${progress.rowsProcessed.toLocaleString()} rows` : 'Streaming chunks...'}</span>
                {onCancel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel();
                    }}
                    className="text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 text-left">
          {errorMsg}
        </div>
      )}

      {/* Synthetic Dataset Quick Picks */}
      <div className="text-left space-y-2">
        <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>Or test with a synthetic sample dataset (Instant local parse):</span>
          <span className="text-[11px] font-normal text-slate-500">100% fictional records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isLoading}
              onClick={() => loadSample(sample)}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-left transition-all shadow-2xs hover:border-sky-300 cursor-pointer"
            >
              <div className="text-xs font-bold text-slate-900">{sample.name}</div>
              <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">{sample.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
