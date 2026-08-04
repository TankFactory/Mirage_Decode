import type { ImageEncodeFormat } from './image-encoder';

type ImageEncodeTaskType = 'encode' | 'init';

export interface ImageEncodeDataBase {
  // absent on init responses, which are not tied to a request
  id?: string;
  success: boolean;
  error?: string;
}

export interface ImageEncodeDataInit extends ImageEncodeDataBase {
  payload: {
    formats: ImageEncodeFormat[];
  };
}

export interface ImageEncodeDataResult extends ImageEncodeDataBase {
  payload: {
    fileData: ArrayBufferLike;
  };
}

export interface ImageEncodeWorkerData {
  type: ImageEncodeTaskType;
  id: string;
  payload: {
    format: ImageEncodeFormat;
    imageData: ImageData;
  };
}

const messageQueue: ImageEncodeWorkerData[] = [];
const encoders: Map<string, ImageEncoderBase> = new Map();
let isInited = false;
let isProcessing = false;

self.onmessage = (event) => {
  const data = event.data as ImageEncodeWorkerData;
  switch (data.type) {
    case 'init':
      if (isInited) {
        postMessage({
          success: true,
          payload: { formats: Array.from(encoders.keys()) as ImageEncodeFormat[] },
        } satisfies ImageEncodeDataInit);
      }

      try {
        if (ImageEncoderJPEG.isAvailable()) {
          encoders.set('JPEG', new ImageEncoderJPEG());
        }
      } catch (error) {
        console.error('Failed to initialize JPEG encoder:', error);
      }

      try {
        if (ImageEncoderPNG.isAvailable()) {
          encoders.set('PNG', new ImageEncoderPNG());
        }
      } catch (error) {
        console.error('Failed to initialize PNG encoder:', error);
      }

      isInited = true;
      postMessage({
        success: true,
        payload: { formats: Array.from(encoders.keys()) as ImageEncodeFormat[] },
      } satisfies ImageEncodeDataInit);
      break;
    case 'encode':
      if (!isInited) {
        postMessage({ success: false, id: data.id, error: 'Worker is not initialized' } satisfies ImageEncodeDataBase);
      }
      messageQueue.push(data);
      if (!isProcessing) {
        isProcessing = true;
        processQueue()
          .catch((error: unknown) => {
            console.error('Error processing image queue:', error);
            postMessage({
              success: false,
              id: data.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            } satisfies ImageEncodeDataBase);
          })
          .finally(() => {
            isProcessing = false;
          });
      }
      break;
  }
};

async function processQueue() {
  while (messageQueue.length > 0) {
    const { id, payload } = messageQueue.shift()!;
    const encoder = encoders.get(payload.format);
    if (!encoder) {
      postMessage({ success: false, id, error: `Encoder for format ${payload.format} not found` } satisfies ImageEncodeDataBase);
      continue;
    }
    try {
      const fileData = await encoder.encode(payload.imageData);
      postMessage({ success: true, id, payload: { fileData: fileData.buffer } } satisfies ImageEncodeDataResult, {
        transfer: [fileData.buffer],
      });
    } catch (error) {
      console.error(`Error encoding image with format ${payload.format}:`, error);
      postMessage({
        success: false,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies ImageEncodeDataBase);
    }
  }
}

abstract class ImageEncoderBase {
  abstract encode(imageData: ImageData): Promise<Uint8Array>;
}

class ImageEncoderJPEG extends ImageEncoderBase {
  static isAvailable(): boolean {
    // avoid importing modules if not needed
    return true;
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const JPEG = await import('./encoder/jpeg-js-enc-wrap');
    return JPEG.encode(imageData);
  }
}

class ImageEncoderPNG extends ImageEncoderBase {
  static isAvailable(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  async encode(imageData: ImageData): Promise<Uint8Array> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
