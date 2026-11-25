import { describe, it, expect } from 'vitest';
import { buildAiPayload } from '../ai/payload';
import { profileCsvData } from '../csv/profiler';

describe('Phase 6 Privacy Contract: buildAiPayload', () => {
  const headers = ['Email', 'CustomerName', 'Age', 'Score', 'SecretNotes'];
  const rows = [
    ['alice@example.com', 'Alice Smith', '28', '88', 'CONFIDENTIAL_NOTE_1'],
    ['bob@corporate.org', 'Bob Jones', '35', '92', 'CONFIDENTIAL_NOTE_2'],
    ['charlie@web.net', 'Charlie Brown', '41', '76', 'CONFIDENTIAL_NOTE_3'],
  ];
  const profile = profileCsvData('confidential.csv', headers, rows, 300);

  it('CRITICAL PRIVACY CHECK: Never includes raw cell values when top values is OFF', () => {
    const payload = buildAiPayload(profile, { includeTopValues: false });

    // Assert that NO raw row cell values appear in the payload string
    expect(payload).not.toContain('alice@example.com');
    expect(payload).not.toContain('bob@corporate.org');
    expect(payload).not.toContain('CONFIDENTIAL_NOTE_1');
    expect(payload).not.toContain('CONFIDENTIAL_NOTE_2');
    expect(payload).not.toContain('Alice Smith');
    expect(payload).not.toContain('Bob Jones');

    // Assert that statistical summaries ARE present
    expect(payload).toContain('File: confidential.csv');
    expect(payload).toContain('Total Rows: 3');
    expect(payload).toContain('Column: "Age"');
    expect(payload).toContain('Stats: min=28, max=41');
  });

  it('automatically excludes PII-flagged columns by default', () => {
    const payload = buildAiPayload(profile, { excludePiiByDefault: true });

    // Email column is flagged as PII
    expect(payload).toContain('Excluded Columns (Not shared for privacy)');
    expect(payload).toContain('Email');
    expect(payload).not.toContain('Column: "Email"');
  });

  it('honors user explicit column exclusions', () => {
    const payload = buildAiPayload(profile, {
      excludedColumns: ['SecretNotes', 'Score'],
    });

    expect(payload).not.toContain('Column: "SecretNotes"');
    expect(payload).not.toContain('Column: "Score"');
    expect(payload).toContain('Column: "Age"');
  });
});
