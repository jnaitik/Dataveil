import Papa from 'papaparse';
import type { DatasetProfile } from './profiler';

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
}

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
 * executeStreamingOperation performs a bounded-memory streaming scan over a local File.
 * Memory complexity is O(1) regardless of whether the file is 10 MB or 500 MB.
 */
export function executeStreamingOperation(
  op: QueryOperation,
  file: File,
  _profile: DatasetProfile,
  signal?: AbortSignal
): Promise<OperationResult> {
  return new Promise((resolve, reject) => {
    let headerIndices: Map<string, number> | null = null;
    let count = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    const groups = new Map<string, { count: number; sum: number }>();

    const filterCol = op.filter?.column.toLowerCase();
    const filterVal = op.filter?.value.toLowerCase();
    const targetCol = op.targetColumn?.toLowerCase();
    const groupCol = op.groupColumn?.toLowerCase();

    Papa.parse<string[]>(file, {
      chunkSize: 1024 * 1024 * 4,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      chunk: (results, parser) => {
        if (signal?.aborted) {
          parser.abort();
          return reject(new Error('Operation cancelled by user.'));
        }

        const rows = results.data;
        if (!rows || rows.length === 0) return;

        let startRow = 0;
        if (!headerIndices) {
          headerIndices = new Map();
          rows[0].forEach((h, idx) => {
            const clean = (h || '').trim().replace(/^\uFEFF/, '').toLowerCase();
            headerIndices!.set(clean, idx);
          });
          startRow = 1;
        }

        const filterIdx = filterCol ? headerIndices.get(filterCol) : undefined;
        const targetIdx = targetCol ? headerIndices.get(targetCol) : undefined;
        const groupIdx = groupCol ? headerIndices.get(groupCol) : undefined;

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          // Check filter
          if (filterIdx !== undefined) {
            const cellVal = String(row[filterIdx] || '').toLowerCase().trim();
            if (cellVal !== filterVal) continue;
          }

          count++;

          if (['sum', 'mean', 'min', 'max'].includes(op.type) && targetIdx !== undefined) {
            const num = Number(row[targetIdx]);
            if (!isNaN(num)) {
              sum += num;
              if (num < min) min = num;
              if (num > max) max = num;
            }
          } else if (op.type === 'groupBy' && groupIdx !== undefined) {
            const gVal = String(row[groupIdx] || 'Unknown').trim();
            const existing = groups.get(gVal) || { count: 0, sum: 0 };
            existing.count++;
            if (targetIdx !== undefined) {
              const num = Number(row[targetIdx]);
              if (!isNaN(num)) existing.sum += num;
            }
            groups.set(gVal, existing);
          }
        }
      },
      complete: () => {
        const filterSuffix = op.filter ? ` where ${op.filter.column} = "${op.filter.value}"` : '';

        if (op.type === 'count') {
          return resolve({
            humanReadableQuery: `Count of rows${filterSuffix}`,
            resultType: 'scalar',
            scalarValue: count,
          });
        }

        if (['sum', 'mean', 'min', 'max'].includes(op.type)) {
          let val = 0;
          if (op.type === 'sum') val = sum;
          if (op.type === 'mean') val = count > 0 ? sum / count : 0;
          if (op.type === 'min') val = min === Infinity ? 0 : min;
          if (op.type === 'max') val = max === -Infinity ? 0 : max;

          return resolve({
            humanReadableQuery: `${op.type.toUpperCase()} of ${op.targetColumn}${filterSuffix}`,
            resultType: 'scalar',
            scalarValue: Math.round(val * 100) / 100,
          });
        }

        if (op.type === 'groupBy') {
          const agg = op.aggregate || 'count';
          const tableData: Array<{ group: string; value: number }> = [];

          for (const [groupName, data] of groups.entries()) {
            let finalVal = 0;
            if (agg === 'count') finalVal = data.count;
            else if (agg === 'sum') finalVal = data.sum;
            else if (agg === 'mean') finalVal = data.count > 0 ? data.sum / data.count : 0;

            tableData.push({
              group: groupName,
              value: Math.round(finalVal * 100) / 100,
            });
          }

          tableData.sort((a, b) => b.value - a.value);

          return resolve({
            humanReadableQuery: `${agg.toUpperCase()}${op.targetColumn ? ` of ${op.targetColumn}` : ''} grouped by ${op.groupColumn}${filterSuffix}`,
            resultType: 'table',
            tableData,
          });
        }

        reject(new Error(`Unsupported operation: ${op.type}`));
      },
      error: (err) => {
        reject(new Error(err.message || 'Error executing streaming operation.'));
      },
    });
  });
}
