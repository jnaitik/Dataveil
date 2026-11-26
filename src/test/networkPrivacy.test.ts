import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { profileCsvData } from '../csv/profiler';
import { buildAiPayload } from '../ai/payload';
import { executeOperation, type QueryOperation } from '../csv/operations';
import { generateDefaultCharts } from '../csv/chartSpecs';
import { routeInference } from '../ai/router';

describe('Phase 8 Network Privacy Contract: Zero Outbound Request Assertions', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Intercept and spy on all global network fetch requests
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('CRITICAL PRIVACY ASSERTION: Local CSV parsing & profiling generates strictly 0 network requests', () => {
    const rawHeaders = ['ID', 'CustomerName', 'Email', 'TransactionAmount', 'InternalNotes'];
    const rawRows = [
      ['101', 'John Doe', 'john.doe@example.com', '1250.50', 'RESTRICTED_NOTE_A'],
      ['102', 'Jane Smith', 'jane.smith@corporate.org', '450.00', 'RESTRICTED_NOTE_B'],
      ['103', 'Bob Johnson', 'bob.j@secure.net', '890.25', 'RESTRICTED_NOTE_C'],
    ];

    // Profile the dataset locally
    const profile = profileCsvData('confidential_financials.csv', rawHeaders, rawRows, 1024);

    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(5);

    // Assert that ZERO network calls were made during the entire local profiling process
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('CRITICAL PRIVACY ASSERTION: AI payload building strips raw records with strictly 0 network requests', () => {
    const rawHeaders = ['Email', 'Salary', 'TaxID'];
    const rawRows = [
      ['ceo@enterprise.com', '250000', 'TAX-999-01'],
      ['cfo@enterprise.com', '210000', 'TAX-999-02'],
    ];

    const profile = profileCsvData('payroll.csv', rawHeaders, rawRows, 500);

    // Build the AI summary payload
    const payload = buildAiPayload(profile, {
      includeTopValues: false,
      excludePiiByDefault: true,
    });

    // Zero raw cell values in payload string
    expect(payload).not.toContain('ceo@enterprise.com');
    expect(payload).not.toContain('TAX-999-01');

    // Assert zero network calls dispatched
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('CRITICAL PRIVACY ASSERTION: Deterministic charts & math query engine execute locally with 0 network calls', () => {
    const profile = profileCsvData(
      'sales.csv',
      ['Region', 'Revenue', 'Quantity'],
      [
        ['North', '500', '10'],
        ['South', '800', '15'],
        ['East', '300', '5'],
      ],
      400
    );

    // 1. Generate local charts
    const charts = generateDefaultCharts(profile);
    expect(charts.length).toBeGreaterThan(0);

    // 2. Execute local arithmetic operations
    const sumOp: QueryOperation = { type: 'sum', targetColumn: 'Revenue' };
    const sumResult = executeOperation(sumOp, profile, profile.previewRows);
    expect(sumResult.scalarValue).toBe(1600);

    const groupOp: QueryOperation = {
      type: 'groupBy',
      groupColumn: 'Region',
      targetColumn: 'Revenue',
      aggregate: 'sum',
    };
    const groupResult = executeOperation(groupOp, profile, profile.previewRows);
    expect(groupResult.tableData?.length).toBe(3);

    // Assert zero network calls dispatched
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('CRITICAL PRIVACY ASSERTION: Routing in Private mode without consent blocks cloud and dispatches 0 network calls', () => {
    // When on-device Nano is unavailable and user is in Private mode without consent
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 1200,
      hasCloudConsent: false,
      isDeviceModelAvailable: false,
    });

    expect(decision.needsConsent).toBe(true);
    expect(decision.reason).toContain('consent required');

    // Assert zero network calls dispatched
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
