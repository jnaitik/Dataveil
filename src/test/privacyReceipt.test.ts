import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSha256,
  logAiRequest,
  generatePrivacyReceipt,
  getRecordedAiRequests,
} from '../lib/privacyReceipt';
import { clearNetworkLedger } from '../lib/networkLedger';
import { profileCsvData } from '../csv/profiler';

describe('Cryptographic Privacy Receipt (Phase 11)', () => {
  beforeEach(() => {
    clearNetworkLedger();
  });

  it('computes deterministic SHA-256 hash digests', async () => {
    const text1 = 'Dataveil Sanitized Schema Payload';
    const text2 = 'Dataveil Sanitized Schema Payload';
    const text3 = 'Different text';

    const hash1 = await computeSha256(text1);
    const hash2 = await computeSha256(text2);
    const hash3 = await computeSha256(text3);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBeGreaterThanOrEqual(16);
  });

  it('records AI transaction with SHA-256 digest and payload metrics', async () => {
    const entry = await logAiRequest({
      modeRequested: 'private',
      realInferenceSource: 'on-device',
      consentGiven: false,
      payloadText: 'Test AI prompt text for columns A, B, C',
      latencyMs: 142,
      tokensUsed: 45,
    });

    expect(entry.payloadSha256).toBeDefined();
    expect(entry.payloadCharLength).toBe(39);
    expect(entry.realInferenceSource).toBe('on-device');

    const allRequests = getRecordedAiRequests();
    expect(allRequests.some((r) => r.id === entry.id)).toBe(true);
  });

  it('generates privacy receipt with masked filename by default', () => {
    const profile = profileCsvData(
      'secret-financial-data-2026.csv',
      ['id', 'amount'],
      [['1', '100'], ['2', '200']],
      50
    );

    const receipt = generatePrivacyReceipt(profile, false);
    expect(receipt.dataSummary.fileName).toContain('[MASKED_FILENAME_');
    expect(receipt.dataSummary.fileName).not.toContain('secret-financial-data');
    expect(receipt.zeroDataGuarantee.rawCsvRowsIncluded).toBe(0);
    expect(receipt.zeroDataGuarantee.cellValuesSentToCloud).toBe(0);
    expect(receipt.dataSummary.parsingPurityStatus).toBe('100% AIR-GAPPED LOCAL');
  });

  it('allows opt-in filename reveal when user consents', () => {
    const profile = profileCsvData(
      'my-open-dataset.csv',
      ['id', 'score'],
      [['1', '90']],
      25
    );

    const receipt = generatePrivacyReceipt(profile, true);
    expect(receipt.dataSummary.fileName).toBe('my-open-dataset.csv');
  });

  it('CRITICAL VERIFICATION: JSON receipt contains ZERO raw rows or cells', () => {
    const profile = profileCsvData(
      'confidential.csv',
      ['SocialSecurity', 'SecretPassword'],
      [['123-45-6789', 'SuperSecretPass!']],
      80
    );

    const receipt = generatePrivacyReceipt(profile, false);
    const jsonString = JSON.stringify(receipt);

    expect(jsonString).not.toContain('123-45-6789');
    expect(jsonString).not.toContain('SuperSecretPass!');
    expect(jsonString).not.toContain('confidential.csv');
  });
});
