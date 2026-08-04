import type {
  ImageEncodeDataBase,
  ImageEncodeDataInit,
  ImageEncodeDataResult,
  ImageEncodeWorkerData,
} from './image-encoder.worker';
import { useAvailableFormatsStore } from '../providers/format';

export type ImageEncodeFormat = 'PNG' | 'JPEG';

export const ImageEncodeMimetypeMap: Record<ImageEncodeFormat, string> = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
};

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
const handlers: Record<string, (data: ImageEncodeDataBase) => void> = {};

// a dead worker will never answer, so settle everything still waiting on it
function rejectPending(reason: string) {
  for (const id of Object.keys(handlers)) {
    const handler = handlers[id];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete handlers[id];
    handler({ id, success: false, error: reason });
  }
}

export function initEncoderWorker(): Promise<void> {
  initPromise ??= createWorker().catch((error: unknown) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function createWorker() {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment');
  }

  const created = new Worker(new URL('./image-encoder.worker.ts', import.meta.url), { type: 'module' });

  try {
    await new Promise<void>((resolve, reject) => {
      created.onmessage = (event) => {
        const data = event.data as ImageEncodeDataBase;
        const availableImageEncodeFormats: ImageEncodeFormat[] = [];
        if (data.success) {
          const initData = data as ImageEncodeDataInit;
          availableImageEncodeFormats.push(...initData.payload.formats);
          console.log(
            `Successfully initialized image encoder worker with ${availableImageEncodeFormats.length.toString()} formats`
          );
          useAvailableFormatsStore.setState({
            availableFormats: availableImageEncodeFormats,
          });
          resolve();
        } else if (data.error) {
          reject(new Error(data.error));
        } else {
          reject(new Error('Unknown error during worker initialization'));
        }
      };
      created.onerror = (error) => {
        reject(new Error(`Worker error: ${error.message}`));
      };
      created.postMessage({ type: 'init' });
    });
  } catch (error) {
    created.terminate();
    throw error;
  }

  created.onmessage = (event) => {
    const data = event.data as ImageEncodeDataBase;
    if (data.id === undefined) {
      return;
    }
    const handler = handlers[data.id];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (handler) {
      handler(data);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete handlers[data.id];
    }
  };
  created.onerror = (event) => {
    worker = null;
    initPromise = null;
    rejectPending(`Worker error: ${event.message}`);
  };

  worker = created;
}

function registerMessageHandler(id: string, callback: (data: ImageEncodeDataBase) => void) {
  handlers[id] = callback;
}

export async function encodeImage(imageData: ImageData, format: ImageEncodeFormat = 'PNG'): Promise<Uint8Array> {
  if (!worker) {
    throw new Error('Image encoder worker is not initialized');
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    registerMessageHandler(id, (data: ImageEncodeDataBase) => {
      if (data.success) {
        const resultData = data as ImageEncodeDataResult;
        resolve(new Uint8Array(resultData.payload.fileData));
      } else {
        reject(new Error(data.error || 'Unknown error during image encoding'));
      }
    });
    worker!.postMessage({ type: 'encode', id, payload: { imageData, format } } satisfies ImageEncodeWorkerData);
  });
}
