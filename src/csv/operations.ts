import type { DatasetProfile } from './profiler';
import Papa from 'papaparse';

export interface QueryOperation {
  type: 'count' | 'sum' | 'mean' | 'min' | 'max' | 'groupBy';
  targetColumn?: string;
  groupColumn?: string;
  aggregate?: 'count' | 'sum' | 'mean';
  filter?: {
    column: string;
    value: string;
  };
}

export interface OperationResult {
  humanReadableQuery: string;
  resultType: 'scalar' | 'table';
  scalarValue?: number;
  tableData?: Array<{ group: string; value: number }>;
  warning?: string;
}

export const MAX_GROUP_CARDINALITY = 10000;

export function validateOperation(op: QueryOperation, profile: DatasetProfile): { valid: boolean; error?: string } {
  const colMap = new Map(profile.columns.map((c) => [c.name.toLowerCase(), c]));

  if (op.filter) {
    if (!colMap.has(op.filter.column.toLowerCase())) {
      return { valid: false, error: `Filter column "${op.filter.column}" does not exist in dataset.` };
    }
  }

  if (op.type === 'count') {
    return { valid: true };
  }

  if (['sum', 'mean', 'min', 'max'].includes(op.type)) {
    if (!op.targetColumn) {
      return { valid: false, error: `Operation "${op.type}" requires a target numeric column.` };
    }
    const col = colMap.get(op.targetColumn.toLowerCase());
    if (!col) {
      return { valid: false, error: `Column "${op.targetColumn}" not found in dataset.` };
    }
    if (col.type !== 'number') {
      return { valid: false, error: `Column "${op.targetColumn}" is ${col.type}, but ${op.type} requires a numeric column.` };
    }
    return { valid: true };
  }

  if (op.type === 'groupBy') {
    if (!op.groupColumn) {
      return { valid: false, error: 'groupBy requires a groupColumn.' };
    }
    const grpCol = colMap.get(op.groupColumn.toLowerCase());
    if (!grpCol) {
      return { valid: false, error: `Group column "${op.groupColumn}" not found.` };
    }
    const agg = op.aggregate || 'count';
    if (agg === 'sum' || agg === 'mean') {
      if (!op.targetColumn) {
        return { valid: false, error: `groupBy with aggregate "${agg}" requires a target numeric column.` };
      }
      const target = colMap.get(op.targetColumn.toLowerCase());
      if (!target || target.type !== 'number') {
        return { valid: false, error: `Target column "${op.targetColumn}" must be numeric for ${agg}.` };
      }
    }
    return { valid: true };
  }

  return { valid: false, error: `Unsupported operation type: ${op.type}` };
}

/**
 * In-memory operation executor (for small datasets and fixtures)
 */
export function executeOperation(
  op: QueryOperation,
  _profile: DatasetProfile,
  rows: Record<string, string>[]
): OperationResult {
  let filtered = rows;
  if (op.filter) {
    const fCol = op.filter.column;
    const fVal = op.filter.value.toLowerCase();
    filtered = rows.filter((r) => String(r[fCol] || '').toLowerCase() === fVal);
  }

  const filterSuffix = op.filter ? ` where ${op.filter.column} = "${op.filter.value}"` : '';

  if (op.type === 'count') {
    return {
      humanReadableQuery: `Count of rows${filterSuffix}`,
      resultType: 'scalar',
      scalarValue: filtered.length,
    };
  }

  if (['sum', 'mean', 'min', 'max'].includes(op.type)) {
    const target = op.targetColumn!;
    const numbers = filtered
      .map((r) => Number(r[target]))
      .filter((n) => !isNaN(n));

    if (numbers.length === 0) {
      return {
        humanReadableQuery: `${op.type.toUpperCase()} of ${target}${filterSuffix}`,
        resultType: 'scalar',
        scalarValue: 0,
      };
    }

    let val = 0;
    if (op.type === 'sum') val = numbers.reduce((a, b) => a + b, 0);
    if (op.type === 'mean') val = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    if (op.type === 'min') val = Math.min(...numbers);
    if (op.type === 'max') val = Math.max(...numbers);

    return {
      humanReadableQuery: `${op.type.toUpperCase()} of ${target}${filterSuffix}`,
      resultType: 'scalar',
      scalarValue: Math.round(val * 100) / 100,
    };
  }

  if (op.type === 'groupBy') {
    const grp = op.groupColumn!;
    const agg = op.aggregate || 'count';
    const target = op.targetColumn;

    const groups = new Map<string, number[]>();

    for (const r of filtered) {
      const gVal = String(r[grp] || 'Unknown').trim();
      if (!groups.has(gVal)) {
        groups.set(gVal, []);
      }
      if (agg === 'count') {
        groups.get(gVal)!.push(1);
      } else if (target) {
        const num = Number(r[target]);
        if (!isNaN(num)) groups.get(gVal)!.push(num);
      }
    }

    const tableData: Array<{ group: string; value: number }> = [];

    for (const [groupName, vals] of groups.entries()) {
      let finalVal = 0;
      if (agg === 'count') {
        finalVal = vals.length;
      } else if (agg === 'sum') {
        finalVal = vals.reduce((a, b) => a + b, 0);
      } else if (agg === 'mean') {
        finalVal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }

      tableData.push({
        group: groupName,
        value: Math.round(finalVal * 100) / 100,
      });
    }

    tableData.sort((a, b) => b.value - a.value);

    return {
      humanReadableQuery: `${agg.toUpperCase()}${target ? ` of ${target}` : ''} grouped by ${grp}${filterSuffix}`,
      resultType: 'table',
      tableData,
    };
  }

  throw new Error(`Execution failed: Unknown operation ${op.type}`);
}

/**
 * Single-pass streaming operation executor for large CSV files (up to 500 MB).
 * Enforces bounded memory: O(1) for scalars, max 10,000 groups for groupBy.
 */
export function executeStreamingOperation(
  source: File | Blob | string,
  op: QueryOperation,
  profile: DatasetProfile,
  abortSignal?: AbortSignal
): Promise<OperationResult> {
  return new Promise((resolve, reject) => {
    const validCheck = validateOperation(op, profile);
    if (!validCheck.valid) {
      return reject(new Error(validCheck.error || 'Invalid query operation'));
    }

    const colIndexMap = new Map<string, number>();
    let headersProcessed = false;

    // Scalar accumulators
    let matchCount = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    // GroupBy accumulator (group -> { count, sum })
    const groupStats = new Map<string, { count: number; sum: number }>();
    let cardinalityCapped = false;

    let targetIdx = -1;
    let groupIdx = -1;
    let filterIdx = -1;
    const filterValLower = op.filter ? op.filter.value.toLowerCase() : '';

    Papa.parse<string[]>(source as any, {
      header: false,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      chunkSize: 2 * 1024 * 1024,
      chunk: (results, parser) => {
        if (abortSignal?.aborted) {
          parser.abort();
          return;
        }

        const data = results.data;
        if (!data || data.length === 0) return;

        let startRow = 0;
        if (!headersProcessed) {
          const rawHeaders = data[0];
          rawHeaders.forEach((h, idx) => {
            const clean = (h || '').trim().replace(/^\uFEFF/, '').toLowerCase();
            colIndexMap.set(clean, idx);
          });

          if (op.targetColumn) {
            targetIdx = colIndexMap.get(op.targetColumn.toLowerCase()) ?? -1;
          }
          if (op.groupColumn) {
            groupIdx = colIndexMap.get(op.groupColumn.toLowerCase()) ?? -1;
          }
          if (op.filter) {
            filterIdx = colIndexMap.get(op.filter.column.toLowerCase()) ?? -1;
          }

          headersProcessed = true;
          startRow = 1;
        }

        for (let r = startRow; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;

          // Apply filter if specified
          if (op.filter && filterIdx >= 0) {
            const cellVal = String(row[filterIdx] || '').trim().toLowerCase();
            if (cellVal !== filterValLower) continue;
          }

          matchCount++;

          // Scalar operations
          if (['sum', 'mean', 'min', 'max'].includes(op.type) && targetIdx >= 0) {
            const num = Number(row[targetIdx]);
            if (!isNaN(num)) {
              sum += num;
              if (num < min) min = num;
              if (num > max) max = num;
            }
          }

          // GroupBy operations
          if (op.type === 'groupBy' && groupIdx >= 0) {
            const grp = String(row[groupIdx] || 'Unknown').trim();
            let entry = groupStats.get(grp);
            if (!entry) {
              if (groupStats.size >= MAX_GROUP_CARDINALITY) {
                cardinalityCapped = true;
                continue;
              }
              entry = { count: 0, sum: 0 };
              groupStats.set(grp, entry);
            }

            entry.count++;
            if (targetIdx >= 0) {
              const num = Number(row[targetIdx]);
              if (!isNaN(num)) {
                entry.sum += num;
              }
            }
          }
        }
      },
      complete: () => {
        const filterSuffix = op.filter ? ` where ${op.filter.column} = "${op.filter.value}"` : '';

        if (op.type === 'count') {
          return resolve({
            humanReadableQuery: `Count of rows${filterSuffix}`,
            resultType: 'scalar',
            scalarValue: matchCount,
          });
        }

        if (['sum', 'mean', 'min', 'max'].includes(op.type)) {
          let finalVal = 0;
          if (matchCount > 0) {
            if (op.type === 'sum') finalVal = sum;
            if (op.type === 'mean') finalVal = matchCount > 0 ? sum / matchCount : 0;
            if (op.type === 'min') finalVal = min === Infinity ? 0 : min;
            if (op.type === 'max') finalVal = max === -Infinity ? 0 : max;
          }

          return resolve({
            humanReadableQuery: `${op.type.toUpperCase()} of ${op.targetColumn}${filterSuffix}`,
            resultType: 'scalar',
            scalarValue: Math.round(finalVal * 100) / 100,
          });
        }

        if (op.type === 'groupBy') {
          const agg = op.aggregate || 'count';
          const tableData: Array<{ group: string; value: number }> = [];

          for (const [groupName, entry] of groupStats.entries()) {
            let val = 0;
            if (agg === 'count') val = entry.count;
            if (agg === 'sum') val = entry.sum;
            if (agg === 'mean') val = entry.count > 0 ? entry.sum / entry.count : 0;

            tableData.push({
              group: groupName,
              value: Math.round(val * 100) / 100,
            });
          }

          tableData.sort((a, b) => b.value - a.value);

          const warning = cardinalityCapped
            ? `Cardinality limit exceeded (${MAX_GROUP_CARDINALITY.toLocaleString()} groups). Displaying top groups.`
            : undefined;

          return resolve({
            humanReadableQuery: `${agg.toUpperCase()}${op.targetColumn ? ` of ${op.targetColumn}` : ''} grouped by ${op.groupColumn}${filterSuffix}`,
            resultType: 'table',
            tableData,
            warning,
          });
        }

        reject(new Error(`Unsupported operation ${op.type}`));
      },
      error: (err) => {
        reject(new Error(`Streaming execution failed: ${err.message}`));
      },
    });
  });
}
