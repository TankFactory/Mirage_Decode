import type { PrismDecodeConfig, PrismDecodeService } from '../../../services/prism-decode';
import type { PrismDecodeMethod } from '../../../providers/decode/state';
import type { FallbackProcessConstructor } from './common';

const processCoverPixel: Record<PrismDecodeMethod, (data: Uint8ClampedArray, width: number, i: number) => void> = {
  black: (data, _, i) => {
    data[i] = 0; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  },
  white: (data, _, i) => {
    data[i] = 255; // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = 255; // A
  },
  transparent: (data, _, i) => {
    data[i] = 0; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 0; // A
  },
  lcopy: (data, width, i) => {
    const index = i / 4;
    if (index % width === 0) {
      processCoverPixel.black(data, width, i);
      return;
    }
    data[i] = data[i - 4]; // R
    data[i + 1] = data[i - 3]; // G
    data[i + 2] = data[i - 2]; // B
    data[i + 3] = data[i - 1]; // A
  },
  tcopy: (data, width, i) => {
    const src = i - width * 4;
    if (src < 0) {
      processCoverPixel.black(data, width, i);
      return;
    }
    data[i] = data[src]; // R
    data[i + 1] = data[src + 1]; // G
    data[i + 2] = data[src + 2]; // B
    data[i + 3] = data[src + 3]; // A
  },
  ltavg: (data, width, i) => {
    // most left-top pixel
    if (!i) {
      processCoverPixel.black(data, width, i);
      return;
    }

    const top = i - width * 4;
    // first row
    if (top < 0) {
      processCoverPixel.lcopy(data, width, i);
      return;
    }
    // first column
    if ((i / 4) % width === 0) {
      processCoverPixel.tcopy(data, width, i);
      return;
    }
    const left = i - 4;
    const lt = i - width * 4 - 4;
    const r = (data[left] + data[top] + data[lt]) / 3;
    const g = (data[left + 1] + data[top + 1] + data[lt + 1]) / 3;
    const b = (data[left + 2] + data[top + 2] + data[lt + 2]) / 3;
    const a = (data[left + 3] + data[top + 3] + data[lt + 3]) / 3;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  },
};

function scaleContrastExpand(value: number): number {
  return Math.max(Math.min(((value - 50) * 255) / 50, 255), -255);
}

export function FallbackDecodeProcess<TBase extends FallbackProcessConstructor>(Base: TBase) {
  return class extends Base implements PrismDecodeService {
    prismDecode(imageData: ImageData, newImageData: ImageData, { lowerThreshold, higherThreshold, method }: PrismDecodeConfig) {
      const data = imageData.data;
      const newData = newImageData.data;

      if (higherThreshold <= lowerThreshold) {
        for (let i = 0; i < newData.length; i += 4) {
          newData[i] = 0; // R
          newData[i + 1] = 0; // G
          newData[i + 2] = 0; // B
          newData[i + 3] = data[i + 3]; // A
        }
        return;
      }

      const scaleRatio = 255 / (higherThreshold - lowerThreshold);
      const scale = (v: number) => {
        return Math.max(Math.min((v - lowerThreshold) * scaleRatio, 255), 0);
      };
      const processCover = processCoverPixel[method];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = r * 0.299 + g * 0.587 + b * 0.114;
        const a = data[i + 3];

        if (l >= lowerThreshold && l <= higherThreshold) {
          newData[i] = scale(r);
          newData[i + 1] = scale(g);
          newData[i + 2] = scale(b);
          newData[i + 3] = a;
        } else {
          processCover(newData, imageData.width, i);
        }
      }
    }

    // 'values' should be constructed with default values
    // and will be modified if valid value is found in 'str'
    decodePreset(str: string, values: PrismDecodeConfig) {
      if (str.length === 0) {
        return false;
      }
      // 0 / 1
      const isReversed = str[0] === '1';
      // 2 digits hex
      if (str.length < 3) {
        return;
      }
      const threshold = parseInt(str.slice(1, 3), 16);
      if (isNaN(threshold)) {
        return;
      }
      if (isReversed) {
        values.lowerThreshold = 255 - threshold;
        values.higherThreshold = 255;
      } else {
        values.lowerThreshold = 0;
        values.higherThreshold = threshold;
      }
      // 2 digits hex
      if (str.length < 5) {
        return;
      }
      const contrast = parseInt(str.slice(3, 5), 16);
      if (isNaN(contrast) || contrast < 0 || contrast > 100) {
        return;
      }
      values.contrast = scaleContrastExpand(100 - contrast);
      return;
    }
  };
}
