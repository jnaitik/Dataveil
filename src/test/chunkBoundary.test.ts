import { describe, it, expect } from 'vitest';
import { streamAndProfileCsv } from '../csv/streamingProfiler';

describe('Phase 10: Streaming Chunk-Boundary Safety Tests', () => {
  it('handles a quoted newline split across two chunks without creating false rows', async () => {
    // A CSV with 2 rows where row 1 has an embedded quoted newline
    const csv = 'ID,Description,Amount\n1,"Hello\nWorld",100.5\n2,"Normal",200.0\n';

    // Set chunkSize to 16 bytes so the first chunk breaks right inside "Hello\nWorld"
    const profile = await streamAndProfileCsv(csv, {
      fileName: 'quoted_newline.csv',
      fileSizeBytes: csv.length,
      chunkSize: 16,
    });

    expect(profile.rowCount).toBe(2);
    expect(profile.columnCount).toBe(3);
    expect(profile.columns[1].name).toBe('Description');

    // Verify preview row has intact multiline content
    const row1 = profile.previewRows[0];
    expect(row1['Description']).toBe('Hello\nWorld');
    expect(row1['Amount']).toBe('100.5');

    const row2 = profile.previewRows[1];
    expect(row2['Description']).toBe('Normal');
    expect(row2['Amount']).toBe('200.0');
  });

  it('handles multi-byte UTF-8 characters across chunk boundaries without corruption', async () => {
    const csv = 'ID,Symbol,Text\n1,🛡️,"Protected Dataveil"\n2,🚀,"Fast Streaming"\n3,🔒,"Secure Vault"\n';

    // Small chunk size forces boundary splits across multi-byte UTF-8 characters
    const profile = await streamAndProfileCsv(csv, {
      fileName: 'multibyte.csv',
      fileSizeBytes: csv.length,
      chunkSize: 18,
    });

    expect(profile.rowCount).toBe(3);
    expect(profile.previewRows[0]['Symbol']).toBe('🛡️');
    expect(profile.previewRows[1]['Symbol']).toBe('🚀');
    expect(profile.previewRows[2]['Symbol']).toBe('🔒');
  });

  it('handles header line split across multiple chunks', async () => {
    const csv = 'Transaction_ID,Customer_Account_Number,Transaction_Amount_USD,Transaction_Status\n101,ACC991,550.25,Completed\n';

    // Chunk size 12 bytes forces header to span across 6 chunks
    const profile = await streamAndProfileCsv(csv, {
      fileName: 'header_split.csv',
      fileSizeBytes: csv.length,
      chunkSize: 12,
    });

    expect(profile.rowCount).toBe(1);
    expect(profile.columnCount).toBe(4);
    expect(profile.columns.map((c) => c.name)).toEqual([
      'Transaction_ID',
      'Customer_Account_Number',
      'Transaction_Amount_USD',
      'Transaction_Status',
    ]);
  });
});
