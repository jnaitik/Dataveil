import Papa from 'papaparse';
import {
  ColumnAccumulator,
  ReservoirSampler,
  HyperLogLog,
} from './accumulators';
import {
  cleanHeaderNames,
  detectPiiSuspect,
  type DatasetProfile,
  type ColumnProfile,
  type NumericStats,
} from './profiler';
import { createStreamingFindingCollector, type StreamingFindingCollector } from './findings';

export interface StreamingProgress {
  bytesRead: number;
  totalBytes: number;
  rowsRead: number;
  rowsPerSecond: number;
  etaSeconds: number;
  percent: number;
}

export interface StreamingProfilerOptions {
  fileName: string;
  fileSizeBytes: number;
  onProgress?: (progress: StreamingProgress) => void;
  abortSignal?: AbortSignal;
  chunkSize?: number; // bytes, default 2MB
}

export const MAX_COLUMNS_LIMIT = 500;
export const MAX_FILE_SIZE_LIMIT = 500 * 1024 * 1024; // 500 MB
export const MAX_LINE_LENGTH_GUARD = 1024 * 1024; // 1 MB line guard

/**
 * Single-Pass Streaming Profiler for CSV datasets up to 500 MB.
 * Computes deterministic accumulators (Welford, P², HLL, Space-Saving)
 * row-by-row without ever holding all rows in memory.
 */
export function streamAndProfileCsv(
  input: File | Blob | string,
  options: StreamingProfilerOptions
): Promise<DatasetProfile> {
  return new Promise((resolve, reject) => {
    const {
      fileName,
      fileSizeBytes,
      onProgress,
      abortSignal,
      chunkSize = 2 * 1024 * 1024,
    } = options;

    if (fileSizeBytes > MAX_FILE_SIZE_LIMIT) {
      return reject(new Error('File exceeds the 500 MB hard limit. Maximum supported size is 500 MB.'));
    }

    const warnings: string[] = [];
    let headers: string[] = [];
    let accumulators: ColumnAccumulator[] = [];
    let findingsCollector: StreamingFindingCollector | null = null;
    const reservoir = new ReservoirSampler<Record<string, string>>(50);
    const rowHll = new HyperLogLog();

    let totalRows = 0;
    let raggedRowCount = 0;
    let delimiter = ',';
    let isHeaderProcessed = false;
    let parserRef: Papa.Parser | null = null;

    const startTime = performance.now();
    let lastProgressTime = 0;

    if (abortSignal) {
      if (abortSignal.aborted) {
        return reject(new DOMException('Parsing aborted by user', 'AbortError'));
      }
      abortSignal.addEventListener('abort', () => {
        if (parserRef) {
          try {
            parserRef.abort();
          } catch {
            // ignore
          }
        }
        reject(new DOMException('Parsing aborted by user', 'AbortError'));
      });
    }

    Papa.parse<string[]>(input as any, {
      header: false,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      chunkSize,
      chunk: (results, parser) => {
        parserRef = parser;

        if (abortSignal?.aborted) {
          try {
            parser.abort();
          } catch {
            // ignore
          }
          reject(new DOMException('Parsing aborted by user', 'AbortError'));
          return;
        }

        if (!delimiter && results.meta.delimiter) {
          delimiter = results.meta.delimiter;
        } else if (results.meta.delimiter && delimiter === ',') {
          delimiter = results.meta.delimiter;
        }

        const data = results.data;
        if (!data || data.length === 0) return;

        let startRowIdx = 0;

        // Process headers from first chunk
        if (!isHeaderProcessed) {
          const rawHeaders = data[0];
          headers = cleanHeaderNames(rawHeaders);

          if (headers.length > MAX_COLUMNS_LIMIT) {
            warnings.push(
              `Dataset contains ${headers.length} columns; capped at first ${MAX_COLUMNS_LIMIT} columns for browser performance.`
            );
            headers = headers.slice(0, MAX_COLUMNS_LIMIT);
          }

          accumulators = headers.map((colName) => new ColumnAccumulator(colName));
          findingsCollector = createStreamingFindingCollector(headers);
          isHeaderProcessed = true;
          startRowIdx = 1;
        }

        // Process rows in this chunk
        for (let r = startRowIdx; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;

          // Check line length guard
          let rowCharCount = 0;
          for (let i = 0; i < row.length; i++) {
            rowCharCount += (row[i] || '').length;
          }
          if (rowCharCount > MAX_LINE_LENGTH_GUARD) {
            warnings.push(`Row ${totalRows + 1} exceeded 1MB line length limit; skipped.`);
            continue;
          }

          // Ragged row handling
          if (row.length !== headers.length) {
            raggedRowCount++;
          }

          totalRows++;

          // Duplicate row tracking via HLL
          const rowKey = row.join('|||');
          rowHll.add(rowKey);

          // Reservoir sampling for preview rows (max 50)
          const rowObj: Record<string, string> = {};
          for (let c = 0; c < headers.length; c++) {
            const val = row[c] !== undefined ? String(row[c]) : '';
            rowObj[headers[c]] = val;
          }
          reservoir.add(rowObj);

          // Update accumulators for each column
          for (let c = 0; c < headers.length; c++) {
            accumulators[c].update(row[c]);
          }

          // Update findings detector
          findingsCollector?.updateRow(totalRows, row, headers);
        }

        // Throttled progress reporting (every ~100 ms)
        const now = performance.now();
        if (onProgress && now - lastProgressTime >= 100) {
          const elapsedSec = (now - startTime) / 1000;
          const bytesRead = Math.min(fileSizeBytes, results.meta.cursor || 0);
          const percent = fileSizeBytes > 0 ? Math.min(100, Math.round((bytesRead / fileSizeBytes) * 100)) : 100;
          const rowsPerSecond = elapsedSec > 0 ? Math.round(totalRows / elapsedSec) : 0;
          const bytesPerSec = elapsedSec > 0 ? bytesRead / elapsedSec : 1;
          const remainingBytes = Math.max(0, fileSizeBytes - bytesRead);
          const etaSeconds = Math.round(remainingBytes / (bytesPerSec || 1));

          onProgress({
            bytesRead,
            totalBytes: fileSizeBytes,
            rowsRead: totalRows,
            rowsPerSecond,
            etaSeconds,
            percent,
          });
          lastProgressTime = now;
        }
      },
      complete: () => {
        if (abortSignal?.aborted) {
          return reject(new DOMException('Parsing aborted by user', 'AbortError'));
        }

        if (!isHeaderProcessed || headers.length === 0) {
          return reject(new Error('The provided CSV file contains no readable rows or headers.'));
        }

        if (raggedRowCount > 0) {
          warnings.push(`Detected ${raggedRowCount} ragged rows with mismatched column counts.`);
        }

        // Estimate duplicate rows from HLL
        const distinctRowsHll = rowHll.count();
        const duplicateRowCount = Math.max(0, totalRows - distinctRowsHll);

        // Build column profiles
        const columns: ColumnProfile[] = accumulators.map((acc) => {
          const type = acc.inferFinalType();
          const missingPercentage =
            totalRows > 0 ? Math.round((acc.missingCount / totalRows) * 1000) / 10 : 0;
          const uniqueCount = acc.hll.count();
          const isPiiSuspect = detectPiiSuspect(acc.name, acc.sampleValues);

          let numericStats: NumericStats | undefined;
          if (type === 'number' && acc.welford.count > 0) {
            const min = acc.welford.min;
            const max = acc.welford.max;
            const mean = acc.welford.mean;
            const median = acc.medianEst.estimate;
            const stdDev = acc.welford.stdDev;
            const q1 = acc.q1Est.estimate;
            const q3 = acc.q3Est.estimate;
            const outliersCount = acc.computeOutliersCount();

            numericStats = {
              min: Math.round(min * 100) / 100,
              max: Math.round(max * 100) / 100,
              mean: Math.round(mean * 100) / 100,
              median: Math.round(median * 100) / 100,
              stdDev: Math.round(stdDev * 100) / 100,
              outliersCount,
              q1: Math.round(q1 * 100) / 100,
              q3: Math.round(q3 * 100) / 100,
              exact: {
                min: true,
                max: true,
                mean: true,
                median: false, // P² quantile estimate
                stdDev: true,
                outliersCount: false, // approximate
              },
            };
          }

          let topCategories = undefined;
          if (type === 'text' || type === 'boolean') {
            topCategories = acc.spaceSaving.getTop(5, totalRows - acc.missingCount);
          }

          return {
            name: acc.name,
            type,
            totalCount: totalRows,
            missingCount: acc.missingCount,
            missingPercentage,
            uniqueCount,
            uniqueCountExact: false, // HLL estimate
            numericStats,
            topCategories,
            isPiiSuspect,
            sampleValues: acc.sampleValues,
          };
        });

        const profile: DatasetProfile = {
          fileName,
          fileSizeBytes,
          rowCount: totalRows,
          columnCount: headers.length,
          duplicateRowCount,
          duplicateRowCountExact: false, // HLL estimate
          raggedRowCount,
          delimiter: delimiter || ',',
          columns,
          previewRows: reservoir.getSample(),
          warnings,
          isStreamingProfile: true,
        };

        profile.findings = findingsCollector ? findingsCollector.finalizeFindings(profile) : [];

        resolve(profile);
      },
      error: (error) => {
        reject(new Error(`Streaming CSV parsing failed: ${error.message}`));
      },
    });
  });
}
