import Papa from 'papaparse';
import { profileCsvData, type DatasetProfile } from './profiler';
import type { WorkerMessage, WorkerSuccessResult, WorkerErrorResult } from './parser.worker';

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

        worker.onmessage = (event: MessageEvent<WorkerSuccessResult | WorkerErrorResult>) => {
          worker.terminate();
          if (event.data.type === 'SUCCESS') {
            resolve(event.data.profile);
          } else {
            reject(new Error(event.data.error));
          }
        };

        worker.onerror = () => {
          worker.terminate();
          // Fall back to main thread on worker failure
          fallbackMainThread(csvString, fileName, fileSizeBytes)
            .then(resolve)
            .catch(reject);
        };

        const msg: WorkerMessage = {
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
