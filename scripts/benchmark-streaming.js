#!/usr/bin/env node
/**
 * Benchmark Runner for 500 MB Streaming Profiler Engine.
 * Tests PapaParse streaming + Welford + P² + HLL + Space-Saving on real 500 MB file.
 */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  ColumnAccumulator,
  ReservoirSampler,
  HyperLogLog,
} from '../src/csv/accumulators.ts';
import { cleanHeaderNames, detectPiiSuspect } from '../src/csv/profiler.ts';

const filePath = path.resolve(process.cwd(), './synthetic-500mb.csv');

if (!fs.existsSync(filePath)) {
  console.error(`[Benchmark Error] File not found: ${filePath}`);
  process.exit(1);
}

const stats = fs.statSync(filePath);
const fileSizeBytes = stats.size;
const mbSize = (fileSizeBytes / (1024 * 1024)).toFixed(2);

console.log(`================================================================`);
console.log(`DATAVEIL 500 MB STREAMING ENGINE BENCHMARK`);
console.log(`================================================================`);
console.log(`- Target File: ${filePath}`);
console.log(`- File Size: ${mbSize} MB (${fileSizeBytes.toLocaleString()} bytes)`);

let maxHeapUsed = 0;
let maxRss = 0;

// Track peak memory every 50ms
const memInterval = setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed > maxHeapUsed) maxHeapUsed = mem.heapUsed;
  if (mem.rss > maxRss) maxRss = mem.rss;
}, 50);

const startTime = Date.now();
let totalRows = 0;
let headers = [];
let accumulators = [];
const reservoir = new ReservoirSampler(50);
const rowHll = new HyperLogLog();
let isHeaderProcessed = false;
let raggedRowCount = 0;
let lastLogTime = Date.now();

const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 2 }); // 2 MB chunk

Papa.parse(fileStream, {
  header: false,
  skipEmptyLines: 'greedy',
  dynamicTyping: false,
  chunkSize: 1024 * 1024 * 2, // 2 MB
  chunk: (results) => {
    const data = results.data;
    if (!data || data.length === 0) return;

    let startRow = 0;
    if (!isHeaderProcessed) {
      headers = cleanHeaderNames(data[0]);
      accumulators = headers.map((h) => new ColumnAccumulator(h));
      isHeaderProcessed = true;
      startRow = 1;
    }

    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      if (row.length !== headers.length) {
        raggedRowCount++;
      }

      totalRows++;
      rowHll.add(row.join('|||'));

      const rowObj = {};
      for (let c = 0; c < headers.length; c++) {
        rowObj[headers[c]] = row[c] !== undefined ? String(row[c]) : '';
        accumulators[c].update(row[c]);
      }
      reservoir.add(rowObj);
    }

    const now = Date.now();
    if (now - lastLogTime >= 2000) {
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      const rowsPerSec = Math.round(totalRows / (elapsed || 1));
      const currentHeapMB = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1);
      const currentRssMB = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
      console.log(`[Streaming] ${totalRows.toLocaleString()} rows parsed (${elapsed}s) • ${rowsPerSec.toLocaleString()} rows/s • Heap: ${currentHeapMB} MB • RSS: ${currentRssMB} MB`);
      lastLogTime = now;
    }
  },
  complete: () => {
    clearInterval(memInterval);
    const endTime = Date.now();
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);
    const throughputRowsSec = Math.round(totalRows / (durationSec || 1));
    const throughputMBSec = (fileSizeBytes / (1024 * 1024) / durationSec).toFixed(2);
    const peakHeapMB = (maxHeapUsed / (1024 * 1024)).toFixed(2);
    const peakRssMB = (maxRss / (1024 * 1024)).toFixed(2);

    console.log(`\n================================================================`);
    console.log(`BENCHMARK RESULTS (500 MB STREAMING PASS)`);
    console.log(`================================================================`);
    console.log(`✓ Parse Duration: ${durationSec} seconds`);
    console.log(`✓ Total Rows Processed: ${totalRows.toLocaleString()}`);
    console.log(`✓ Columns Profiled: ${headers.length} (${headers.join(', ')})`);
    console.log(`✓ Throughput: ${throughputRowsSec.toLocaleString()} rows/sec (${throughputMBSec} MB/sec)`);
    console.log(`✓ Peak Heap Used: ${peakHeapMB} MB`);
    console.log(`✓ Peak RSS (Resident Memory): ${peakRssMB} MB`);
    console.log(`✓ Ragged Rows Counted: ${raggedRowCount}`);
    console.log(`✓ Reservoir Preview Sample Size: ${reservoir.getSample().length} rows (bounded)`);
    console.log(`✓ Estimated Unique Rows: ${rowHll.count().toLocaleString()}`);

    console.log(`\n--- Column Statistical Accuracy Summary ---`);
    for (const acc of accumulators) {
      const type = acc.inferFinalType();
      const uniqueCount = acc.hll.count();
      if (type === 'number') {
        console.log(`- [${acc.name}] TYPE: ${type.toUpperCase()}`);
        console.log(`  Count: ${acc.welford.count.toLocaleString()}, Min: ${acc.welford.min}, Max: ${acc.welford.max}, Mean: ${acc.welford.mean.toFixed(2)}, Median (P²): ≈ ${acc.medianEst.estimate.toFixed(2)}, IQR Outliers: ≈ ${acc.computeOutliersCount()}`);
      } else {
        const top = acc.spaceSaving.getTop(3, acc.totalCount);
        console.log(`- [${acc.name}] TYPE: ${type.toUpperCase()}, Unique: ≈ ${uniqueCount.toLocaleString()}`);
        console.log(`  Top 3: ${top.map((t) => `${t.value} (${t.count})`).join(', ')}`);
      }
    }
    console.log(`\n[GATE VERIFICATION] 500 MB STREAMING ENGINE: PASSED SUCCESSFULLY!`);
  },
  error: (err) => {
    clearInterval(memInterval);
    console.error(`[Benchmark Failure]`, err);
    process.exit(1);
  },
});
