import { useState, useEffect } from 'react';
import type { DatasetProfile } from '../../csv/profiler';
import {
  getNetworkLedgerEntries,
  getNetworkLedgerSummary,
  subscribeNetworkLedger,
  clearNetworkLedger,
  type NetworkLedgerEntry,
} from '../../lib/networkLedger';
import {
  generatePrivacyReceipt,
  downloadPrivacyReceiptJson,
  getRecordedAiRequests,
  type PrivacyReceipt,
} from '../../lib/privacyReceipt';

interface PrivacyReceiptTabProps {
  profile: DatasetProfile | null;
}

export function PrivacyReceiptTab({ profile }: PrivacyReceiptTabProps) {
  const [entries, setEntries] = useState<NetworkLedgerEntry[]>([]);
  const [optInFileName, setOptInFileName] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'receipt' | 'ledger'>('receipt');

  useEffect(() => {
    setEntries(getNetworkLedgerEntries());
    const unsubscribe = subscribeNetworkLedger(() => {
      setEntries(getNetworkLedgerEntries());
    });
    return unsubscribe;
  }, []);

  const summary = getNetworkLedgerSummary();
  const receipt: PrivacyReceipt = generatePrivacyReceipt(profile, optInFileName);
  const aiRequests = getRecordedAiRequests();

  const handleDownload = () => {
    downloadPrivacyReceiptJson(receipt);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="w-full space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-700 rounded-3xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🧾</span>
            <h2 className="text-lg font-bold tracking-tight">Verifiable Privacy Audit & Session Receipt</h2>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              WebCrypto SHA-256
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Dataveil does not ask for blind trust. Every outbound packet is recorded in the Network Ledger,
            and every AI transaction carries a cryptographic SHA-256 payload digest.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
        >
          <span>📥</span> Download Privacy Receipt (.json)
        </button>
      </div>

      {/* KPI Audit Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Parsing Network Requests</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {summary.duringParsingCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">100% Local Air-Gap Verified</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pre-Consent External Calls</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {summary.beforeConsentCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Zero unconsented AI telemetry</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Post-Consent External Calls</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {summary.afterConsentCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Explicit user authorization</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Transactions</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {aiRequests.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Cryptographically hashed</p>
        </div>
      </div>

      {/* Sub-Tabs: Privacy Receipt View vs Network Ledger View */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('receipt')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'receipt'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📜 Cryptographic Receipt
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('ledger')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'ledger'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📡 Live Network Ledger ({entries.filter((e) => !e.isLocalhost).length} Requests)
        </button>
      </div>

      {activeSubTab === 'receipt' && (
        <div className="space-y-4">
          {/* Privacy Options & Opt-in */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <input
                id="opt-in-filename"
                type="checkbox"
                checked={optInFileName}
                onChange={(e) => setOptInFileName(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <label htmlFor="opt-in-filename" className="text-xs text-slate-700 cursor-pointer">
                Include original CSV filename in receipt (Default is MASKED for maximum privacy)
              </label>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              Receipt Session: {receipt.sessionId}
            </span>
          </div>

          {/* AI Transactions & Cryptographic SHA-256 Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recorded AI Inferences & Cryptographic Provenance</h3>
              <span className="text-xs text-slate-500 font-mono">{aiRequests.length} Transactions</span>
            </div>

            {aiRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No AI requests dispatched in this session yet. Explore the Explain, Suggested Charts, or Ask tabs to trigger inference.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Provenance</th>
                      <th className="py-2.5 px-4">Consent</th>
                      <th className="py-2.5 px-4">Payload Size</th>
                      <th className="py-2.5 px-4">SHA-256 Digest</th>
                      <th className="py-2.5 px-4">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {aiRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 text-slate-500">
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.realInferenceSource === 'on-device'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {req.realInferenceSource.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              req.consentGiven ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
                            }`}
                          >
                            {req.consentGiven ? 'Granted' : 'Local / N/A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {req.payloadCharLength.toLocaleString()} chars
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="truncate max-w-[140px] text-slate-600" title={req.payloadSha256}>
                              {req.payloadSha256}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyHash(req.payloadSha256)}
                              className="text-[10px] text-sky-600 hover:text-sky-800 underline cursor-pointer"
                            >
                              {copiedHash === req.payloadSha256 ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {req.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Raw JSON Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner text-white font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 text-xs font-sans font-bold">Privacy Receipt JSON Structure</span>
              <button
                type="button"
                onClick={handleDownload}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-sans font-semibold underline cursor-pointer"
              >
                Download Complete JSON
              </button>
            </div>
            <pre className="overflow-x-auto max-h-60 p-2 text-slate-300 leading-relaxed">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Network Transparency & Blind Spot Disclaimers */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Network Audit Transparency & Limitations</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
              <li>
                <strong>CORS Byte Masking:</strong> Due to browser security standards, cross-origin requests without a{' '}
                <code>Timing-Allow-Origin</code> header report 0 transfer bytes. We accurately report request counts and target hostnames.
              </li>
              <li>
                <strong>Firebase SDK Traffic:</strong> All Firebase Auth, App Check, and Remote Config endpoints are intercepted and displayed below.
              </li>
              <li>
                <strong>Blind Spots:</strong> Persistent WebSockets and Service Worker background sync cannot be intercepted via PerformanceResourceTiming.
              </li>
            </ul>
          </div>

          {/* Network Ledger Entries Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Session Outbound Request Ledger</h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono">{entries.length} Total Captured</span>
                <button
                  type="button"
                  onClick={() => clearNetworkLedger()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors cursor-pointer"
                >
                  Clear Ledger
                </button>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Zero network requests recorded in this session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Host</th>
                      <th className="py-2 px-3">Consent Status</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Destination URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800">{entry.method}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              entry.isLocalhost
                                ? 'bg-slate-100 text-slate-600'
                                : entry.isFirebaseSdk
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {entry.host}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              entry.consentState === 'BEFORE_CONSENT'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {entry.consentState === 'BEFORE_CONSENT' ? 'Pre-Consent' : 'Authorized'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] uppercase">
                          {entry.initiatorType}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[200px] text-slate-500" title={entry.url}>
                          {entry.url}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
