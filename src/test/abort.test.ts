import { describe, it, expect } from 'vitest';
import { streamAndProfileCsv } from '../csv/streamingProfiler';
import { parseAndProfileStream } from '../csv/parserClient';

describe('Phase 10: Streaming Abort & Cancellation Tests', () => {
  it('aborts streamAndProfileCsv immediately when AbortSignal triggers', async () => {
    const csv = 'ID,Name,Amount\n1,User_1,10.5\n2,User_2,20.0\n';
    const abortCtrl = new AbortController();
    abortCtrl.abort();

    const parsePromise = streamAndProfileCsv(csv, {
      fileName: 'large_abort_test.csv',
      fileSizeBytes: csv.length,
      abortSignal: abortCtrl.signal,
    });

    await expect(parsePromise).rejects.toThrow(/abort/i);
  });

  it('cancels parseAndProfileStream cleanly via handle.cancel()', async () => {
    let csv = 'ID,Name,Amount\n';
    for (let i = 1; i <= 2000; i++) {
      csv += `${i},User_${i},${(i * 10.5).toFixed(2)}\n`;
    }

    const handle = parseAndProfileStream(
      csv,
      'test_cancel.csv',
      csv.length
    );

    handle.cancel();

    await expect(handle.promise).rejects.toThrow(/cancelled|abort/i);
  });
});
