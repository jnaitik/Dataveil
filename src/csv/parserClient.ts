import Papa from 'papaparse';
import { IncrementalProfiler, type DatasetProfile } from './profiler';
import type { WorkerOutgoingMessage, WorkerParseMessage } from './parser.worker';

export interface ParseProgress {
  rowsProcessed: number;
  percent: number;
}

export interface ParseOptions {
  onProgress?: (progress: ParseProgress) => void;
  signal?: AbortSignal;
}

export function parseAndProfileCsv(
  csvInput: string | File,
  fileName: string,
  fileSizeBytes: number,
  optionsOrProgress?: ParseOptions | ((progress: ParseProgress) => void),
  abortSignal?: AbortSignal
): Promise<DatasetProfile> {
  const options: ParseOptions =
    typeof optionsOrProgress === 'function'
      ? { onProgress: optionsOrProgress, signal: abortSignal }
      : optionsOrProgress || { signal: abortSignal };

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error('CSV parsing was cancelled by user.'));
    }

    // If Web Worker is supported in browser, offload to worker
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), {
          type: 'module',
        });

        const abortHandler = () => {
          worker.postMessage({ type: 'ABORT' });
          worker.terminate();
          reject(new Error('CSV parsing was cancelled by user.'));
        };

        if (options.signal) {
          options.signal.addEventListener('abort', abortHandler, { once: true });
        }

        worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
          const data = event.data;
          if (data.type === 'PROGRESS') {
            options.onProgress?.({
              rowsProcessed: data.rowsProcessed,
              percent: data.percent,
            });
          } else if (data.type === 'SUCCESS') {
            if (options.signal) {
              options.signal.removeEventListener('abort', abortHandler);
            }
            worker.terminate();
            resolve(data.profile);
          } else if (data.type === 'ERROR') {
            if (options.signal) {
              options.signal.removeEventListener('abort', abortHandler);
            }
            worker.terminate();
            reject(new Error(data.error));
          }
        };

        worker.onerror = () => {
          if (options.signal) {
            options.signal.removeEventListener('abort', abortHandler);
          }
          worker.terminate();
          // Fall back to main thread streaming on worker error
          fallbackMainThread(csvInput, fileName, fileSizeBytes, options)
            .then(resolve)
            .catch(reject);
        };

        const msg: WorkerParseMessage = {
          type: 'PARSE',
          fileName,
          fileSizeBytes,
        };

        if (typeof csvInput === 'string') {
          msg.csvString = csvInput;
        } else {
          msg.file = csvInput;
        }

        worker.postMessage(msg);
        return;
      } catch {
        // Fall back to main thread streaming
      }
    }

    fallbackMainThread(csvInput, fileName, fileSizeBytes, options).then(resolve).catch(reject);
  });
}

/**
 * Fallback main thread streaming parser (used in testing or if workers are blocked).
 * Uses chunking to prevent memory bloat.
 */
async function fallbackMainThread(
  csvInput: string | File,
  fileName: string,
  fileSizeBytes: number,
  options: ParseOptions
): Promise<DatasetProfile> {
  return new Promise((resolve, reject) => {
    const profiler = new IncrementalProfiler(fileName, fileSizeBytes);
    let totalRows = 0;

    let input = csvInput;
    if (typeof input === 'string') {
      input = input.replace(/^\uFEFF/, '');
      if (input.trim() === '') {
        return reject(new Error('The provided CSV file contains no readable rows.'));
      }
    }

    Papa.parse<string[]>(input as any, {
      chunkSize: 1024 * 1024 * 4,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      chunk: (results, parser) => {
        if (results.meta?.delimiter) {
          profiler.setDelimiter(results.meta.delimiter);
        }

        if (options.signal?.aborted) {
          parser.abort();
          return reject(new Error('CSV parsing was cancelled by user.'));
        }

        if (results.data && results.data.length > 0) {
          profiler.addRows(results.data);
          totalRows += results.data.length;
          options.onProgress?.({
            rowsProcessed: totalRows,
            percent: Math.min(99, Math.round((totalRows / 50000) * 100)),
          });
        }
      },
      complete: () => {
        try {
          const profile = profiler.finalize();
          if (profile.columnCount === 0) {
            return reject(new Error('The provided CSV file contains no readable rows.'));
          }
          resolve(profile);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => {
        reject(new Error(err.message || 'Main thread parsing error.'));
      },
    });
  });
}
