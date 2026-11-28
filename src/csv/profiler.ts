import { createStreamingFindingCollector, type DataFinding } from './findings';

export type InferredColumnType = 'number' | 'text' | 'date' | 'boolean' | 'mixed';

export interface CategoryFrequency {
  value: string;
  count: number;
  percentage: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  outliersCount: number;
  q1?: number;
  q3?: number;
  exact?: {
    min: boolean;
    max: boolean;
    mean: boolean;
    median: boolean;
    stdDev: boolean;
    outliersCount: boolean;
  };
}

export interface ColumnProfile {
  name: string;
  type: InferredColumnType;
  totalCount: number;
  missingCount: number;
  missingPercentage: number;
  uniqueCount: number;
  uniqueCountExact?: boolean;
  numericStats?: NumericStats;
  topCategories?: CategoryFrequency[];
  isPiiSuspect: boolean;
  sampleValues: string[];
}

export interface DatasetProfile {
  fileName: string;
  fileSizeBytes: number;
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  duplicateRowCountExact?: boolean;
  raggedRowCount?: number;
  delimiter: string;
  columns: ColumnProfile[];
  previewRows: Record<string, string>[];
  warnings: string[];
  findings?: DataFinding[];
  isStreamingProfile?: boolean;
}

const MISSING_VALUES = new Set(['', 'null', 'none', 'nan', 'na', 'n/a', '-', 'undefined', '?']);
const DATE_REGEX = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;
const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 't', 'f']);

export function cleanHeaderNames(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((header, idx) => {
    let clean = (header || '').trim().replace(/^\uFEFF/, '');
    if (!clean) {
      clean = `Column_${idx + 1}`;
    }
    const lower = clean.toLowerCase();
    const count = seen.get(lower) || 0;
    seen.set(lower, count + 1);
    if (count > 0) {
      return `${clean}_${count + 1}`;
    }
    return clean;
  });
}

export function detectPiiSuspect(columnName: string, samples: string[]): boolean {
  const lower = columnName.toLowerCase();
  const nameSuspect = ['email', 'phone', 'ssn', 'socialsecurity', 'passport', 'creditcard', 'cardnumber', 'address', 'pwd', 'password'].some(
    (kw) => lower.includes(kw)
  );
  if (nameSuspect) return true;

  // Sample check: email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return samples.some((s) => emailRegex.test(s));
}

export function inferType(values: string[]): InferredColumnType {
  const nonMissing = values.filter((v) => !MISSING_VALUES.has(v.trim().toLowerCase()));
  if (nonMissing.length === 0) return 'text';

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const val of nonMissing) {
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();

    if (BOOLEAN_VALUES.has(lower)) {
      boolCount++;
    } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
      numCount++;
    } else if (DATE_REGEX.test(trimmed) && !isNaN(Date.parse(trimmed))) {
      dateCount++;
    }
  }

  const threshold = nonMissing.length * 0.85;

  if (boolCount >= threshold) return 'boolean';
  if (numCount >= threshold) return 'number';
  if (dateCount >= threshold) return 'date';

  if (numCount > 0 && numCount < threshold && nonMissing.length > 5) {
    return 'mixed';
  }

  return 'text';
}

export function computeNumericStats(numbers: number[]): NumericStats {
  if (numbers.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, outliersCount: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const mean = sum / sorted.length;

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Standard deviation
  const variance = sorted.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  // Outlier detection via IQR
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliersCount = sorted.filter((n) => n < lowerBound || n > upperBound).length;

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    outliersCount,
  };
}

export function computeTopCategories(values: string[], maxCategories = 5): CategoryFrequency[] {
  const counts = new Map<string, number>();
  let totalNonMissing = 0;

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!MISSING_VALUES.has(trimmed.toLowerCase())) {
      totalNonMissing++;
      counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
    }
  }

  if (totalNonMissing === 0) return [];

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCategories)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / totalNonMissing) * 1000) / 10,
    }));
}

export function profileCsvData(
  fileName: string,
  rawHeaders: string[],
  rows: string[][],
  fileSizeBytes: number,
  delimiter = ','
): DatasetProfile {
  const warnings: string[] = [];

  if (rows.length > 50000) {
    warnings.push(`Dataset contains ${rows.length} rows. Profile analysis was computed over the full table, but preview is limited.`);
  }

  const headers = cleanHeaderNames(rawHeaders);
  const rowCount = rows.length;
  const columnCount = headers.length;

  // Duplicate rows detection
  const rowHashes = new Set<string>();
  let duplicateRowCount = 0;

  for (const row of rows) {
    const rowKey = row.join('|||');
    if (rowHashes.has(rowKey)) {
      duplicateRowCount++;
    } else {
      rowHashes.add(rowKey);
    }
  }

  // Column profiling
  const columns: ColumnProfile[] = headers.map((colName, colIdx) => {
    const colValues: string[] = [];

    for (const row of rows) {
      colValues.push(row[colIdx] !== undefined ? String(row[colIdx]) : '');
    }

    const missingCount = colValues.filter((v) => MISSING_VALUES.has(v.trim().toLowerCase())).length;
    const missingPercentage = rowCount > 0 ? Math.round((missingCount / rowCount) * 1000) / 10 : 0;

    const uniqueSet = new Set(colValues.filter((v) => !MISSING_VALUES.has(v.trim().toLowerCase())));
    const uniqueCount = uniqueSet.size;

    const type = inferType(colValues);
    const sampleValues = Array.from(uniqueSet).slice(0, 5);
    const isPiiSuspect = detectPiiSuspect(colName, sampleValues);

    let numericStats: NumericStats | undefined;
    if (type === 'number') {
      const numbers = colValues
        .map((v) => Number(v.trim()))
        .filter((n) => !isNaN(n));
      numericStats = computeNumericStats(numbers);
    }

    let topCategories: CategoryFrequency[] | undefined;
    if (type === 'text' || type === 'boolean') {
      if (uniqueCount <= 25 || uniqueCount / (rowCount || 1) <= 0.3) {
        topCategories = computeTopCategories(colValues);
      }
    }

    return {
      name: colName,
      type,
      totalCount: rowCount,
      missingCount,
      missingPercentage,
      uniqueCount,
      numericStats,
      topCategories,
      isPiiSuspect,
      sampleValues,
    };
  });

  // Preview rows (max 50)
  const previewRows: Record<string, string>[] = rows.slice(0, 50).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] !== undefined ? String(row[idx]) : '';
    });
    return obj;
  });

  const baseProfile: DatasetProfile = {
    fileName,
    fileSizeBytes,
    rowCount,
    columnCount,
    duplicateRowCount,
    delimiter,
    columns,
    previewRows,
    warnings,
  };

  const findingsCollector = createStreamingFindingCollector(headers);
  rows.forEach((row, rIdx) => {
    findingsCollector.updateRow(rIdx + 1, row, headers);
  });
  baseProfile.findings = findingsCollector.finalizeFindings(baseProfile);

  return baseProfile;
}
