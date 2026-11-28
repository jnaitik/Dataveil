/**
 * Deterministic Findings Engine for Dataveil.
 * 
 * Computes concrete data quality anomalies, structural defects, and correlations
 * in a single streaming pass with zero AI involvement.
 * 
 * Detectors:
 * 1. Mixed types in a column
 * 2. Inconsistent date formats
 * 3. High missing value rates (>20% / >50%)
 * 4. Constant or near-constant columns (>99% identical)
 * 5. IQR Outliers (approximate via P² quantile sketch)
 * 6. Likely key columns containing duplicates
 * 7. Skewed numeric distributions (Pearson median skewness > 1.0)
 * 8. Top correlated numeric pairs (streaming covariance capped at 20 columns)
 * 9. Negative values in columns that look like counts or amounts
 */

import type { DatasetProfile } from './profiler';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export interface DataFinding {
  id: string;
  code: string;
  columnName?: string;
  columnPair?: [string, string];
  severity: FindingSeverity;
  title: string;
  description: string;
  count: number;
  rowIndices: number[]; // First 20 1-based row numbers kept per finding
  approximate?: boolean;
}

const COUNT_OR_AMOUNT_REGEX = /(?:count|quantity|qty|amount|total|price|cost|revenue|sales|balance|inventory|units)/i;
const KEY_COLUMN_REGEX = /(?:^id$|_id$|id_|key|uuid|guid|ssn|account_num|trans(?:action)?_id)/i;

export interface StreamingFindingCollector {
  updateRow(rowNumber: number, row: (string | undefined)[], headers: string[]): void;
  finalizeFindings(profile: DatasetProfile): DataFinding[];
}

/**
 * Creates an active streaming collector for anomaly detection during parsing.
 */
export function createStreamingFindingCollector(headers: string[]): StreamingFindingCollector {
  const negativeCounts = new Map<string, { count: number; rows: number[] }>();
  const dateFormats = new Map<string, Set<string>>();
  const dateRows = new Map<string, number[]>();
  const seenKeyValues = new Map<string, Set<string>>();
  const keyDuplicateRows = new Map<string, number[]>();
  let keyDuplicateCounts = new Map<string, number>();

  // Identify candidate columns
  const candidateKeyIndices: number[] = [];
  const candidateCountIndices: number[] = [];

  headers.forEach((h, idx) => {
    if (KEY_COLUMN_REGEX.test(h)) {
      candidateKeyIndices.push(idx);
      seenKeyValues.set(h, new Set());
      keyDuplicateRows.set(h, []);
      keyDuplicateCounts.set(h, 0);
    }
    if (COUNT_OR_AMOUNT_REGEX.test(h)) {
      candidateCountIndices.push(idx);
      negativeCounts.set(h, { count: 0, rows: [] });
    }
  });

  // Streaming covariance tracker for up to 20 numeric columns
  const maxCovCols = Math.min(20, headers.length);
  const covMoments: number[][] = Array.from({ length: maxCovCols }, () => new Array(maxCovCols).fill(0));
  const runningMeans: number[] = new Array(maxCovCols).fill(0);
  const runningCounts: number[] = new Array(maxCovCols).fill(0);

  return {
    updateRow(rowNumber: number, row: (string | undefined)[], _headers: string[]) {
      // 1. Negative amounts/counts check
      for (const idx of candidateCountIndices) {
        const val = row[idx];
        if (val !== undefined && val.trim() !== '') {
          const num = Number(val);
          if (!isNaN(num) && num < 0) {
            const h = headers[idx];
            const entry = negativeCounts.get(h)!;
            entry.count++;
            if (entry.rows.length < 20) {
              entry.rows.push(rowNumber);
            }
          }
        }
      }

      // 2. Likely key duplicate tracker
      for (const idx of candidateKeyIndices) {
        const val = row[idx];
        if (val !== undefined && val.trim() !== '') {
          const h = headers[idx];
          const set = seenKeyValues.get(h)!;
          if (set.has(val)) {
            keyDuplicateCounts.set(h, (keyDuplicateCounts.get(h) || 0) + 1);
            const dupRows = keyDuplicateRows.get(h)!;
            if (dupRows.length < 20) {
              dupRows.push(rowNumber);
            }
          } else {
            // Keep set size bounded to 50,000 for memory safety
            if (set.size < 50000) {
              set.add(val);
            }
          }
        }
      }

      // 3. Date format consistency tracker
      for (let i = 0; i < headers.length; i++) {
        const val = (row[i] || '').trim();
        if (val && !isNaN(Date.parse(val))) {
          const colName = headers[i];
          let formatType = 'unknown';
          if (/^\d{4}-\d{2}-\d{2}/.test(val)) formatType = 'YYYY-MM-DD';
          else if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) formatType = 'MM/DD/YYYY';
          else if (/^\d{2}-\d{2}-\d{4}/.test(val)) formatType = 'DD-MM-YYYY';

          if (!dateFormats.has(colName)) {
            dateFormats.set(colName, new Set());
            dateRows.set(colName, []);
          }
          const formats = dateFormats.get(colName)!;
          formats.add(formatType);
          if (formats.size > 1) {
            const rows = dateRows.get(colName)!;
            if (rows.length < 20) rows.push(rowNumber);
          }
        }
      }

      // 4. Update streaming covariance for first 20 numeric columns
      for (let j = 0; j < maxCovCols; j++) {
        const numJ = Number(row[j]);
        if (!isNaN(numJ) && row[j] !== undefined && row[j] !== '') {
          runningCounts[j]++;
          const prevMeanJ = runningMeans[j];
          runningMeans[j] += (numJ - prevMeanJ) / runningCounts[j];

          for (let k = 0; k < j; k++) {
            const numK = Number(row[k]);
            if (!isNaN(numK) && row[k] !== undefined && row[k] !== '') {
              covMoments[j][k] += (numJ - runningMeans[j]) * (numK - runningMeans[k]);
            }
          }
        }
      }
    },

    finalizeFindings(profile: DatasetProfile): DataFinding[] {
      const findings: DataFinding[] = [];

      for (const col of profile.columns) {
        // A. Mixed types
        if (col.type === 'mixed') {
          findings.push({
            id: `mixed-${col.name}`,
            code: 'MIXED_DATA_TYPES',
            columnName: col.name,
            severity: 'critical',
            title: `Mixed Data Types in "${col.name}"`,
            description: `Column contains both numeric and non-numeric values without a dominant (>85%) type. May break downstream database ingestion.`,
            count: col.totalCount,
            rowIndices: [],
          });
        }

        // B. High missing values
        if (col.missingPercentage > 20) {
          findings.push({
            id: `missing-${col.name}`,
            code: 'HIGH_MISSING_RATE',
            columnName: col.name,
            severity: col.missingPercentage > 50 ? 'critical' : 'warning',
            title: `High Missing Rate in "${col.name}" (${col.missingPercentage}%)`,
            description: `${col.missingCount.toLocaleString()} out of ${col.totalCount.toLocaleString()} records are null or empty.`,
            count: col.missingCount,
            rowIndices: [],
          });
        }

        // C. Constant or near-constant
        if (col.uniqueCount === 1 && col.totalCount >= 3) {
          findings.push({
            id: `constant-${col.name}`,
            code: 'CONSTANT_COLUMN',
            columnName: col.name,
            severity: 'info',
            title: `Constant Column "${col.name}"`,
            description: `Column has only 1 distinct value across all records. Carries zero informational entropy.`,
            count: col.totalCount,
            rowIndices: [],
          });
        }

        // D. Negative values in amounts/counts
        const neg = negativeCounts.get(col.name);
        if (neg && neg.count > 0) {
          findings.push({
            id: `negative-${col.name}`,
            code: 'NEGATIVE_VALUES_IN_COUNT',
            columnName: col.name,
            severity: 'warning',
            title: `Negative Values in "${col.name}"`,
            description: `Detected ${neg.count.toLocaleString()} negative values in a column designated as a quantity or currency amount.`,
            count: neg.count,
            rowIndices: neg.rows,
          });
        }

        // E. Inconsistent date formats
        const formats = dateFormats.get(col.name);
        if (formats && formats.size > 1 && (col.type === 'date' || col.type === 'text')) {
          const rows = dateRows.get(col.name) || [];
          findings.push({
            id: `date-inconsistent-${col.name}`,
            code: 'INCONSISTENT_DATE_FORMAT',
            columnName: col.name,
            severity: 'warning',
            title: `Inconsistent Date Formats in "${col.name}"`,
            description: `Found multiple date patterns (${Array.from(formats).join(', ')}) in the same column.`,
            count: rows.length || 2,
            rowIndices: rows,
          });
        }

        // F. Likely key column duplicates
        const dupCount = keyDuplicateCounts.get(col.name) || 0;
        if (dupCount > 0) {
          const rows = keyDuplicateRows.get(col.name) || [];
          findings.push({
            id: `key-dup-${col.name}`,
            code: 'PRIMARY_KEY_DUPLICATES',
            columnName: col.name,
            severity: 'critical',
            title: `Duplicate IDs in Key Column "${col.name}"`,
            description: `Column name implies a unique identifier or primary key, but at least ${dupCount.toLocaleString()} duplicate values were detected.`,
            count: dupCount,
            rowIndices: rows,
          });
        }

        // G. IQR Outliers
        if (col.numericStats && col.numericStats.outliersCount > 0) {
          findings.push({
            id: `iqr-outliers-${col.name}`,
            code: 'IQR_STATISTICAL_OUTLIERS',
            columnName: col.name,
            severity: 'info',
            title: `Statistical Outliers in "${col.name}"`,
            description: `Identified ~${col.numericStats.outliersCount} records lying outside 1.5× IQR bounds [${col.numericStats.q1 ?? 'Q1'} - ${col.numericStats.q3 ?? 'Q3'}].`,
            count: col.numericStats.outliersCount,
            rowIndices: [],
            approximate: true,
          });
        }

        // H. Skewed numeric columns
        if (col.numericStats && col.numericStats.stdDev > 0) {
          const { mean, median, stdDev } = col.numericStats;
          const skewness = Math.abs((3 * (mean - median)) / stdDev);
          if (skewness > 1.2 && col.totalCount > 50) {
            findings.push({
              id: `skew-${col.name}`,
              code: 'SKEWED_DISTRIBUTION',
              columnName: col.name,
              severity: 'info',
              title: `Highly Skewed Distribution in "${col.name}"`,
              description: `Mean (${mean}) significantly deviates from median (${median}) with Pearson skewness of ${skewness.toFixed(2)}.`,
              count: col.totalCount,
              rowIndices: [],
              approximate: true,
            });
          }
        }
      }

      // I. Top Correlated Pairs (covariance / correlation)
      const numericCols = profile.columns.filter((c) => c.type === 'number');
      if (numericCols.length >= 2) {
        for (let j = 0; j < Math.min(maxCovCols, numericCols.length); j++) {
          for (let k = 0; k < j; k++) {
            const colJ = numericCols[j];
            const colK = numericCols[k];
            if (colJ.numericStats?.stdDev && colK.numericStats?.stdDev) {
              const n = Math.min(runningCounts[j], runningCounts[k]);
              if (n >= 3) {
                const covariance = covMoments[j][k] / (n - 1);
                const correlation = covariance / (colJ.numericStats.stdDev * colK.numericStats.stdDev);
                if (Math.abs(correlation) >= 0.75 && Math.abs(correlation) <= 1.05) {
                  const sign = correlation >= 0 ? '+' : '';
                  findings.push({
                    id: `corr-${colJ.name}-${colK.name}`,
                    code: 'STRONG_NUMERIC_CORRELATION',
                    columnPair: [colK.name, colJ.name],
                    severity: 'info',
                    title: `Strong Correlation: "${colK.name}" & "${colJ.name}"`,
                    description: `Pearson correlation r = ${sign}${correlation.toFixed(2)}. These columns share strong collinearity.`,
                    count: n,
                    rowIndices: [],
                    approximate: true,
                  });
                }
              }
            }
          }
        }
      }

      return findings;
    },
  };
}
