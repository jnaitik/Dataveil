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
  isEstimated?: boolean;
}

export interface ColumnProfile {
  name: string;
  type: InferredColumnType;
  totalCount: number;
  missingCount: number;
  missingPercentage: number;
  uniqueCount: number;
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
  delimiter: string;
  columns: ColumnProfile[];
  previewRows: Record<string, string>[];
  warnings: string[];
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
  const nameSuspect = [
    'email',
    'phone',
    'ssn',
    'socialsecurity',
    'passport',
    'creditcard',
    'cardnumber',
    'address',
    'pwd',
    'password',
  ].some((kw) => lower.includes(kw));
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
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, outliersCount: 0, isEstimated: false };
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
    isEstimated: false,
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

/**
 * IncrementalProfiler calculates streaming statistics across chunked records.
 * Memory complexity is O(1) with respect to total row count, enabling safe 500 MB streaming.
 */
export class IncrementalProfiler {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  private delimiter: string;

  private rowCount = 0;
  private cleanHeaders: string[] = [];
  private isHeadersInitialized = false;
  private previewRows: Record<string, string>[] = [];
  private warnings: string[] = [];

  // Per-column incremental statistics
  private missingCounts: number[] = [];
  private nonMissingCounts: number[] = [];
  private typeCounts: Array<{ num: number; bool: number; date: number; text: number }> = [];

  // Welford's streaming numeric accumulator (mean, variance) + reservoir sample for median/IQR
  private numStats: Array<{
    min: number;
    max: number;
    count: number;
    mean: number;
    M2: number;
    reservoir: number[];
  }> = [];

  // Distinct category frequencies (bounded to max 1,000 distinct items per column)
  private categoryCounts: Array<Map<string, number>> = [];
  private sampleValuesMap: Array<Set<string>> = [];

  // Bounded duplicate detection (max 25,000 hashes)
  private rowHashes = new Set<string>();
  private duplicateRowCount = 0;
  private isDuplicateCapped = false;

  constructor(fileName: string, fileSizeBytes: number, delimiter = ',') {
    this.fileName = fileName;
    this.fileSizeBytes = fileSizeBytes;
    this.delimiter = delimiter;
  }

  setDelimiter(delimiter: string): void {
    if (delimiter) {
      this.delimiter = delimiter;
    }
  }

  /**
   * Set headers if provided separately or from the first row of CSV
   */
  setHeaders(headers: string[]): void {
    if (this.isHeadersInitialized) return;
    this.cleanHeaders = cleanHeaderNames(headers);
    this.isHeadersInitialized = true;
    this.initializeColumnAccumulators(this.cleanHeaders.length);
  }

  private initializeColumnAccumulators(count: number): void {
    for (let i = 0; i < count; i++) {
      this.missingCounts.push(0);
      this.nonMissingCounts.push(0);
      this.typeCounts.push({ num: 0, bool: 0, date: 0, text: 0 });
      this.numStats.push({
        min: Infinity,
        max: -Infinity,
        count: 0,
        mean: 0,
        M2: 0,
        reservoir: [],
      });
      this.categoryCounts.push(new Map());
      this.sampleValuesMap.push(new Set());
    }
  }

  /**
   * Process a batch of rows streaming from PapaParse
   */
  addRows(rows: string[][]): void {
    if (rows.length === 0) return;

    let startIndex = 0;
    if (!this.isHeadersInitialized) {
      this.setHeaders(rows[0]);
      startIndex = 1;
    }

    const colCount = this.cleanHeaders.length;

    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      if (!row || (row.length === 1 && row[0].trim() === '')) {
        continue; // skip empty rows
      }

      this.rowCount++;

      // 1. Maintain preview rows (first 50)
      if (this.previewRows.length < 50) {
        const previewObj: Record<string, string> = {};
        for (let c = 0; c < colCount; c++) {
          previewObj[this.cleanHeaders[c]] = row[c] !== undefined ? String(row[c]) : '';
        }
        this.previewRows.push(previewObj);
      }

      // 2. Bounded duplicate row detection
      if (!this.isDuplicateCapped) {
        // Fast hash signature of first 5 columns + row length
        const hash = row.length <= 5 ? row.join('|||') : `${row.slice(0, 5).join('|||')}_len${row.length}`;
        if (this.rowHashes.has(hash)) {
          this.duplicateRowCount++;
        } else {
          this.rowHashes.add(hash);
          if (this.rowHashes.size >= 25000) {
            this.isDuplicateCapped = true;
            this.warnings.push(
              'Dataset exceeds 25,000 distinct row signatures. Duplicate count bounded for memory safety.'
            );
          }
        }
      }

      // 3. Process each column value incrementally
      for (let c = 0; c < colCount; c++) {
        const rawVal = row[c] !== undefined ? String(row[c]) : '';
        const trimmed = rawVal.trim();
        const lower = trimmed.toLowerCase();

        if (MISSING_VALUES.has(lower)) {
          this.missingCounts[c]++;
          continue;
        }

        this.nonMissingCounts[c]++;

        // Sample values (up to 5 unique samples)
        if (this.sampleValuesMap[c].size < 5) {
          this.sampleValuesMap[c].add(trimmed);
        }

        // Type inference accumulation
        const tc = this.typeCounts[c];
        const num = Number(trimmed);

        if (BOOLEAN_VALUES.has(lower)) {
          tc.bool++;
        } else if (!isNaN(num) && trimmed !== '') {
          tc.num++;
          // Welford's algorithm for running mean and variance
          const ns = this.numStats[c];
          ns.count++;
          if (num < ns.min) ns.min = num;
          if (num > ns.max) ns.max = num;

          const delta = num - ns.mean;
          ns.mean += delta / ns.count;
          const delta2 = num - ns.mean;
          ns.M2 += delta * delta2;

          // Reservoir sampling (up to 10,000 values) for exact/representative median & IQR
          if (ns.reservoir.length < 10000) {
            ns.reservoir.push(num);
          } else {
            const j = Math.floor(Math.random() * ns.count);
            if (j < 10000) {
              ns.reservoir[j] = num;
            }
          }
        } else if (DATE_REGEX.test(trimmed) && !isNaN(Date.parse(trimmed))) {
          tc.date++;
        } else {
          tc.text++;
        }

        // Category frequency (bounded to 1,000 keys)
        const catMap = this.categoryCounts[c];
        if (catMap.size < 1000 || catMap.has(trimmed)) {
          catMap.set(trimmed, (catMap.get(trimmed) || 0) + 1);
        }
      }
    }
  }

  /**
   * Finalize the streaming accumulation and emit the DatasetProfile
   */
  finalize(): DatasetProfile {
    const colCount = this.cleanHeaders.length;
    const columns: ColumnProfile[] = [];

    if (this.rowCount > 500000) {
      this.warnings.push(
        `High-volume dataset (${this.rowCount.toLocaleString()} rows). Profiling computed via streaming Web Worker; preview bounded to first 50 rows.`
      );
    }

    for (let c = 0; c < colCount; c++) {
      const colName = this.cleanHeaders[c];
      const totalCount = this.rowCount;
      const missingCount = this.missingCounts[c];
      const nonMissing = this.nonMissingCounts[c];
      const missingPercentage = totalCount > 0 ? Math.round((missingCount / totalCount) * 1000) / 10 : 0;

      // Infer column type
      const tc = this.typeCounts[c];
      let type: InferredColumnType = 'text';

      if (nonMissing > 0) {
        const threshold = nonMissing * 0.85;
        if (tc.bool >= threshold) type = 'boolean';
        else if (tc.num >= threshold) type = 'number';
        else if (tc.date >= threshold) type = 'date';
        else if (tc.num > 0 && tc.num < threshold && nonMissing > 5) type = 'mixed';
        else type = 'text';
      }

      // Unique count
      const uniqueCount = this.categoryCounts[c].size;
      const samples = Array.from(this.sampleValuesMap[c]);
      const isPiiSuspect = detectPiiSuspect(colName, samples);

      // Numeric stats
      let numericStats: NumericStats | undefined;
      if (type === 'number') {
        const ns = this.numStats[c];
        if (ns.count > 0) {
          const variance = ns.count > 1 ? ns.M2 / ns.count : 0;
          const stdDev = Math.sqrt(variance);

          // Median and IQR from reservoir
          const sorted = [...ns.reservoir].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

          const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
          const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          const outliersCount = sorted.filter((n) => n < lowerBound || n > upperBound).length;

          numericStats = {
            min: Math.round(ns.min * 100) / 100,
            max: Math.round(ns.max * 100) / 100,
            mean: Math.round(ns.mean * 100) / 100,
            median: Math.round(median * 100) / 100,
            stdDev: Math.round(stdDev * 100) / 100,
            outliersCount,
            isEstimated: ns.count > 10000,
          };
        } else {
          numericStats = {
            min: 0,
            max: 0,
            mean: 0,
            median: 0,
            stdDev: 0,
            outliersCount: 0,
            isEstimated: false,
          };
        }
      }

      // Top categories
      let topCategories: CategoryFrequency[] | undefined;
      if (type === 'text' || type === 'boolean') {
        if (uniqueCount <= 25 || uniqueCount / (totalCount || 1) <= 0.3) {
          const map = this.categoryCounts[c];
          topCategories = Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([value, count]) => ({
              value,
              count,
              percentage: nonMissing > 0 ? Math.round((count / nonMissing) * 1000) / 10 : 0,
            }));
        }
      }

      columns.push({
        name: colName,
        type,
        totalCount,
        missingCount,
        missingPercentage,
        uniqueCount,
        numericStats,
        topCategories,
        isPiiSuspect,
        sampleValues: samples,
      });
    }

    return {
      fileName: this.fileName,
      fileSizeBytes: this.fileSizeBytes,
      rowCount: this.rowCount,
      columnCount: colCount,
      duplicateRowCount: this.duplicateRowCount,
      delimiter: this.delimiter,
      columns,
      previewRows: this.previewRows,
      warnings: this.warnings,
    };
  }
}

/**
 * Backwards-compatible profileCsvData for in-memory / unit-test invocation.
 */
export function profileCsvData(
  fileName: string,
  rawHeaders: string[],
  rows: string[][],
  fileSizeBytes: number,
  delimiter = ','
): DatasetProfile {
  const profiler = new IncrementalProfiler(fileName, fileSizeBytes, delimiter);
  profiler.setHeaders(rawHeaders);
  profiler.addRows(rows);
  return profiler.finalize();
}
