import Papa from 'papaparse';
import { profileCsvData, type DatasetProfile } from './profiler';
import { streamAndProfileCsv, type StreamingProgress } from './streamingProfiler';

export type WorkerInMessage =
  | {
      type: 'PARSE';
      csvString: string;
      fileName: string;
      fileSizeBytes: number;
    }
  | {
      type: 'PARSE_STREAM';
      file: File | Blob;
      fileName: string;
      fileSizeBytes: number;
      chunkSize?: number;
    }
  | {
      type: 'ABORT';
    };

export type WorkerOutMessage =
  | {
      type: 'PROGRESS';
      progress: StreamingProgress;
    }
  | {
      type: 'SUCCESS';
      profile: DatasetProfile;
    }
  | {
      type: 'ERROR';
      error: string;
    };

let activeAbortController: AbortController | null = null;

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'ABORT') {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    return;
  }

  if (msg.type === 'PARSE') {
    const { csvString, fileName, fileSizeBytes } = msg;
    try {
      // Strip UTF-8 BOM if present
      const cleanCsv = csvString.replace(/^\uFEFF/, '');
      const parsed = Papa.parse<string[]>(cleanCsv, {
        header: false,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
      });

      if (!parsed.data || parsed.data.length === 0) {
        self.postMessage({ type: 'ERROR', error: 'The provided CSV file contains no readable rows.' } as WorkerOutMessage);
        return;
      }

      const rawHeaders = parsed.data[0];
      const rows = parsed.data.slice(1);
      const delimiter = parsed.meta.delimiter || ',';

      const profile = profileCsvData(fileName, rawHeaders, rows, fileSizeBytes, delimiter);
      self.postMessage({ type: 'SUCCESS', profile } as WorkerOutMessage);
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to parse CSV.',
      } as WorkerOutMessage);
    }
    return;
  }

  if (msg.type === 'PARSE_STREAM') {
    const { file, fileName, fileSizeBytes, chunkSize } = msg;
    activeAbortController = new AbortController();

    try {
      const profile = await streamAndProfileCsv(file, {
        fileName,
        fileSizeBytes,
        chunkSize,
        abortSignal: activeAbortController.signal,
        onProgress: (progress) => {
          self.postMessage({
            type: 'PROGRESS',
            progress,
          } as WorkerOutMessage);
        },
      });

      self.postMessage({
        type: 'SUCCESS',
        profile,
      } as WorkerOutMessage);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      self.postMessage({
        type: 'ERROR',
        error: isAbort ? 'Parsing was cancelled.' : err instanceof Error ? err.message : 'Failed to stream CSV.',
      } as WorkerOutMessage);
    } finally {
      activeAbortController = null;
    }
  }
};
