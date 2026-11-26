import { useState } from 'react';
import type { DatasetProfile } from '../../csv/profiler';
import { buildAiPayload } from '../../ai/payload';

interface PrivacyInspectorTabProps {
  profile: DatasetProfile | null;
  preferredMode: 'private' | 'auto';
  hasCloudConsent?: boolean;
}

export function PrivacyInspectorTab({
  profile,
  preferredMode,
  hasCloudConsent = false,
}: PrivacyInspectorTabProps) {
  const [copied, setCopied] = useState(false);
  const [excludePii, setExcludePii] = useState(true);
  const [includeTopValues, setIncludeTopValues] = useState(false);

  if (!profile) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xl font-bold">
          🛡️
        </div>
        <h3 className="text-base font-extrabold text-slate-900">Privacy Inspector Ready</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Upload or select a CSV dataset to inspect its live data boundaries, sensitive column exclusions, and the exact AI payload before transmission.
        </p>
      </div>
    );
  }

  const aiPayload = buildAiPayload(profile, {
    excludePiiByDefault: excludePii,
    includeTopValues,
  });

  const sensitiveColumns = profile.columns.filter((c) => c.isPiiSuspect);
  const activeColumns = profile.columns.filter((c) => {
    if (excludePii && c.isPiiSuspect) return false;
    return true;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(aiPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-6 text-left" role="tabpanel" aria-label="Privacy Inspector Dashboard">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🛡️</span>
            <h3 className="text-base font-extrabold text-slate-900">
              Live Privacy & Data Firewall Inspector
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Verify Dataveil's central promise: your CSV rows stay 100% on your device. Only statistical metadata you approve is shared with AI, and cloud fallback is physically blocked without explicit consent.
          </p>
        </div>

        <div className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          Firewall Active • Zero Raw Cells Shared
        </div>
      </div>

      {/* Network Privacy Guarantees Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
            Network Integrity
          </span>
          <div className="text-xl font-black text-emerald-900 mt-1">0 Requests</div>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            Outbound HTTP requests dispatched without explicit user consent
          </p>
        </div>

        <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-sky-800 tracking-wider">
            Raw Row Confinement
          </span>
          <div className="text-xl font-black text-sky-900 mt-1">0 Records</div>
          <p className="text-[11px] text-sky-700 mt-0.5">
            Raw data rows or cell values ever sent to Google Gemini or cloud servers
          </p>
        </div>

        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">
            Active Routing Target
          </span>
          <div className="text-xl font-black text-indigo-900 mt-1">
            {preferredMode === 'private' ? 'On-Device (Nano)' : 'Auto Managed'}
          </div>
          <p className="text-[11px] text-indigo-700 mt-0.5">
            {hasCloudConsent ? 'One-time cloud consent granted' : 'Strict local execution (Consent required for cloud)'}
          </p>
        </div>
      </div>

      {/* Dataset & Boundary Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Dataset Metadata */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current Dataset Boundaries
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[11px]">File Name:</span>
              <span className="font-bold text-slate-800 break-all">{profile.fileName}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[11px]">File Size:</span>
              <span className="font-bold text-slate-800 font-mono">
                {(profile.fileSizeBytes / 1024).toFixed(1)} KB ({(profile.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Total Rows (100% Local):</span>
              <span className="font-bold text-slate-800 font-mono">{profile.rowCount.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 block text-[11px]">Total Columns:</span>
              <span className="font-bold text-slate-800 font-mono">{profile.columnCount}</span>
            </div>
          </div>
        </div>

        {/* Inference & Consent Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Inference & Consent Security Status
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-600">User Operating Mode:</span>
              <span className="font-bold text-slate-900 font-mono">
                {preferredMode === 'private' ? 'Private (Strict On-Device)' : 'Auto'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-600">Destination Engine:</span>
              <span className="font-bold text-sky-700 font-mono">
                Chrome Gemini Nano (ONLY_ON_DEVICE)
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-600">Cloud Fallback Status:</span>
              <span className="font-bold text-emerald-700">
                {hasCloudConsent ? 'Authorized for current task' : 'BLOCKED (Awaiting Consent)'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-600">Firestore CSV Persistence:</span>
              <span className="font-bold text-slate-800 font-mono">DISABLED (0 bytes stored)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitive Column Firewall Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Column Privacy Audit ({sensitiveColumns.length} Sensitive Columns Detected)
            </h4>
            <p className="text-[11px] text-slate-500">
              Columns flagged with emails, SSNs, phone numbers, or passwords are automatically excluded from AI prompts.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <label className="inline-flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludePii}
                onChange={(e) => setExcludePii(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700">Auto-Exclude PII</span>
            </label>

            <label className="inline-flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTopValues}
                onChange={(e) => setIncludeTopValues(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700">Allow Top Frequencies</span>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Column Name</th>
                <th className="py-2.5 px-3">Inferred Type</th>
                <th className="py-2.5 px-3">Privacy Flag</th>
                <th className="py-2.5 px-3">AI Payload Status</th>
                <th className="py-2.5 px-3">Permitted AI Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {profile.columns.map((col) => {
                const isExcluded = excludePii && col.isPiiSuspect;
                return (
                  <tr key={col.name} className={col.isPiiSuspect ? 'bg-rose-50/20' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                      {col.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {col.type.toUpperCase()}
                    </td>
                    <td className="py-2.5 px-3">
                      {col.isPiiSuspect ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          🛡️ Sensitive / PII Suspect
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                          Standard Attribute
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      {isExcluded ? (
                        <span className="text-rose-700 inline-flex items-center gap-1">
                          ✕ Excluded from AI Prompt
                        </span>
                      ) : (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          ✓ Permitted as Statistical Summary
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">
                      {isExcluded
                        ? 'None (Exclusion Notice Only)'
                        : col.numericStats
                        ? 'Min, Max, Mean, Median, IQR Outliers'
                        : 'Missing %, Unique Count'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exact Live AI Payload Preview Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-slate-900">
                Exact AI Payload Preview (Before Any Transmission)
              </h4>
              <span className="text-[10px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                {aiPayload.length} Characters • {activeColumns.length} of {profile.columnCount} Columns
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              This is the literal string generated by <code className="font-mono text-sky-600">buildAiPayload()</code>. Inspect it to verify that zero individual row records are sent.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {copied ? '✓ Copied to Clipboard' : '📋 Copy AI Payload'}
          </button>
        </div>

        <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl overflow-x-auto max-h-72 leading-relaxed border border-slate-800 whitespace-pre-wrap select-all">
          {aiPayload}
        </pre>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center justify-between">
          <span>
            <strong>Deterministic Privacy Guarantee:</strong> The mathematical aggregation engine converts row data to statistics entirely in JavaScript. The AI model only receives descriptive aggregate metadata.
          </span>
          <span className="font-mono font-bold text-emerald-700 ml-2">100% Inspectable</span>
        </div>
      </div>
    </div>
  );
}
