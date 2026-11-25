import { describe, it, expect } from 'vitest';
import { validateOperation, executeOperation } from '../csv/operations';
import { profileCsvData } from '../csv/profiler';

describe('Phase 6 Query Operations Engine', () => {
  const headers = ['Category', 'Amount', 'Date'];
  const rows = [
    ['Groceries', '50', '2026-01-01'],
    ['Utilities', '100', '2026-01-02'],
    ['Groceries', '80', '2026-01-03'],
    ['Entertainment', '30', '2026-01-04'],
  ];
  const profile = profileCsvData('expenses.csv', headers, rows, 200);

  it('validates and executes a scalar COUNT operation', () => {
    const op = { type: 'count' as const };
    const val = validateOperation(op, profile);
    expect(val.valid).toBe(true);

    const res = executeOperation(op, profile, profile.previewRows);
    expect(res.scalarValue).toBe(4);
    expect(res.humanReadableQuery).toContain('Count of rows');
  });

  it('validates and executes a scalar SUM operation on numeric column', () => {
    const op = { type: 'sum' as const, targetColumn: 'Amount' };
    const val = validateOperation(op, profile);
    expect(val.valid).toBe(true);

    const res = executeOperation(op, profile, profile.previewRows);
    expect(res.scalarValue).toBe(260); // 50 + 100 + 80 + 30
  });

  it('validates and executes a GROUP BY with SUM operation', () => {
    const op = {
      type: 'groupBy' as const,
      groupColumn: 'Category',
      aggregate: 'sum' as const,
      targetColumn: 'Amount',
    };
    const val = validateOperation(op, profile);
    expect(val.valid).toBe(true);

    const res = executeOperation(op, profile, profile.previewRows);
    expect(res.resultType).toBe('table');
    expect(res.tableData).toBeDefined();

    const groceries = res.tableData?.find((g) => g.group === 'Groceries');
    expect(groceries?.value).toBe(130); // 50 + 80
  });

  it('applies single-column equality filter correctly', () => {
    const op = {
      type: 'sum' as const,
      targetColumn: 'Amount',
      filter: { column: 'Category', value: 'Groceries' },
    };
    const res = executeOperation(op, profile, profile.previewRows);
    expect(res.scalarValue).toBe(130);
    expect(res.humanReadableQuery).toContain('where Category = "Groceries"');
  });

  it('rejects sum on non-numeric column', () => {
    const op = { type: 'sum' as const, targetColumn: 'Category' };
    const val = validateOperation(op, profile);
    expect(val.valid).toBe(false);
    expect(val.error).toContain('requires a numeric column');
  });
});
