import { generateUUID } from '../utils/general';
import type {
  ImageDecodeDataBase,
  ImageDecodeDataInit,
  ImageDecodeDataResult,
  ImageDecodeWorkerData,
} from './image-decoder.worker';

let worker: Worker | null = null;
const handlers: Record<string, (data: ImageDecodeDataBase) => void> = {};

export async function initDecoderWorker() {
  if (worker) {
    return;
  }

  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment');
  }

  worker = new Worker(new URL('./image-decoder.worker.ts', import.meta.url), { type: 'module' });

  await new Promise<void>((resolve, reject) => {
    worker!.onmessage = (event) => {
      const data = event.data as ImageDecodeDataBase;
      if (data.success) {
        const initData = data as ImageDecodeDataInit;
        console.log(`Successfully initialized image decoder worker with ${initData.payload.decoderCount.toString()} decoders`);
        resolve();
      } else if (data.error) {
        reject(new Error(data.error));
      } else {
        reject(new Error('Unknown error during worker initialization'));
      }
    };
    worker!.onerror = (eror) => {
      reject(new Error(`Worker error: ${eror.message}`));
    };
    worker!.postMessage({ type: 'init' });
  });

  worker.onmessage = (event) => {
    const data = event.data as ImageDecodeDataBase;
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
}

function registerMessageHandler(id: string, callback: (data: ImageDecodeDataBase) => void) {
  handlers[id] = callback;
}

export async function decodeImage(fileData: Uint8Array): Promise<ImageData> {
  if (!worker) {
    throw new Error('Image decoder worker is not initialized');
  }
  return new Promise((resolve, reject) => {
    const id = generateUUID();
    registerMessageHandler(id, (data: ImageDecodeDataBase) => {
      if (data.success) {
        const resultData = data as ImageDecodeDataResult;
        resolve(
          new ImageData(new Uint8ClampedArray(resultData.payload.data), resultData.payload.width, resultData.payload.height)
        );
      } else {
        reject(new Error(data.error || 'Unknown error during image decoding'));
      }
    });
    worker!.postMessage({ type: 'decode', id, payload: { fileData: fileData.buffer } } satisfies ImageDecodeWorkerData);
  });
}
