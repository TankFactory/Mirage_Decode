import { corsProxyUrl } from '../constants/default-arg';
import { constructError } from '../utils/general';

export const LoadImageFileData = {
  async fromFileSelect(multi = false) {
    return new Promise<Uint8Array[]>((rs, rj) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multi;
      input.onchange = (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          if (files.length > 1 && !multi) {
            const file = files[0];
            file
              .arrayBuffer()
              .then((buffer) => {
                rs([new Uint8Array(buffer)]);
              })
              .catch((error: unknown) => {
                rj(constructError(error));
              });
            return;
          }
          const promises = Array.from(files).map((file) => file.arrayBuffer().then((buffer) => new Uint8Array(buffer)));
          Promise.all(promises)
            .then((buffers) => {
              rs(buffers);
            })
            .catch((error: unknown) => {
              rj(constructError(error));
            });
        } else {
          rs([]);
        }
      };
      input.oncancel = () => {
        rs([]);
      };
      input.click();
    });
  },

  async _fromString(text: string): Promise<Uint8Array | null> {
    try {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return (await LoadImageFileData.fromFetch(text))[0];
      } else if (text.startsWith('data:image/')) {
        const base64Data = text.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }
      return null;
    } catch (error: unknown) {
      console.error('Error parsing string as image data:', error);
      return null;
    }
  },

  // resolves with the first non-null result, or [] once every promise has failed
  async _racePromise(promises: Promise<Uint8Array | null>[]) {
    if (promises.length === 0) {
      return [];
    }
    return new Promise<Uint8Array[]>((rs) => {
      let settledCount = 0;
      const countOut = () => {
        settledCount++;
        if (settledCount === promises.length) {
          rs([]);
        }
      };

      promises.forEach((promise) => {
        promise
          .then((buffer) => {
            if (buffer !== null) {
              rs([buffer]);
              return;
            }
            countOut();
          })
          .catch(countOut);
      });
    });
  },

  async fromPasteDirect(multi = false) {
    return new Promise<Uint8Array[]>((rs, rj) => {
      (async () => {
        const clipboardItems = await navigator.clipboard.read();

        const parseSingleItem = async (item: ClipboardItem): Promise<Uint8Array | null> => {
          try {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const arrayBuffer = await blob.arrayBuffer();
                return new Uint8Array(arrayBuffer);
              } else if (type === 'text/plain') {
                const textBlob = await item.getType(type);
                const text = await textBlob.text();
                return await LoadImageFileData._fromString(text);
              }
            }
            return null;
          } catch (error: unknown) {
            console.error('Error reading clipboard item:', error);
            return null;
          }
        };

        if (!multi) {
          const promises = Array.from(clipboardItems).map(parseSingleItem);
          rs(await LoadImageFileData._racePromise(promises));
        } else {
          const promises = Array.from(clipboardItems).map(parseSingleItem);
          const res = (await Promise.all(promises)).filter((buffer) => buffer !== null);
          rs(res);
        }
      })().catch((error: unknown) => {
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError') {
            rj(new Error('没有剪贴板读取权限'));
          } else if (error.name === 'NotFoundError') {
            rj(new Error('剪贴板中没有内容'));
          } else {
            rj(new Error('读取剪贴板失败'));
          }
        } else {
          rj(constructError(error));
        }
      });
    });
  },

  async _fromFetch(uri: string, timeout = 60000) {
    return new Promise<Uint8Array>((rs, rj) => {
      (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        let response: Response;
        try {
          response = await fetch(uri, { signal: controller.signal });
          if (!response.ok) {
            rj(new Error(`网络请求失败: ${response.status.toString()} ${response.statusText}`));
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          rs(new Uint8Array(arrayBuffer));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            rj(new Error('请求超时'));
          } else {
            rj(constructError(error));
          }
          return;
        } finally {
          clearTimeout(timeoutId);
        }
      })().catch((error: unknown) => {
        rj(constructError(error));
      });
    });
  },

  async fromFetch(url: string, timeout = 60000, proxy = corsProxyUrl) {
    return new Promise<Uint8Array[]>((rs, rj) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        rj(new Error('无效的URL'));
        return;
      }
      const uri = encodeURIComponent(url);
      const proxyUrl = proxy + uri;
      LoadImageFileData._fromFetch(proxyUrl, timeout)
        .then((buffer) => {
          rs([buffer]);
        })
        .catch((error: unknown) => {
          rj(constructError(error));
        });
    });
  },

  async fromAssets(url: string, timeout = 60000) {
    return [await LoadImageFileData._fromFetch(url, timeout)];
  },

  async fromDropItems(items: DataTransferItemList, multi = false) {
    return new Promise<Uint8Array[]>((rs, rj) => {
      (async () => {
        const promises: Promise<Uint8Array | null>[] = [];
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              promises.push(file.arrayBuffer().then((buffer) => new Uint8Array(buffer)));
            }
          } else if (item.kind === 'string' && item.type === 'text/plain') {
            promises.push(
              new Promise((rs) => {
                try {
                  item.getAsString((text) => {
                    LoadImageFileData._fromString(text)
                      .then((buffer) => {
                        rs(buffer);
                      })
                      .catch((error: unknown) => {
                        console.error('Error parsing string as image data:', error);
                        rs(null);
                      });
                  });
                } catch (error: unknown) {
                  console.error('Error getting string from drop item:', error);
                  rs(null);
                }
              })
            );
          }
        }

        if (multi) {
          Promise.all(promises)
            .then((buffers) => {
              rs(buffers.filter((buffer) => buffer !== null));
            })
            .catch((error: unknown) => {
              console.error('Error processing drop items:', error);
              rj(constructError(error));
            });
        } else {
          rs(await LoadImageFileData._racePromise(promises));
        }
      })().catch((error: unknown) => {
        console.error('Error processing drop items:', error);
        rj(constructError(error));
      });
    });
  },
};
