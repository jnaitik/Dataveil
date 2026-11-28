import { describe, it, expect } from 'vitest';
import { profileCsvData } from '../csv/profiler';
import { createStreamingFindingCollector } from '../csv/findings';

describe('Deterministic Findings Engine (Phase 11)', () => {
  it('detects negative values in amount/count columns', () => {
    const headers = ['id', 'user_name', 'total_amount', 'inventory_count'];
    const rows = [
      ['1', 'Alice', '100.50', '5'],
      ['2', 'Bob', '-45.00', '10'], // negative amount
      ['3', 'Charlie', '200.00', '-2'], // negative count
      ['4', 'David', '50.00', '15'],
    ];

    const profile = profileCsvData('sales.csv', headers, rows, 100);
    expect(profile.findings).toBeDefined();

    const negativeAmount = profile.findings?.find((f) => f.code === 'NEGATIVE_VALUES_IN_COUNT' && f.columnName === 'total_amount');
    expect(negativeAmount).toBeDefined();
    expect(negativeAmount?.count).toBe(1);
    expect(negativeAmount?.rowIndices).toContain(2);

    const negativeCount = profile.findings?.find((f) => f.code === 'NEGATIVE_VALUES_IN_COUNT' && f.columnName === 'inventory_count');
    expect(negativeCount).toBeDefined();
    expect(negativeCount?.count).toBe(1);
    expect(negativeCount?.rowIndices).toContain(3);
  });

  it('detects duplicate keys in key-like columns with row evidence', () => {
    const headers = ['transaction_id', 'amount'];
    const rows = [
      ['TX100', '10'],
      ['TX101', '20'],
      ['TX100', '30'], // duplicate key at row 3
      ['TX102', '40'],
      ['TX100', '50'], // duplicate key at row 5
    ];

    const profile = profileCsvData('keys.csv', headers, rows, 100);
    const keyDupFinding = profile.findings?.find((f) => f.code === 'PRIMARY_KEY_DUPLICATES');
    expect(keyDupFinding).toBeDefined();
    expect(keyDupFinding?.count).toBe(2);
    expect(keyDupFinding?.rowIndices).toEqual([3, 5]);
  });

  it('detects inconsistent date formats within the same column', () => {
    const headers = ['id', 'order_date'];
    const rows = [
      ['1', '2026-05-12'],
      ['2', '05/12/2026'], // inconsistent format
      ['3', '2026-06-01'],
    ];

    const profile = profileCsvData('dates.csv', headers, rows, 100);
    const dateFinding = profile.findings?.find((f) => f.code === 'INCONSISTENT_DATE_FORMAT');
    expect(dateFinding).toBeDefined();
    expect(dateFinding?.severity).toBe('warning');
    expect(dateFinding?.rowIndices.length).toBeGreaterThan(0);
  });

  it('detects high missing value rates and constant columns', () => {
    const headers = ['id', 'mostly_empty', 'always_same'];
    const rows = [
      ['1', '', 'active'],
      ['2', '', 'active'],
      ['3', '', 'active'],
      ['4', 'val', 'active'],
      ['5', '', 'active'],
    ];

    const profile = profileCsvData('sparse.csv', headers, rows, 100);
    const missingFinding = profile.findings?.find((f) => f.code === 'HIGH_MISSING_RATE');
    expect(missingFinding).toBeDefined();
    expect(missingFinding?.columnName).toBe('mostly_empty');

    const constantFinding = profile.findings?.find((f) => f.code === 'CONSTANT_COLUMN' && f.columnName === 'always_same');
    expect(constantFinding).toBeDefined();
    expect(constantFinding?.columnName).toBe('always_same');
  });

  it('computes streaming covariance correlation between numeric columns', () => {
    const headers = ['col_x', 'col_y'];
    // Correlated x and y
    const rows = [
      ['1', '2'],
      ['2', '4'],
      ['3', '6'],
      ['4', '8'],
      ['5', '10'],
      ['6', '12'],
    ];

    const profile = profileCsvData('corr.csv', headers, rows, 100);
    const corrFinding = profile.findings?.find((f) => f.code === 'STRONG_NUMERIC_CORRELATION');
    expect(corrFinding).toBeDefined();
    expect(corrFinding?.columnPair).toEqual(['col_x', 'col_y']);
    expect(corrFinding?.description).toMatch(/r = \+0\.9\d/);
  });

  it('caps evidence row pointers to at most 20 rows for memory safety', () => {
    const headers = ['account_id', 'amount'];
    // Generate 30 duplicate keys
    const rows: string[][] = [];
    for (let i = 1; i <= 30; i++) {
      rows.push(['ACC_DUPLICATE', '100']);
    }

    const collector = createStreamingFindingCollector(headers);
    rows.forEach((r, idx) => collector.updateRow(idx + 1, r, headers));

    const profile = profileCsvData('large_dups.csv', headers, rows, 500);
    const finding = profile.findings?.find((f) => f.code === 'PRIMARY_KEY_DUPLICATES');
    expect(finding).toBeDefined();
    expect(finding!.rowIndices.length).toBe(20);
    expect(finding!.count).toBe(29);
  });
});
