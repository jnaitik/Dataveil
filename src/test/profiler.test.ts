import { describe, it, expect } from 'vitest';
import {
  profileCsvData,
  cleanHeaderNames,
  computeNumericStats,
  inferType,
  detectPiiSuspect,
} from '../csv/profiler';
import { generateDefaultCharts } from '../csv/chartSpecs';
import { parseAndProfileCsv } from '../csv/parserClient';

describe('Phase 5 CSV Profiler & Edge-Case Fixtures', () => {
  it('handles empty CSV input safely', async () => {
    await expect(parseAndProfileCsv('', 'empty.csv', 0)).rejects.toThrow();
  });

  it('handles CSV with header only (0 rows)', async () => {
    const csv = 'Name,Age,Score';
    const profile = await parseAndProfileCsv(csv, 'headers_only.csv', csv.length);
    expect(profile.rowCount).toBe(0);
    expect(profile.columnCount).toBe(3);
    expect(profile.columns[0].name).toBe('Name');
  });

  it('strips UTF-8 BOM correctly and normalizes first header', () => {
    const headers = ['\uFEFFAmount', 'Category'];
    const cleaned = cleanHeaderNames(headers);
    expect(cleaned[0]).toBe('Amount');
  });

  it('resolves duplicate headers and empty headers safely', () => {
    const rawHeaders = ['ID', '', 'Revenue', 'Revenue', ''];
    const cleaned = cleanHeaderNames(rawHeaders);
    expect(cleaned).toEqual(['ID', 'Column_2', 'Revenue', 'Revenue_2', 'Column_5']);
  });

  it('handles ragged rows (short and extra columns) without crashing', () => {
    const headers = ['A', 'B', 'C'];
    const rows = [
      ['1', '2'],          // short row
      ['4', '5', '6', '7'], // extra column
      ['8', '9', '10'],     // normal row
    ];
    const profile = profileCsvData('ragged.csv', headers, rows, 100);
    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(3);
    expect(profile.columns[2].missingCount).toBe(1); // row 0 had missing C
  });

  it('correctly calculates numeric stats, median, and IQR outliers', () => {
    // 10, 12, 14, 15, 16, 18, 20, and an extreme outlier 100
    const numbers = [10, 12, 14, 15, 16, 18, 20, 100];
    const stats = computeNumericStats(numbers);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(100);
    expect(stats.median).toBe(15.5);
    expect(stats.outliersCount).toBe(1); // 100 is an outlier
  });

  it('infers data types accurately (numbers, dates, booleans, mixed, text)', () => {
    expect(inferType(['10', '20.5', '300', '4.2'])).toBe('number');
    expect(inferType(['2026-01-15', '2026-02-20', '2026-03-25'])).toBe('date');
    expect(inferType(['true', 'false', 'yes', 'no'])).toBe('boolean');
    expect(inferType(['Hello', 'World', 'Dataveil'])).toBe('text');
    expect(inferType(['10', '20', 'thirty', '40', 'fifty', '60'])).toBe('mixed');
  });

  it('detects PII suspect column names and email cell values', () => {
    expect(detectPiiSuspect('Customer_Email', ['user@example.com'])).toBe(true);
    expect(detectPiiSuspect('Phone_Number', ['1234567890'])).toBe(true);
    expect(detectPiiSuspect('SocialSecurityNumber', ['XXX-XX-XXXX'])).toBe(true);
    expect(detectPiiSuspect('Category', ['Office Supplies', 'Electronics'])).toBe(false);
  });

  it('parses semicolon and tab-delimited files cleanly', async () => {
    const semicolonCsv = 'Region;Units;Sales\nNorth;10;100\nSouth;20;200';
    const profileSemi = await parseAndProfileCsv(semicolonCsv, 'semi.csv', semicolonCsv.length);
    expect(profileSemi.delimiter).toBe(';');
    expect(profileSemi.columnCount).toBe(3);
    expect(profileSemi.rowCount).toBe(2);

    const tabCsv = 'Item\tPrice\nPen\t1.50\nBook\t12.00';
    const profileTab = await parseAndProfileCsv(tabCsv, 'tab.csv', tabCsv.length);
    expect(profileTab.delimiter).toBe('\t');
    expect(profileTab.columnCount).toBe(2);
    expect(profileTab.rowCount).toBe(2);
  });

  it('generates deterministic default charts without requiring AI', () => {
    const headers = ['Date', 'Category', 'Sales'];
    const rows = [
      ['2026-01-01', 'Electronics', '500'],
      ['2026-01-02', 'Office Supplies', '150'],
      ['2026-01-03', 'Electronics', '700'],
      ['2026-01-04', 'Furniture', '320'],
    ];
    const profile = profileCsvData('test.csv', headers, rows, 200);
    const charts = generateDefaultCharts(profile);
    expect(charts.length).toBeGreaterThan(0);
    expect(['bar', 'line', 'histogram']).toContain(charts[0].type);
  });
});
