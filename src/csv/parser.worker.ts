import Papa from 'papaparse';
import { profileCsvData, type DatasetProfile } from './profiler';

export interface WorkerMessage {
  type: 'PARSE';
  csvString: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface WorkerSuccessResult {
  type: 'SUCCESS';
  profile: DatasetProfile;
}

export interface WorkerErrorResult {
  type: 'ERROR';
  error: string;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'PARSE') {
    const { csvString, fileName, fileSizeBytes } = e.data;

    try {
      // Strip UTF-8 BOM if present
      const cleanCsv = csvString.replace(/^\uFEFF/, '');

      const parsed = Papa.parse<string[]>(cleanCsv, {
        header: false,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
      });

      if (!parsed.data || parsed.data.length === 0) {
        self.postMessage({ type: 'ERROR', error: 'The provided CSV file contains no readable rows.' } as WorkerErrorResult);
        return;
      }

      const rawHeaders = parsed.data[0];
      const rows = parsed.data.slice(1);
      const delimiter = parsed.meta.delimiter || ',';

      const profile = profileCsvData(fileName, rawHeaders, rows, fileSizeBytes, delimiter);
      self.postMessage({ type: 'SUCCESS', profile } as WorkerSuccessResult);
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to parse CSV.',
      } as WorkerErrorResult);
    }
  }
};
