import { useState } from 'react';
import type { DatasetProfile } from '../csv/profiler';
import { buildAiPayload, type PayloadOptions } from '../ai/payload';

interface PayloadPreviewProps {
  profile: DatasetProfile;
  options: PayloadOptions;
  onOptionsChange: (options: PayloadOptions) => void;
}

export function PayloadPreview({ profile, options, onOptionsChange }: PayloadPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const payloadText = buildAiPayload(profile, options);
  const excludedSet = new Set(options.excludedColumns || []);

  const toggleColumn = (colName: string) => {
    const next = new Set(excludedSet);
    if (next.has(colName)) {
      next.delete(colName);
    } else {
      next.add(colName);
    }
    onOptionsChange({
      ...options,
      excludedColumns: Array.from(next),
    });
  };

  const toggleTopValues = (checked: boolean) => {
    onOptionsChange({
      ...options,
      includeTopValues: checked,
    });
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-left space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-base">🛡️</span>
          <div>
            <h4 className="text-xs font-bold text-slate-900">What the AI Will See</h4>
            <p className="text-[11px] text-slate-500">
              Only statistical metadata is shared. Raw rows and personal cells are strictly omitted.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
        >
          {isOpen ? '▲ Hide Payload' : '▼ Inspect Payload'}
        </button>
      </div>

      {isOpen && (
        <div className="pt-3 border-t border-slate-100 space-y-4">
          {/* Privacy Controls */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">Column Privacy Filters:</span>

              {/* Include Top Values Toggle (Default OFF) */}
              <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(options.includeTopValues)}
                  onChange={(e) => toggleTopValues(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="font-medium">Include Top Categories (max 5)</span>
                <span className="text-[10px] text-slate-400 font-mono">(Default: OFF)</span>
              </label>
            </div>

            {/* Column Toggles */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {profile.columns.map((col) => {
                const isExcluded = excludedSet.has(col.name) || (options.excludePiiByDefault && col.isPiiSuspect);

                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => toggleColumn(col.name)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer flex items-center space-x-1 ${
                      isExcluded
                        ? 'bg-rose-50 text-rose-700 border-rose-300 line-through opacity-75'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
                    }`}
                    title={col.isPiiSuspect ? 'PII Suspect — Excluded by default' : 'Click to include/exclude'}
                  >
                    <span>{col.name}</span>
                    {col.isPiiSuspect && <span className="text-[9px] text-rose-600 font-sans font-bold">PII</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Click any column badge above to toggle it out of the payload before sending to the model.
            </p>
          </div>

          {/* Exact String Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <span>Exact AI Payload String</span>
              <span className="font-mono text-emerald-600">{payloadText.length} characters</span>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap selection:bg-sky-700">
              {payloadText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
