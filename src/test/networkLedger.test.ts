import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordOutboundRequest,
  getNetworkLedgerEntries,
  getNetworkLedgerSummary,
  clearNetworkLedger,
  setConsentGranted,
  setParsingState,
} from '../lib/networkLedger';

describe('Network Ledger Auditing Engine (Phase 11)', () => {
  beforeEach(() => {
    clearNetworkLedger();
    setConsentGranted(false);
    setParsingState(false);
  });

  it('records outbound requests and parses host details', () => {
    recordOutboundRequest('https://firebase.googleapis.com/v1/projects', 'POST', 'fetch');
    recordOutboundRequest('http://localhost:5173/src/App.tsx', 'GET', 'resource', 1024);

    const entries = getNetworkLedgerEntries();
    expect(entries.length).toBe(2);

    const fbEntry = entries[0];
    expect(fbEntry.host).toBe('firebase.googleapis.com');
    expect(fbEntry.isFirebaseSdk).toBe(true);
    expect(fbEntry.isLocalhost).toBe(false);
    expect(fbEntry.consentState).toBe('BEFORE_CONSENT');
    expect(fbEntry.duringParsing).toBe(false);

    const localEntry = entries[1];
    expect(localEntry.isLocalhost).toBe(true);
  });

  it('accurately tracks parsing air-gap state', () => {
    setParsingState(true);
    recordOutboundRequest('https://api.external.com/telemetry', 'GET');
    setParsingState(false);
    recordOutboundRequest('https://api.external.com/query', 'POST');

    const summary = getNetworkLedgerSummary();
    expect(summary.duringParsingCount).toBe(1);
    expect(summary.totalRequests).toBe(2);
  });

  it('tracks transition from BEFORE_CONSENT to AFTER_CONSENT', () => {
    recordOutboundRequest('https://example.com/a', 'GET');
    expect(getNetworkLedgerEntries()[0].consentState).toBe('BEFORE_CONSENT');

    setConsentGranted(true);
    recordOutboundRequest('https://example.com/b', 'POST');
    expect(getNetworkLedgerEntries()[1].consentState).toBe('AFTER_CONSENT');

    const summary = getNetworkLedgerSummary();
    expect(summary.beforeConsentCount).toBe(1);
    expect(summary.afterConsentCount).toBe(1);
  });

  it('honestly documents CORS and Timing-Allow-Origin blind spots', () => {
    const summary = getNetworkLedgerSummary();
    expect(summary.blindSpotsNotes.length).toBeGreaterThan(0);
    expect(summary.blindSpotsNotes.some((n) => n.includes('Cross-origin') || n.includes('Cross-Origin'))).toBe(true);
  });
});
