import { create } from 'zustand';
import { AdvancedEncodeDefaultArgs } from '../../constants/default-arg';
import { immer } from 'zustand/middleware/immer';
import { prismAdvancedEncodeCanvas } from './canvas';
import { useEffect } from 'react';
import type { ImageEncodeFormat } from '../../services/image-encoder';

type AdvancedEncodeConfigState = {
  lowerThreshold: number;
  higherThreshold: number;
  contrast: number;
  isGray: boolean;
  weight: number;
};

type AdvancedEncodeConfigsStore = {
  configs: Record<number, AdvancedEncodeConfigState>; // since the indexed counld be discontinuous
  indexes: number[];
  size: {
    width: number;
    height: number;
  };
  saveFormat: ImageEncodeFormat;
  dontCareConflict: boolean;
  getMaxIndex: () => number;
  createConfig: () => void;
  getConfig: (index: number) => AdvancedEncodeConfigState;
  setConfigValue: (index: number, key: keyof AdvancedEncodeConfigState, value: unknown) => void;
  removeConfig: (index: number) => void;
  setSize: (width: number, height: number) => void;
  setDontCareConflict: (value: boolean) => void;
  testConflict: () => boolean;
  setSaveFormat: (format: ImageEncodeFormat) => void;
};

export const useAdvancedEncodeConfigsStore = create<AdvancedEncodeConfigsStore>()(
  immer<AdvancedEncodeConfigsStore>((set, get) => ({
    configs: {},
    indexes: [],
    size: {
      width: AdvancedEncodeDefaultArgs.width,
      height: AdvancedEncodeDefaultArgs.height,
    },
    saveFormat: AdvancedEncodeDefaultArgs.saveFormat,
    dontCareConflict: AdvancedEncodeDefaultArgs.dontCareConflict,

    getMaxIndex: () => {
      const indexes = get().indexes;
      return indexes.length > 0 ? indexes[indexes.length - 1] : -1;
    },

    createConfig: () => {
      const maxIndex = get().getMaxIndex();
      let l = AdvancedEncodeDefaultArgs.thresholdStart;
      if (maxIndex >= 0) {
        l = get().configs[maxIndex].higherThreshold + AdvancedEncodeDefaultArgs.thresholdGap;
      }
      let r = l + AdvancedEncodeDefaultArgs.thresholdWidth;
      if (r > 255) {
        r = 255;
      }
      if (l >= r) {
        l = AdvancedEncodeDefaultArgs.thresholdStart;
        r = l + AdvancedEncodeDefaultArgs.thresholdWidth;
      }
      const nextIndex = get().getMaxIndex() + 1;
      prismAdvancedEncodeCanvas.createInputCanvas(nextIndex);
      set((state) => {
        state.indexes.push(nextIndex);
        state.configs[nextIndex] = {
          lowerThreshold: l,
          higherThreshold: r,
          contrast: AdvancedEncodeDefaultArgs.contrast,
          isGray: AdvancedEncodeDefaultArgs.isGray,
          weight: AdvancedEncodeDefaultArgs.weight,
        };
      });
    },

    getConfig: (index: number) => {
      const config = get().configs[index];
      return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        config || {
          lowerThreshold: AdvancedEncodeDefaultArgs.thresholdStart,
          higherThreshold: AdvancedEncodeDefaultArgs.thresholdStart + AdvancedEncodeDefaultArgs.thresholdWidth,
          contrast: AdvancedEncodeDefaultArgs.contrast,
          isGray: AdvancedEncodeDefaultArgs.isGray,
          weight: AdvancedEncodeDefaultArgs.weight,
        }
      );
    },

    setConfigValue: (index: number, key: keyof AdvancedEncodeConfigState, value: unknown) => {
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (state.configs[index]) {
          switch (key) {
            case 'lowerThreshold':
            case 'higherThreshold':
            case 'contrast':
            case 'weight':
              state.configs[index][key] = Number(value);
              break;
            case 'isGray':
              state.configs[index][key] = Boolean(value);
              break;
            default:
              break;
          }
        }
      });
    },

    removeConfig: (index: number) => {
      prismAdvancedEncodeCanvas.removeInputCanvas(index);
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete state.configs[index];
        state.indexes = state.indexes.filter((i: number) => i !== index);
      });
    },

    setSize: (width: number, height: number) => {
      set({ size: { width, height } });
    },

    setDontCareConflict: (value: boolean) => {
      set({ dontCareConflict: value });
    },

    testConflict: () => {
      const thresholds: {
        l: number;
        r: number;
      }[] = [];

      if (get().dontCareConflict) return false; // Skip conflict check if dontCareConflict is true

      const configs = get().configs;
      for (const index of useAdvancedImagesStore.getState().hasInput) {
        const config = configs[index];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (config) {
          const { lowerThreshold, higherThreshold } = config;
          if (lowerThreshold > higherThreshold) {
            return true; // Invalid configuration
          }
          thresholds.push({ l: lowerThreshold, r: higherThreshold });
        }
      }

      thresholds.sort((a, b) => a.l - b.l);
      let end = -1;
      for (const t of thresholds) {
        if (t.l <= end) {
          return true; // Overlapping ranges
        }
        end = t.r;
      }
      return false; // No conflicts found
    },

    setSaveFormat: (format: ImageEncodeFormat) => {
      set({ saveFormat: format });
    },
  }))
);

type AdvancedImagesState = {
  hasOutput: boolean;
  hasInput: Set<number>;
};

type AdvancedImagesActions = {
  setHasOutput: (value: boolean) => void;
  setHasInput: (index: number, value: boolean) => void;
  getHasInput: (index: number) => boolean;
};

type AdvancedImagesStore = AdvancedImagesState & AdvancedImagesActions;

export const useAdvancedImagesStore = create<AdvancedImagesStore>()(
  immer<AdvancedImagesStore>((set, get) => ({
    hasOutput: false,
    hasInput: new Set(),
    setHasOutput: (value: boolean) => {
      set({ hasOutput: value });
    },
    setHasInput: (index: number, value: boolean) => {
      set((state) => {
        if (value) {
          state.hasInput.add(index);
        } else {
          state.hasInput.delete(index);
        }
      });
    },
    getHasInput: (index: number) => {
      return get().hasInput.has(index);
    },
  }))
);

export function useAdvancedImagesStoreInit() {
  const indexes = useAdvancedEncodeConfigsStore((state) => state.indexes);
  const createConfig = useAdvancedEncodeConfigsStore((state) => state.createConfig);

  useEffect(() => {
    if (indexes.length === 0) {
      createConfig();
    }
  }, [indexes, createConfig]);
}
