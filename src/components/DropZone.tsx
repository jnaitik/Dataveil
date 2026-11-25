import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { SAMPLE_DATASETS, type SyntheticDataset } from '../data/sampleDatasets';

interface DropZoneProps {
  onLoadCsv: (csvContent: string, fileName: string, fileSizeBytes: number) => void;
  isLoading?: boolean;
}

export function DropZone({ onLoadCsv, isLoading = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);

    // Limit check: 10 MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onLoadCsv(content, file.name, file.size);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected file.');
    };
    reader.readAsText(file);
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
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-sky-500 bg-sky-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileInputChange}
          className="hidden"
        />

        <div className="space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold">
            📄
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {isLoading ? 'Parsing and profiling locally...' : 'Drop your CSV file here, or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Parsed 100% in your browser • Up to 10 MB / 50,000 rows • Raw rows never leave your computer
            </p>
          </div>
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
    </div>
  );
}
