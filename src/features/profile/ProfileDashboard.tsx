import { useState } from 'react';
import type { DatasetProfile, ColumnProfile } from '../../csv/profiler';
import { generateDefaultCharts } from '../../csv/chartSpecs';
import { ChartCard } from '../../components/ChartCard';

interface ProfileDashboardProps {
  profile: DatasetProfile;
  onReset: () => void;
}

export function ProfileDashboard({ profile, onReset }: ProfileDashboardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const defaultCharts = generateDefaultCharts(profile);

  // Pagination for preview
  const totalPreviewRows = profile.previewRows.length;
  const totalPages = Math.ceil(totalPreviewRows / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedRows = profile.previewRows.slice(startIndex, startIndex + rowsPerPage);

  const getTypeBadgeClass = (type: ColumnProfile['type']) => {
    switch (type) {
      case 'number':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'date':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'boolean':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'mixed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full space-y-6 text-left">
      {/* File Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">{profile.fileName}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              Parsed Locally (No AI)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {(profile.fileSizeBytes / 1024).toFixed(1)} KB • Delimiter: &quot;{profile.delimiter}&quot;
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
        >
          Load Another File
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Rows</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{profile.rowCount.toLocaleString()}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Columns</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{profile.columnCount}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Duplicate Rows</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {profile.duplicateRowCount > 0 ? (
              <span className="text-amber-600">{profile.duplicateRowCount}</span>
            ) : (
              <span className="text-slate-900">0</span>
            )}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Data Quality</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {profile.warnings.length === 0 ? '100% Clean' : 'Flags Reported'}
          </div>
        </div>
      </div>

      {/* Deterministic Default Charts Section (Zero AI required) */}
      {defaultCharts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Deterministic Default Charts</h3>
            <span className="text-xs text-slate-500 font-mono">Code-Generated • Zero AI</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {defaultCharts.map((spec) => (
              <ChartCard key={spec.id} spec={spec} />
            ))}
          </div>
        </div>
      )}

      {/* Column Schema & Statistics Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Column Profiles & Statistical Summaries</h3>
          <span className="text-xs text-slate-500">{profile.columns.length} columns inspected</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Column Name</th>
                <th className="py-2.5 px-4">Inferred Type</th>
                <th className="py-2.5 px-4">Missing</th>
                <th className="py-2.5 px-4">Unique</th>
                <th className="py-2.5 px-4">Deterministic Stats / Categories</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {profile.columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center space-x-1.5">
                      <span>{col.name}</span>
                      {col.isPiiSuspect && (
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200"
                          title="Contains identifiers or looks like PII; excluded from cloud by default"
                        >
                          PII Flag
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${getTypeBadgeClass(col.type)}`}>
                      {col.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {col.missingCount > 0 ? (
                      <span className="text-amber-600 font-semibold">
                        {col.missingCount} ({col.missingPercentage}%)
                      </span>
                    ) : (
                      '0 (0%)'
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{col.uniqueCount}</td>
                  <td className="py-3 px-4 text-slate-700 font-sans text-xs">
                    {col.numericStats ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono">
                        <span>Min: {col.numericStats.min}</span>
                        <span>Max: {col.numericStats.max}</span>
                        <span>Mean: {col.numericStats.mean}</span>
                        <span>Median: {col.numericStats.median}</span>
                        {col.numericStats.outliersCount > 0 && (
                          <span className="text-amber-700 font-semibold">
                            IQR Outliers: {col.numericStats.outliersCount}
                          </span>
                        )}
                      </div>
                    ) : col.topCategories && col.topCategories.length > 0 ? (
                      <div className="text-[11px] text-slate-600">
                        Top: {col.topCategories.map((c) => `${c.value} (${c.percentage}%)`).join(', ')}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-mono text-[11px]">
                        Samples: {col.sampleValues.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Data Preview Table (First 50 Rows, Paginated) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Local Data Preview</h3>
            <p className="text-[11px] text-slate-500">
              Showing rows {startIndex + 1}–{Math.min(startIndex + rowsPerPage, totalPreviewRows)} of {totalPreviewRows} previewed rows (max 50)
            </p>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-slate-600 font-mono text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-slate-400 w-12 text-center">#</th>
                {profile.columns.map((c) => (
                  <th key={c.name} className="py-2 px-3 whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {displayedRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 text-slate-400 text-center font-sans text-[10px]">
                    {startIndex + rIdx + 1}
                  </td>
                  {profile.columns.map((col) => (
                    <td key={col.name} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {row[col.name] !== '' ? row[col.name] : <span className="text-slate-300 italic">null</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
