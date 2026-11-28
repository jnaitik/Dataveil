#!/usr/bin/env node
/**
 * Synthetic Large CSV Generator for Dataveil Hackathon Benchmarks.
 * 
 * Usage:
 *   node scripts/generate-large-csv.js --size=100MB
 *   node scripts/generate-large-csv.js --size=250MB
 *   node scripts/generate-large-csv.js --size=500MB
 *   node scripts/generate-large-csv.js --size=50MB --out=./test-50mb.csv
 */

import fs from 'node:fs';
import path from 'node:path';

// Parse CLI arguments
const args = process.argv.slice(2);
let targetSizeStr = '100MB';
let outputPath = '';

for (const arg of args) {
  if (arg.startsWith('--size=')) {
    targetSizeStr = arg.split('=')[1].toUpperCase();
  } else if (arg.startsWith('--out=')) {
    outputPath = arg.split('=')[1];
  }
}

let targetBytes = 100 * 1024 * 1024;
if (targetSizeStr.endsWith('GB')) {
  targetBytes = parseFloat(targetSizeStr) * 1024 * 1024 * 1024;
} else if (targetSizeStr.endsWith('MB')) {
  targetBytes = parseFloat(targetSizeStr) * 1024 * 1024;
} else if (targetSizeStr.endsWith('KB')) {
  targetBytes = parseFloat(targetSizeStr) * 1024;
} else if (!isNaN(Number(targetSizeStr))) {
  targetBytes = parseInt(targetSizeStr, 10);
}

if (!outputPath) {
  outputPath = path.resolve(process.cwd(), `synthetic-${targetSizeStr.toLowerCase()}.csv`);
}

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const CATEGORIES = ['Electronics', 'Office Supplies', 'Furniture', 'Software', 'Industrial Equipment'];
const STATUSES = ['Completed', 'Pending', 'Cancelled', 'Refunded'];
const NAMES = [
  'Alice Smith', 'Bob Johnson', 'Carol Williams', 'David Brown', 'Emma Jones',
  'Frank Garcia', 'Grace Miller', 'Henry Davis', 'Isabella Rodriguez', 'Jack Martinez',
  'Liam Hernandez', 'Mia Lopez', 'Noah Gonzalez', 'Olivia Wilson', 'Peter Anderson',
  'Quinn Thomas', 'Rachel Taylor', 'Samuel Moore', 'Tara Jackson', 'Victor Martin'
];

console.log(`[Dataveil Generator] Generating synthetic CSV of ~${targetSizeStr} (${(targetBytes / (1024 * 1024)).toFixed(2)} MB)...`);
console.log(`[Dataveil Generator] Output destination: ${outputPath}`);

const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8', highWaterMark: 1024 * 64 });

const HEADER = 'Transaction_ID,Date,Customer_Name,Email,Region,Category,Amount,Quantity,Status\n';
writeStream.write(HEADER);
let bytesWritten = Buffer.byteLength(HEADER);
let rowCount = 0;
const startTime = Date.now();

function generateRow(id) {
  const name = NAMES[id % NAMES.length];
  const email = `customer_${id % 5000}@example.com`;
  const region = REGIONS[id % REGIONS.length];
  const category = CATEGORIES[(id * 3) % CATEGORIES.length];
  const status = STATUSES[(id * 7) % STATUSES.length];
  
  // Date between 2024-01-01 and 2026-11-28
  const day = 1 + (id % 28);
  const month = 1 + ((id >> 2) % 12);
  const year = 2024 + ((id >> 4) % 3);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  const amount = (10 + ((id * 31) % 9990) + ((id % 99) / 100)).toFixed(2);
  const quantity = 1 + ((id * 13) % 45);

  return `${id},${dateStr},"${name}",${email},${region},${category},${amount},${quantity},${status}\n`;
}

function writeNext() {
  let canContinue = true;
  while (bytesWritten < targetBytes && canContinue) {
    rowCount++;
    const row = generateRow(rowCount);
    bytesWritten += Buffer.byteLength(row);
    canContinue = writeStream.write(row);
  }

  if (bytesWritten < targetBytes) {
    writeStream.once('drain', writeNext);
  } else {
    writeStream.end();
  }
}

writeStream.on('finish', () => {
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const mbWritten = (bytesWritten / (1024 * 1024)).toFixed(2);
  console.log(`\n[Dataveil Generator] Done!`);
  console.log(`- File Size: ${mbWritten} MB (${bytesWritten.toLocaleString()} bytes)`);
  console.log(`- Rows Generated: ${rowCount.toLocaleString()}`);
  console.log(`- Duration: ${elapsedSec}s`);
  console.log(`- Path: ${outputPath}`);
});

writeNext();
