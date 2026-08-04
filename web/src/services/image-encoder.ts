import type {
  ImageEncodeDataBase,
  ImageEncodeDataInit,
  ImageEncodeDataResult,
  ImageEncodeWorkerData,
} from './image-encoder.worker';
import { useAvailableFormatsStore } from '../providers/format';
import { generateUUID } from '../utils/general';

export type ImageEncodeFormat = 'PNG' | 'JPEG';

export const ImageEncodeMimetypeMap: Record<ImageEncodeFormat, string> = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
};

let worker: Worker | null = null;
const handlers: Record<string, (data: ImageEncodeDataBase) => void> = {};

export async function initEncoderWorker() {
  if (worker) {
    return;
  }
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment');
  }

  worker = new Worker(new URL('./image-encoder.worker.ts', import.meta.url), { type: 'module' });

  await new Promise<void>((resolve, reject) => {
    worker!.onmessage = (event) => {
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
    worker!.onerror = (error) => {
      reject(new Error(`Worker error: ${error.message}`));
    };
    worker!.postMessage({ type: 'init' });
  });

  worker.onmessage = (event) => {
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
}

function registerMessageHandler(id: string, callback: (data: ImageEncodeDataBase) => void) {
  handlers[id] = callback;
}

export async function encodeImage(imageData: ImageData, format: ImageEncodeFormat = 'PNG'): Promise<Uint8Array> {
  if (!worker) {
    throw new Error('Image encoder worker is not initialized');
  }
  return new Promise((resolve, reject) => {
    const id = generateUUID();
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
