import type { DatasetProfile } from '../csv/profiler';

export interface PayloadOptions {
  includeTopValues?: boolean;      // default: false (OFF)
  excludedColumns?: string[];       // column names explicitly excluded by user
  excludePiiByDefault?: boolean;    // default: true
}

/**
 * buildAiPayload is the SINGLE, EXCLUSIVE function in the entire application
 * that generates the text payload sent to any AI model (on-device or cloud).
 * 
 * PRIVACY GUARANTEES:
 * 1. It NEVER includes raw CSV rows or individual cell records.
 * 2. It sends only column names, inferred data types, and deterministic statistical aggregates.
 * 3. Top category frequencies are restricted to max 5 items and ONLY if explicitly enabled by user (default OFF).
 * 4. PII-flagged columns are automatically excluded unless user explicitly overrides.
 */
export function buildAiPayload(profile: DatasetProfile, options: PayloadOptions = {}): string {
  const {
    includeTopValues = false,
    excludedColumns = [],
    excludePiiByDefault = true,
  } = options;

  const excludedSet = new Set(excludedColumns);

  // Filter columns based on user exclusion & PII flags
  const activeColumns = profile.columns.filter((col) => {
    if (excludedSet.has(col.name)) return false;
    if (excludePiiByDefault && col.isPiiSuspect) return false;
    return true;
  });

  const excludedColNames = profile.columns
    .filter((col) => !activeColumns.includes(col))
    .map((col) => col.isPiiSuspect ? `${col.name} (PII Flag)` : col.name);

  let payload = `<DATA_SUMMARY>\n`;
  payload += `File: ${profile.fileName}\n`;
  payload += `Total Rows: ${profile.rowCount}\n`;
  payload += `Total Columns: ${profile.columnCount}\n`;
  const dupLabel = profile.duplicateRowCountExact === false ? `≈ ${profile.duplicateRowCount} (approx)` : `${profile.duplicateRowCount}`;
  payload += `Duplicate Rows: ${dupLabel}\n`;

  if (excludedColNames.length > 0) {
    payload += `Excluded Columns (Not shared for privacy): ${excludedColNames.join(', ')}\n`;
  }

  payload += `\nColumns Profile (${activeColumns.length} included):\n`;

  for (const col of activeColumns) {
    payload += `\n- Column: "${col.name}"\n`;
    payload += `  Type: ${col.type.toUpperCase()}\n`;
    payload += `  Missing Count: ${col.missingCount} (${col.missingPercentage}%)\n`;
    const uniqueLabel = col.uniqueCountExact === false ? `≈ ${col.uniqueCount} (approx)` : `${col.uniqueCount}`;
    payload += `  Unique Count: ${uniqueLabel}\n`;

    if (col.numericStats) {
      const medLabel = col.numericStats.exact?.median === false ? `≈ ${col.numericStats.median} (approx)` : `${col.numericStats.median}`;
      const outLabel = col.numericStats.exact?.outliersCount === false ? `≈ ${col.numericStats.outliersCount} (approx)` : `${col.numericStats.outliersCount}`;
      payload += `  Stats: min=${col.numericStats.min}, max=${col.numericStats.max}, mean=${col.numericStats.mean}, median=${medLabel}, outliers_iqr=${outLabel}\n`;
    }

    if (includeTopValues && col.topCategories && col.topCategories.length > 0) {
      const topStr = col.topCategories
        .slice(0, 5)
        .map((c) => `"${c.value}": ${c.count} (${c.percentage}%)`)
        .join(', ');
      payload += `  Top Frequencies: ${topStr}\n`;
    }
  }

  if (profile.findings && profile.findings.length > 0) {
    payload += `\nDeterministic Findings Detected (${profile.findings.length}):\n`;
    for (const f of profile.findings) {
      const approxStr = f.approximate ? ' (approx)' : '';
      payload += `- [${f.severity.toUpperCase()}] ${f.code}: ${f.title} (Count: ${f.count}${approxStr})\n`;
    }
  }

  payload += `</DATA_SUMMARY>`;
  return payload;
}
