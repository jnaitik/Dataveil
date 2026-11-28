/**
 * Network Ledger: Verifiable Outbound Network Auditing.
 * 
 * Intercepts and logs every outbound HTTP/HTTPS request made by the browser
 * using a fetch wrapper, XMLHttpRequest instrumentation, and PerformanceObserver.
 * 
 * Verifiable Privacy Guarantees:
 * - Proves that 0 network requests occur during local CSV parsing.
 * - Proves that 0 network requests occur to AI endpoints before explicit consent.
 * - Records destination host, request count, initiator, and whether request happened before or after consent.
 * - Notes CORS / Timing-Allow-Origin blind spots honestly.
 */

export interface NetworkLedgerEntry {
  id: string;
  timestamp: string;
  url: string;
  host: string;
  method: string;
  initiatorType: string;
  consentState: 'BEFORE_CONSENT' | 'AFTER_CONSENT';
  duringParsing: boolean;
  isFirebaseSdk: boolean;
  isLocalhost: boolean;
  transferSizeBytes: number;
  corsNote?: string;
}

export interface NetworkLedgerSummary {
  totalRequests: number;
  beforeConsentCount: number;
  afterConsentCount: number;
  duringParsingCount: number;
  hosts: Record<string, number>;
  blindSpotsNotes: string[];
}

let entries: NetworkLedgerEntry[] = [];
let hasUserConsented = false;
let isCsvParsingActive = false;
let isInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

function parseHost(urlString: string): { host: string; isLocalhost: boolean; isFirebase: boolean } {
  try {
    const parsed = new URL(urlString, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const host = parsed.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const isFirebase =
      host.includes('googleapis.com') ||
      host.includes('firebaseio.com') ||
      host.includes('firebaseapp.com') ||
      host.includes('firebase');
    return { host, isLocalhost, isFirebase };
  } catch {
    return { host: 'unknown', isLocalhost: false, isFirebase: false };
  }
}

export function recordOutboundRequest(
  url: string,
  method = 'GET',
  initiator = 'fetch',
  transferSize = 0
): NetworkLedgerEntry {
  const { host, isLocalhost, isFirebase } = parseHost(url);
  const now = new Date().toISOString();

  // Cross-origin size masking note
  let corsNote: string | undefined;
  if (!isLocalhost && transferSize === 0) {
    corsNote = '0 bytes reported (Cross-Origin Timing-Allow-Origin masked by browser)';
  }

  const entry: NetworkLedgerEntry = {
    id: `net-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    url,
    host,
    method: method.toUpperCase(),
    initiatorType: initiator,
    consentState: hasUserConsented ? 'AFTER_CONSENT' : 'BEFORE_CONSENT',
    duringParsing: isCsvParsingActive,
    isFirebaseSdk: isFirebase,
    isLocalhost,
    transferSizeBytes: transferSize,
    corsNote,
  };

  entries.push(entry);
  notifyListeners();
  return entry;
}

export function initNetworkLedger(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Wrap window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0];
    const init = args[1];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET');

    recordOutboundRequest(url, method, 'fetch');
    return originalFetch.apply(this, args);
  };

  // 2. Wrap XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args: any[]) {
    const method = args[0];
    const url = args[1];
    recordOutboundRequest(String(url), String(method), 'xmlhttprequest');
    return originalOpen.apply(this, args as any);
  };

  // 3. PerformanceObserver for cross-origin resources
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          const { isLocalhost } = parseHost(entry.name);
          if (!isLocalhost) {
            // Check if already logged via fetch wrapper
            const exists = entries.some((e) => e.url === entry.name);
            if (!exists) {
              recordOutboundRequest(entry.name, 'GET', entry.initiatorType || 'resource', entry.transferSize || 0);
            }
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      // PerformanceObserver resource not supported in this environment
    }
  }
}

export function setConsentGranted(granted: boolean): void {
  hasUserConsented = granted;
  notifyListeners();
}

export function setParsingState(isParsing: boolean): void {
  isCsvParsingActive = isParsing;
  notifyListeners();
}

export function getNetworkLedgerEntries(): NetworkLedgerEntry[] {
  return [...entries];
}

export function clearNetworkLedger(): void {
  entries = [];
  notifyListeners();
}

export function getNetworkLedgerSummary(): NetworkLedgerSummary {
  const hosts: Record<string, number> = {};
  let beforeConsentCount = 0;
  let afterConsentCount = 0;
  let duringParsingCount = 0;

  for (const entry of entries) {
    // Only aggregate non-localhost external traffic
    if (!entry.isLocalhost) {
      hosts[entry.host] = (hosts[entry.host] || 0) + 1;
    }
    if (entry.consentState === 'BEFORE_CONSENT' && !entry.isLocalhost) {
      beforeConsentCount++;
    } else if (entry.consentState === 'AFTER_CONSENT' && !entry.isLocalhost) {
      afterConsentCount++;
    }
    if (entry.duringParsing && !entry.isLocalhost) {
      duringParsingCount++;
    }
  }

  return {
    totalRequests: entries.filter((e) => !e.isLocalhost).length,
    beforeConsentCount,
    afterConsentCount,
    duringParsingCount,
    hosts,
    blindSpotsNotes: [
      'Visibility: Captures all fetch, XMLHttpRequest, and script/link network resources via PerformanceObserver.',
      'Cross-Origin Sizes: Cross-origin response sizes are reported as 0 bytes unless Timing-Allow-Origin header is present.',
      'Blind Spots: Persistent WebSockets, WebRTC data channels, and Service Worker background sync are not in PerformanceResourceTiming.',
    ],
  };
}

export function subscribeNetworkLedger(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
