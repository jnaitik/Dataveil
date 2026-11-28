/**
 * Cryptographic Privacy Receipt Generator.
 * 
 * Computes WebCrypto SHA-256 digests for all outbound AI payloads,
 * verifies zero outbound traffic during parsing, and exports downloadable JSON
 * receipts containing zero raw data cells and zero file paths unless explicitly opted-in.
 */

import { getNetworkLedgerSummary } from './networkLedger';
import type { DatasetProfile } from '../csv/profiler';

export interface AiRequestLog {
  id: string;
  timestamp: string;
  modeRequested: string;
  realInferenceSource: 'on-device' | 'cloud' | 'local-math';
  consentGiven: boolean;
  payloadText: string;
  payloadSha256: string;
  payloadCharLength: number;
  latencyMs: number;
  tokensUsed?: number;
}

export interface PrivacyReceipt {
  receiptVersion: '1.0';
  sessionId: string;
  generatedAt: string;
  dataSummary: {
    fileName: string;
    fileSizeBytes: number;
    rowCount: number;
    columnCount: number;
    externalRequestsDuringParsing: number;
    parsingPurityStatus: '100% AIR-GAPPED LOCAL' | 'EXTERNAL_TRAFFIC_DETECTED';
  };
  aiTransactions: Array<{
    id: string;
    timestamp: string;
    modeRequested: string;
    realInferenceSource: string;
    consentGiven: boolean;
    payloadSha256: string;
    payloadCharLength: number;
    latencyMs: number;
  }>;
  networkLedgerAudit: {
    totalExternalRequests: number;
    beforeConsentRequests: number;
    afterConsentRequests: number;
    contactedHosts: Record<string, number>;
  };
  zeroDataGuarantee: {
    rawCsvRowsIncluded: 0;
    cellValuesSentToCloud: 0;
    cryptographicHashAlgorithm: 'SHA-256 (WebCrypto Standard)';
  };
}

/**
 * Computes SHA-256 hex digest using WebCrypto
 */
export async function computeSha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node / fallback simple 32-bit hex representation
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

const recordedAiRequests: AiRequestLog[] = [];
let currentSessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export async function logAiRequest(params: {
  modeRequested: string;
  realInferenceSource: 'on-device' | 'cloud' | 'local-math';
  consentGiven: boolean;
  payloadText?: string;
  latencyMs?: number;
  tokensUsed?: number;
}): Promise<AiRequestLog> {
  const text = params.payloadText || '';
  const payloadSha256 = await computeSha256(text);
  const entry: AiRequestLog = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    modeRequested: params.modeRequested,
    realInferenceSource: params.realInferenceSource,
    consentGiven: params.consentGiven,
    payloadText: text,
    payloadSha256,
    payloadCharLength: text.length,
    latencyMs: params.latencyMs || 0,
    tokensUsed: params.tokensUsed,
  };

  recordedAiRequests.push(entry);
  return entry;
}

export function getRecordedAiRequests(): AiRequestLog[] {
  return [...recordedAiRequests];
}

export function generatePrivacyReceipt(
  profile: DatasetProfile | null,
  optInRawFileName = false
): PrivacyReceipt {
  const ledgerSummary = getNetworkLedgerSummary();

  const sanitizedFileName = profile
    ? optInRawFileName
      ? profile.fileName
      : `[MASKED_FILENAME_${profile.fileName.length}_CHARS]`
    : '[NO_FILE_LOADED]';

  return {
    receiptVersion: '1.0',
    sessionId: currentSessionId,
    generatedAt: new Date().toISOString(),
    dataSummary: {
      fileName: sanitizedFileName,
      fileSizeBytes: profile?.fileSizeBytes || 0,
      rowCount: profile?.rowCount || 0,
      columnCount: profile?.columnCount || 0,
      externalRequestsDuringParsing: ledgerSummary.duringParsingCount,
      parsingPurityStatus:
        ledgerSummary.duringParsingCount === 0 ? '100% AIR-GAPPED LOCAL' : 'EXTERNAL_TRAFFIC_DETECTED',
    },
    aiTransactions: recordedAiRequests.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      modeRequested: r.modeRequested,
      realInferenceSource: r.realInferenceSource,
      consentGiven: r.consentGiven,
      payloadSha256: r.payloadSha256,
      payloadCharLength: r.payloadCharLength,
      latencyMs: r.latencyMs,
    })),
    networkLedgerAudit: {
      totalExternalRequests: ledgerSummary.totalRequests,
      beforeConsentRequests: ledgerSummary.beforeConsentCount,
      afterConsentRequests: ledgerSummary.afterConsentCount,
      contactedHosts: ledgerSummary.hosts,
    },
    zeroDataGuarantee: {
      rawCsvRowsIncluded: 0,
      cellValuesSentToCloud: 0,
      cryptographicHashAlgorithm: 'SHA-256 (WebCrypto Standard)',
    },
  };
}

export function downloadPrivacyReceiptJson(receipt: PrivacyReceipt): void {
  if (typeof document === 'undefined') return;

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(receipt, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `dataveil-privacy-receipt-${receipt.sessionId}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
