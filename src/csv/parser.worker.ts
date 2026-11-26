import Papa from 'papaparse';
import { IncrementalProfiler, type DatasetProfile } from './profiler';

export interface WorkerParseMessage {
  type: 'PARSE';
  file?: File;
  csvString?: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface WorkerAbortMessage {
  type: 'ABORT';
}

export type WorkerIncomingMessage = WorkerParseMessage | WorkerAbortMessage;

export interface WorkerSuccessResult {
  type: 'SUCCESS';
  profile: DatasetProfile;
}

export interface WorkerProgressResult {
  type: 'PROGRESS';
  rowsProcessed: number;
  percent: number;
}

export interface WorkerErrorResult {
  type: 'ERROR';
  error: string;
}

export type WorkerOutgoingMessage = WorkerSuccessResult | WorkerProgressResult | WorkerErrorResult;

let activeParser: { abort: () => void } | null = null;

self.onmessage = (e: MessageEvent<WorkerIncomingMessage>) => {
  if (e.data.type === 'ABORT') {
    if (activeParser) {
      activeParser.abort();
      activeParser = null;
    }
    return;
  }

  if (e.data.type === 'PARSE') {
    const { file, csvString, fileName, fileSizeBytes } = e.data;
    const input: File | string | undefined = file || csvString;

    if (!input) {
      self.postMessage({ type: 'ERROR', error: 'No CSV file or data provided.' } as WorkerErrorResult);
      return;
    }

    const profiler = new IncrementalProfiler(fileName, fileSizeBytes);
    let totalRowsProcessed = 0;
    let lastProgressReportTime = 0;

    try {
      Papa.parse<string[]>(input as any, {
        chunkSize: 1024 * 1024 * 4, // 4 MB chunks for optimal streaming
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
        chunk: (results, parser) => {
          activeParser = parser;

          if (results.meta?.delimiter) {
            profiler.setDelimiter(results.meta.delimiter);
          }

          if (results.errors && results.errors.length > 0) {
            // Log non-fatal row warnings if needed
          }

          if (results.data && results.data.length > 0) {
            profiler.addRows(results.data);
            totalRowsProcessed += results.data.length;

            const now = performance.now();
            if (now - lastProgressReportTime > 80) {
              lastProgressReportTime = now;
              // Estimate percentage based on processed rows/bytes if file
              const estPercent = fileSizeBytes > 0
                ? Math.min(99, Math.round((totalRowsProcessed * 120 / fileSizeBytes) * 100))
                : 50;

              self.postMessage({
                type: 'PROGRESS',
                rowsProcessed: totalRowsProcessed,
                percent: Math.max(1, estPercent),
              } as WorkerProgressResult);
            }
          }
        },
        complete: () => {
          activeParser = null;
          try {
            const profile = profiler.finalize();
            if (profile.columnCount === 0) {
              self.postMessage({
                type: 'ERROR',
                error: 'The provided CSV contains no valid columns or records.',
              } as WorkerErrorResult);
              return;
            }
            self.postMessage({ type: 'SUCCESS', profile } as WorkerSuccessResult);
          } catch (finErr) {
            self.postMessage({
              type: 'ERROR',
              error: finErr instanceof Error ? finErr.message : 'Error finalizing profile.',
            } as WorkerErrorResult);
          }
        },
        error: (err) => {
          activeParser = null;
          self.postMessage({
            type: 'ERROR',
            error: err.message || 'Worker CSV streaming error.',
          } as WorkerErrorResult);
        },
      });
    } catch (err) {
      activeParser = null;
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to start CSV parser worker.',
      } as WorkerErrorResult);
    }
  }
};
