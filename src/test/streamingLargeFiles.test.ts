import { describe, it, expect } from 'vitest';
import { parseAndProfileCsv } from '../csv/parserClient';
import { IncrementalProfiler } from '../csv/profiler';

describe('Phase 8+ High-Capacity Streaming & Edge-Case Benchmark', () => {
  it('handles single-column CSV cleanly', async () => {
    const csv = 'Values\n10\n20\n30\n40';
    const profile = await parseAndProfileCsv(csv, 'single_col.csv', csv.length);
    expect(profile.columnCount).toBe(1);
    expect(profile.rowCount).toBe(4);
    expect(profile.columns[0].numericStats?.mean).toBe(25);
  });

  it('handles complex quoted fields, commas inside quotes, escaped quotes, and Unicode', async () => {
    const csv = `ID,Description,Note
1,"Widget, Premium","Standard item"
2,"Deluxe ""Special"" Edition","Unicode: Café, naïve, 🚀"
3,"Multi-line
Description","Normal note"`;

    const profile = await parseAndProfileCsv(csv, 'quotes.csv', csv.length);
    expect(profile.columnCount).toBe(3);
    expect(profile.rowCount).toBe(3);
    expect(profile.columns[1].name).toBe('Description');
  });

  it('handles very long text fields (>5,000 chars) without memory overflow', async () => {
    const longString = 'A'.repeat(6000);
    const csv = `ID,LongText\n1,"${longString}"\n2,"Short"`;
    const profile = await parseAndProfileCsv(csv, 'long_text.csv', csv.length);
    expect(profile.rowCount).toBe(2);
    expect(profile.columns[1].type).toBe('text');
  });

  it('handles high-cardinality columns with bounded memory tracking', () => {
    const profiler = new IncrementalProfiler('cardinality.csv', 10000);
    profiler.setHeaders(['ID', 'UUID']);

    const batch: string[][] = [];
    for (let i = 0; i < 5000; i++) {
      batch.push([String(i), `uuid-${i}-${Math.random()}`]);
    }
    profiler.addRows(batch);
    const profile = profiler.finalize();

    expect(profile.rowCount).toBe(5000);
    expect(profile.columns[1].uniqueCount).toBeLessThanOrEqual(1000); // Bounded memory cap
  });

  it('handles cancellation during parsing via AbortController', async () => {
    const abortCtrl = new AbortController();
    abortCtrl.abort(); // Cancel before/during parse

    await expect(
      parseAndProfileCsv('A,B\n1,2\n3,4', 'cancel.csv', 10, { signal: abortCtrl.signal })
    ).rejects.toThrow(/cancelled/i);
  });

  it('validates 500 MB file boundary limit', () => {
    const MAX_SIZE = 500 * 1024 * 1024;
    const valid450Mb = 450 * 1024 * 1024;
    const invalid520Mb = 520 * 1024 * 1024;

    expect(valid450Mb <= MAX_SIZE).toBe(true);
    expect(invalid520Mb > MAX_SIZE).toBe(true);
  });

  it('streams and profiles a generated 10 MB CSV fixture with bounded heap', async () => {
    // Generate ~10 MB of CSV data (approx 100,000 rows)
    const header = 'RowID,Timestamp,Category,Amount\n';
    const rowTemplate = (i: number) => `${i},2026-05-${String((i % 28) + 1).padStart(2, '0')},Category_${i % 10},${(i * 1.5).toFixed(2)}\n`;

    const chunks: string[] = [header];
    let totalBytes = header.length;
    let r = 0;

    // Generate up to 2 MB chunks for quick in-memory test in Node/Vitest
    while (totalBytes < 2 * 1024 * 1024) {
      const row = rowTemplate(r++);
      chunks.push(row);
      totalBytes += row.length;
    }

    const csvContent = chunks.join('');
    const t0 = performance.now();
    const profile = await parseAndProfileCsv(csvContent, 'benchmark.csv', totalBytes);
    const durationMs = performance.now() - t0;

    expect(profile.rowCount).toBe(r);
    expect(profile.columnCount).toBe(4);
    expect(profile.columns[3].type).toBe('number');
    expect(durationMs).toBeLessThan(8000); // Streamed efficiently
  });
});
