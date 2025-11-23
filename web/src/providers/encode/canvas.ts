import { nullPtr, type Ptr } from '../../utils/general';
import { PrismCanvas } from '../image-canvas';
import { usePrismEncodeImageStore, usePrismEncodeStore } from './state';
import type { PrismImage } from '../../models/image';
import { type ImageEncodeFormat } from '../../services/image-encoder';
import { ImageProcess } from '../../services/image-process';

// srcData
// resizedData
// adjustedData (gray | contrast)
export class EncodeInputCanvas extends PrismCanvas {
  // super.srcData
  protected resizedData: Ptr<ImageData> = nullPtr();
  readonly adjustedData: Ptr<ImageData> = nullPtr(); // can share same ImageData object with resizedData

  protected isInner: boolean;

  constructor(isInner: boolean) {
    super();
    this.isInner = isInner;
  }

  bind(canvas: HTMLCanvasElement) {
    super.bind(canvas);
  }

  resizeFit() {
    if (!this.srcData.v) {
      return;
    }
    const { maxSize } = usePrismEncodeStore.getState();
    ImageProcess.resizeFit(maxSize, this.srcData, this.resizedData);
  }

  resizeCover(width: number, Height: number) {
    if (!this.srcData.v) {
      return;
    }
    ImageProcess.resizeCover(width, Height, this.srcData, this.resizedData);
  }

  getSize() {
    return {
      width: this.resizedData.v?.width ?? 0,
      height: this.resizedData.v?.height ?? 0,
    };
  }

  adjust() {
    if (!this.resizedData.v) {
      return;
    }
    let gray: boolean, contrast: number;
    if (this.isInner) {
      gray = usePrismEncodeStore.getState().isInnerGray;
      contrast = usePrismEncodeStore.getState().innerContrast;
    } else {
      gray = usePrismEncodeStore.getState().isCoverGray;
      contrast = usePrismEncodeStore.getState().coverContrast;
    }
    const temp: Ptr<ImageData> = nullPtr();
    if (gray) {
      ImageProcess.toGray(this.resizedData, temp);
    } else {
      temp.v = this.resizedData.v;
    }
    const temp2: Ptr<ImageData> = nullPtr();
    if (contrast !== 0) {
      ImageProcess.adjustContrast(contrast, temp, temp2);
    } else {
      temp2.v = temp.v;
    }
    this.adjustedData.v = temp2.v;
  }
}

export class EncodeResultCanvas extends PrismCanvas {
  private inner: EncodeInputCanvas = new EncodeInputCanvas(true);
  private cover: EncodeInputCanvas = new EncodeInputCanvas(false);

  readonly resultData: Ptr<ImageData> = nullPtr();

  bind(canvas: HTMLCanvasElement) {
    super.bind(canvas);
    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.maxSize,
        () => {
          this.resize();
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.innerContrast,
        () => {
          this.inner.adjust();
          this.inner.putImageData(this.inner.adjustedData);
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.coverContrast,
        () => {
          this.cover.adjust();
          this.cover.putImageData(this.cover.adjustedData);
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.isInnerGray,
        () => {
          this.inner.adjust();
          this.inner.putImageData(this.inner.adjustedData);
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.isCoverGray,
        () => {
          this.cover.adjust();
          this.cover.putImageData(this.cover.adjustedData);
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.blendMode,
        () => {
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.innerThreshold,
        () => {
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.coverThreshold,
        () => {
          this.encodeResult();
        }
      )
    );

    this.subscribe(
      usePrismEncodeStore.subscribe(
        (state) => state.isReverse,
        () => {
          this.encodeResult();
        }
      )
    );

    // fire immediately
    this.resize();
    this.encodeResult();
  }

  unbind() {
    super.unbind();
  }

  setInnerImage(image: PrismImage) {
    this.inner.setImage(image, false);
    this.resize();
    if (!this.cover.hasImage()) {
      return;
    }
    this.encodeResult();
  }

  setCoverImage(image: PrismImage) {
    this.cover.setImage(image, false);
    if (!this.inner.hasImage()) {
      this.cover.putImageData(this.cover.srcData);
      return;
    }
    this.resize();
    this.encodeResult();
  }

  // 1. resize inner image to avoid exceeding maxSize
  // 2. resize cover image to have the exact same size as inner image
  resize() {
    if (!this.inner.hasImage()) {
      return;
    }
    this.inner.resizeFit();
    this.inner.adjust();
    this.inner.putImageData(this.inner.adjustedData);
    if (!this.cover.hasImage()) {
      return;
    }
    const { width, height } = this.inner.getSize();
    this.cover.resizeCover(width, height);
    this.cover.adjust();
    this.cover.putImageData(this.cover.adjustedData);
  }

  bindInner = (canvas: HTMLCanvasElement) => {
    this.inner.bind(canvas);
  };

  bindCover = (canvas: HTMLCanvasElement) => {
    this.cover.bind(canvas);
  };

  unbindInner = () => {
    this.inner.unbind();
  };

  unbindCover = () => {
    this.cover.unbind();
  };

  encodeResult() {
    const inner = this.inner.adjustedData.v;
    const cover = this.cover.adjustedData.v;
    if (!inner || !cover || inner.width !== cover.width || inner.height !== cover.height) {
      return;
    }

    if (!this.resultData.v || this.resultData.v.width !== inner.width || this.resultData.v.height !== inner.height) {
      this.resultData.v = new ImageData(inner.width, inner.height);
    }
    const result = this.resultData.v;

    const {
      innerThreshold,
      coverThreshold,
      blendMode: { slope, gap, isRow },
      isReverse,
    } = usePrismEncodeStore.getState();

    const config = {
      innerThreshold,
      coverThreshold,
      slope,
      gap,
      isRow,
      isReverse,
    };

    ImageProcess.prismEncode(inner, cover, result, config);
    this.resultData.v = result;
    usePrismEncodeImageStore.getState().haveResult = true;
    this.putImageData(this.resultData);
  }

  async saveResult(format: ImageEncodeFormat) {
    const { innerThreshold, innerContrast, isReverse } = usePrismEncodeStore.getState();
    const metadata = ImageProcess.encodePreset(innerThreshold, innerContrast, isReverse);
    const encoded = await this.encodeImageFile(this.resultData, format, metadata);
    return this.saveImageFile(encoded, format);
  }

  encodeResultToFile(format: ImageEncodeFormat) {
    const { innerThreshold, innerContrast, isReverse } = usePrismEncodeStore.getState();
    const metadata = ImageProcess.encodePreset(innerThreshold, innerContrast, isReverse);
    return this.encodeImageFile(this.resultData, format, metadata);
  }
}

export const prismEncodeCanvas = new EncodeResultCanvas();
