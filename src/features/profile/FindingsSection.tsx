import { useState } from 'react';
import type { DataFinding } from '../../csv/findings';
import type { DatasetProfile } from '../../csv/profiler';

interface FindingsSectionProps {
  findings: DataFinding[];
  profile: DatasetProfile;
}

export function FindingsSection({ findings, profile }: FindingsSectionProps) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  if (!findings || findings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-left">
        <div className="flex items-center space-x-2">
          <span className="text-emerald-500 font-bold text-lg">✓</span>
          <h3 className="text-sm font-bold text-slate-900">Deterministic Findings Engine</h3>
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            100% Clean
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Zero data flaws, missing spikes, or format inconsistencies detected in this dataset.
        </p>
      </div>
    );
  }

  const getSeverityBadge = (severity: DataFinding['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'info':
        return 'bg-sky-50 text-sky-700 border-sky-200 font-medium';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden text-left space-y-0">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Deterministic Findings Engine</h3>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
              {findings.length} Anomaly {findings.length === 1 ? 'Rule' : 'Rules'} Flagged
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Computed deterministically in streaming pass • Click any evidence row to inspect locally • Zero AI hallucination
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            {findings.filter((f) => f.severity === 'critical').length} Critical
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {findings.filter((f) => f.severity === 'warning').length} Warning
          </span>
          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
            {findings.filter((f) => f.severity === 'info').length} Info
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {findings.map((finding) => (
          <div key={finding.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${getSeverityBadge(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-xs font-bold text-slate-900">{finding.title}</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                  {finding.code}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-700 font-mono">
                Count: {finding.approximate ? '≈ ' : ''}{finding.count.toLocaleString()}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{finding.description}</p>

            {/* Clickable Row Evidence Pointers */}
            {finding.rowIndices && finding.rowIndices.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Evidence Rows:</span>
                {finding.rowIndices.map((rowNum) => (
                  <button
                    key={rowNum}
                    type="button"
                    onClick={() => setSelectedRowIndex(rowNum)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Row #{rowNum}
                  </button>
                ))}
                {finding.count > finding.rowIndices.length && (
                  <span className="text-[10px] text-slate-400 font-mono italic">
                    +{finding.count - finding.rowIndices.length} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Row Evidence Inspector Modal */}
      {selectedRowIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 border border-slate-200 text-left">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900">Evidence Inspector: Row #{selectedRowIndex}</span>
                <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded font-mono">
                  Local Match
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRowIndex(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              This 1-based row number was identified by the deterministic single-pass streaming detector.
              It is held locally in memory and never submitted to the AI model.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs space-y-1">
              <div>
                <span className="text-slate-500">Row Number:</span> <span className="font-bold text-slate-900">{selectedRowIndex}</span>
              </div>
              <div>
                <span className="text-slate-500">File Context:</span> <span className="text-slate-800">{profile.fileName}</span>
              </div>
              <div>
                <span className="text-slate-500">Total File Rows:</span> <span className="text-slate-800">{profile.rowCount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRowIndex(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
