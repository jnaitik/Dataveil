import Papa from 'papaparse';
import { profileCsvData, type DatasetProfile } from './profiler';
import { streamAndProfileCsv, type StreamingProgress } from './streamingProfiler';
import type { WorkerInMessage, WorkerOutMessage } from './parser.worker';

export type { StreamingProgress };

export interface StreamingParseHandle {
  promise: Promise<DatasetProfile>;
  cancel: () => void;
}

/**
 * Streaming parser client with Web Worker offloading, throttled progress updates,
 * and immediate cancellation capability. Handles up to 500 MB without holding all rows in memory.
 */
export function parseAndProfileStream(
  input: File | Blob | string,
  fileName: string,
  fileSizeBytes: number,
  onProgress?: (progress: StreamingProgress) => void
): StreamingParseHandle {
  let isCompleted = false;
  let cancelFn = () => {};

  const promise = new Promise<DatasetProfile>((resolve, reject) => {
    // If Web Worker is supported in browser, offload to worker
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), {
          type: 'module',
        });

        cancelFn = () => {
          if (!isCompleted) {
            isCompleted = true;
            try {
              worker.postMessage({ type: 'ABORT' } as WorkerInMessage);
              worker.terminate();
            } catch {
              // ignore
            }
            reject(new DOMException('Parsing cancelled by user', 'AbortError'));
          }
        };

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          const data = event.data;
          if (data.type === 'PROGRESS') {
            onProgress?.(data.progress);
          } else if (data.type === 'SUCCESS') {
            isCompleted = true;
            worker.terminate();
            resolve(data.profile);
          } else if (data.type === 'ERROR') {
            isCompleted = true;
            worker.terminate();
            reject(new Error(data.error));
          }
        };

        worker.onerror = () => {
          if (!isCompleted) {
            isCompleted = true;
            worker.terminate();
            // Fall back to main thread streaming
            fallbackMainThreadStreaming(input, fileName, fileSizeBytes, onProgress)
              .then(resolve)
              .catch(reject);
          }
        };

        // If input is string, convert to Blob for consistent streaming transfer if needed
        const payloadFile = typeof input === 'string' ? new Blob([input], { type: 'text/csv' }) : input;

        worker.postMessage({
          type: 'PARSE_STREAM',
          file: payloadFile,
          fileName,
          fileSizeBytes,
        } as WorkerInMessage);
        return;
      } catch {
        // Fall back to main thread
      }
    }

    // Main thread / jsdom fallback
    const abortCtrl = new AbortController();
    cancelFn = () => {
      if (!isCompleted) {
        isCompleted = true;
        abortCtrl.abort();
        reject(new DOMException('Parsing cancelled by user', 'AbortError'));
      }
    };

    fallbackMainThreadStreaming(input, fileName, fileSizeBytes, onProgress, abortCtrl.signal)
      .then((p) => {
        isCompleted = true;
        resolve(p);
      })
      .catch((err) => {
        isCompleted = true;
        reject(err);
      });
  });

  return {
    promise,
    cancel: cancelFn,
  };
}

async function fallbackMainThreadStreaming(
  input: File | Blob | string,
  fileName: string,
  fileSizeBytes: number,
  onProgress?: (progress: StreamingProgress) => void,
  abortSignal?: AbortSignal
): Promise<DatasetProfile> {
  return streamAndProfileCsv(input, {
    fileName,
    fileSizeBytes,
    onProgress,
    abortSignal,
  });
}

/**
 * Legacy in-memory CSV parsing interface (for tests and string fixtures)
 */
export function parseAndProfileCsv(
  csvString: string,
  fileName: string,
  fileSizeBytes: number
): Promise<DatasetProfile> {
  return new Promise((resolve, reject) => {
    // If Web Worker is supported in browser, offload to worker
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), {
          type: 'module',
        });

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          worker.terminate();
          if (event.data.type === 'SUCCESS') {
            resolve(event.data.profile);
          } else if (event.data.type === 'ERROR') {
            reject(new Error(event.data.error));
          }
        };

        worker.onerror = () => {
          worker.terminate();
          fallbackMainThread(csvString, fileName, fileSizeBytes)
            .then(resolve)
            .catch(reject);
        };

        const msg: WorkerInMessage = {
          type: 'PARSE',
          csvString,
          fileName,
          fileSizeBytes,
        };
        worker.postMessage(msg);
        return;
      } catch {
        // Fall back to main thread
      }
    }

    fallbackMainThread(csvString, fileName, fileSizeBytes).then(resolve).catch(reject);
  });
}

async function fallbackMainThread(
  csvString: string,
  fileName: string,
  fileSizeBytes: number
): Promise<DatasetProfile> {
  const cleanCsv = csvString.replace(/^\uFEFF/, '');
  const parsed = Papa.parse<string[]>(cleanCsv, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error('The provided CSV file contains no readable rows.');
  }

  const rawHeaders = parsed.data[0];
  const rows = parsed.data.slice(1);
  const delimiter = parsed.meta.delimiter || ',';

  return profileCsvData(fileName, rawHeaders, rows, fileSizeBytes, delimiter);
}
