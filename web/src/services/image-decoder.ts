import type {
  ImageDecodeDataBase,
  ImageDecodeDataInit,
  ImageDecodeDataResult,
  ImageDecodeWorkerData,
} from './image-decoder.worker';

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
const handlers: Record<string, (data: ImageDecodeDataBase) => void> = {};

// a dead worker will never answer, so settle everything still waiting on it
function rejectPending(reason: string) {
  for (const id of Object.keys(handlers)) {
    const handler = handlers[id];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete handlers[id];
    handler({ id, success: false, error: reason });
  }
}

// cache the promise, not the worker: callers must await the same handshake
// instead of racing ahead once the Worker object merely exists
export function initDecoderWorker(): Promise<void> {
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

  const created = new Worker(new URL('./image-decoder.worker.ts', import.meta.url), { type: 'module' });

  try {
    await new Promise<void>((resolve, reject) => {
      created.onmessage = (event) => {
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
  created.onerror = (event) => {
    worker = null;
    initPromise = null;
    rejectPending(`Worker error: ${event.message}`);
  };

  worker = created;
}

function registerMessageHandler(id: string, callback: (data: ImageDecodeDataBase) => void) {
  handlers[id] = callback;
}

export async function decodeImage(fileData: Uint8Array): Promise<ImageData> {
  if (!worker) {
    throw new Error('Image decoder worker is not initialized');
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
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
