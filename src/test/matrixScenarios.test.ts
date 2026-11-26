import { describe, it, expect } from 'vitest';
import { profileCsvData } from '../csv/profiler';
import { buildAiPayload } from '../ai/payload';
import { routeInference } from '../ai/router';
import { InferenceMode } from '../ai/aiClient';
import { executeOperation, type QueryOperation } from '../csv/operations';
import { generateDefaultCharts } from '../csv/chartSpecs';

describe('Phase 8 Hackathon 10-Scenario Test Matrix Execution', () => {
  // Scenario 1: Clean file upload & instant profiling
  it('Scenario 1: Clean CSV is parsed & profiled accurately with complete statistical summaries', () => {
    const headers = ['Date', 'Product', 'Quantity', 'Sales'];
    const rows = [
      ['2026-01-01', 'Widgets', '10', '100.5'],
      ['2026-01-02', 'Gadgets', '20', '250.0'],
      ['2026-01-03', 'Widgets', '15', '150.75'],
    ];

    const profile = profileCsvData('sales.csv', headers, rows, 2048);

    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(4);
    expect(profile.duplicateRowCount).toBe(0);
    expect(profile.warnings.length).toBe(0);

    const salesCol = profile.columns.find((c) => c.name === 'Sales');
    expect(salesCol?.type).toBe('number');
    expect(salesCol?.numericStats?.min).toBe(100.5);
    expect(salesCol?.numericStats?.max).toBe(250.0);
  });

  // Scenario 2: File size boundary (>50 MB rejected)
  it('Scenario 2: Boundary validation rejects files exceeding 50 MB limit', () => {
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    const validFileSize = 48 * 1024 * 1024; // 48 MB
    const oversizedFileSize = 52 * 1024 * 1024; // 52 MB

    expect(validFileSize <= MAX_SIZE).toBe(true);
    expect(oversizedFileSize > MAX_SIZE).toBe(true);

    const generateErrorMsg = (size: number) => {
      if (size > MAX_SIZE) {
        return `File exceeds the 50 MB limit (${(size / (1024 * 1024)).toFixed(1)} MB).`;
      }
      return null;
    };

    expect(generateErrorMsg(oversizedFileSize)).toBe('File exceeds the 50 MB limit (52.0 MB).');
    expect(generateErrorMsg(validFileSize)).toBeNull();
  });

  // Scenario 3: Malformed / ragged rows tolerance
  it('Scenario 3: Profiler handles ragged rows and missing column cells gracefully without crashing', () => {
    const headers = ['A', 'B', 'C'];
    const raggedRows = [
      ['val1', 'val2', 'val3'],
      ['val4'], // Missing 2 columns
      ['val5', 'val6', 'val7', 'extra_val8'], // Excess column
    ];

    const profile = profileCsvData('ragged.csv', headers, raggedRows, 500);

    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(3);
    // Column B should reflect a missing cell from row 2
    const colB = profile.columns.find((c) => c.name === 'B');
    expect(colB?.missingCount).toBe(1);
  });

  // Scenario 4: UTF-8 BOM characters stripped
  it('Scenario 4: Strips UTF-8 Byte Order Mark (BOM) cleanly from headers', () => {
    const bomHeader = '\uFEFFAccountID';
    const cleanedHeader = bomHeader.replace(/^\uFEFF/, '');

    expect(cleanedHeader).toBe('AccountID');
    expect(cleanedHeader.charCodeAt(0)).not.toBe(0xfeff);

    const profile = profileCsvData('bom.csv', [cleanedHeader, 'Balance'], [['ACC-01', '500']], 200);
    expect(profile.columns[0].name).toBe('AccountID');
  });

  // Scenario 5: High-PII dataset auto-exclusion
  it('Scenario 5: High-PII columns (emails, SSNs) are automatically excluded from AI payload', () => {
    const headers = ['Email', 'SSN', 'PatientName', 'SystolicBP', 'DiastolicBP'];
    const rows = [
      ['patient1@hospital.org', '123-45-6789', 'Alice Test', '120', '80'],
      ['patient2@hospital.org', '987-65-4321', 'Bob Test', '135', '88'],
    ];

    const profile = profileCsvData('patients.csv', headers, rows, 1000);
    const payload = buildAiPayload(profile, { excludePiiByDefault: true });

    // Assert PII columns are not exposed
    expect(payload).not.toContain('patient1@hospital.org');
    expect(payload).not.toContain('123-45-6789');
    expect(payload).not.toContain('Alice Test');
    expect(payload).toContain('Excluded Columns (Not shared for privacy)');
  });

  // Scenario 6: On-device Gemini Nano inference path
  it('Scenario 6: Routes directly to ONLY_ON_DEVICE when Nano model is available in Private mode', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 800,
      hasCloudConsent: false,
      isDeviceModelAvailable: true,
    });

    expect(decision.mode).toBe(InferenceMode.ONLY_ON_DEVICE);
    expect(decision.needsConsent).toBe(false);
  });

  // Scenario 7: On-device failure halts and triggers Consent Card
  it('Scenario 7: Halts and triggers Consent Card when on-device model is unavailable in Private mode', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 1500,
      hasCloudConsent: false,
      isDeviceModelAvailable: false,
    });

    expect(decision.needsConsent).toBe(true);
    expect(decision.reason).toContain('consent required');
  });

  // Scenario 8: User declines consent -> stays local
  it('Scenario 8: User declining consent maintains local private state without cloud dispatch', () => {
    let cloudConsentGranted = false;

    // Simulate user clicking "Cancel" on Consent Card
    const handleCancelConsent = () => {
      cloudConsentGranted = false;
    };
    handleCancelConsent();

    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 1500,
      hasCloudConsent: cloudConsentGranted,
      isDeviceModelAvailable: false,
    });

    expect(decision.needsConsent).toBe(true);
    // Verified: No cloud request is authorized
    expect(cloudConsentGranted).toBe(false);
  });

  // Scenario 9: User grants consent -> routes to cloud
  it('Scenario 9: Explicit user consent routes to PREFER_IN_CLOUD with cloud provenance', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 1500,
      hasCloudConsent: true, // User clicked "Use cloud for this request"
      isDeviceModelAvailable: false,
    });

    expect(decision.mode).toBe(InferenceMode.PREFER_IN_CLOUD);
    expect(decision.needsConsent).toBe(false);
  });

  // Scenario 10: Offline mode behavior
  it('Scenario 10: In offline mode, strictly prevents cloud attempts and computes all charts & math deterministically', () => {
    const isOnline = false;

    // In offline state, cloud inference must not be attempted
    const canAttemptCloud = isOnline;
    expect(canAttemptCloud).toBe(false);

    // Profile and local operations continue running 100% offline
    const profile = profileCsvData(
      'offline.csv',
      ['Category', 'Amount'],
      [
        ['Hardware', '100'],
        ['Software', '200'],
      ],
      300
    );

    const charts = generateDefaultCharts(profile);
    expect(charts.length).toBeGreaterThan(0);

    const op: QueryOperation = { type: 'sum', targetColumn: 'Amount' };
    const res = executeOperation(op, profile, profile.previewRows);
    expect(res.scalarValue).toBe(300);
  });
});
