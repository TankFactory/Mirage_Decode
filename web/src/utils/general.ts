// get rid of eslint errors
export function constructError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

// piexif only accepts binary strings as input, so ...
export function binaryStringToUint8Array(binaryString: string): Uint8Array {
  const uint8 = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8[i] = binaryString.charCodeAt(i);
  }
  return uint8;
}
// Chunked rather than byte-by-byte.
// Do NOT swap this for TextDecoder('latin1') -- that label decodes as
// windows-1252 and rewrites 0x80-0x9F, silently corrupting the data.
export function uint8ArrayToBinaryString(uint8: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < uint8.length; i += chunkSize) {
    // apply, not spread: spread goes through the iterator protocol and is ~6x slower
    parts.push(String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize) as unknown as number[]));
  }
  return parts.join('');
}

// why not?
export type Ptr<T> = {
  v: T | null;
};
export function nullPtr<T>(): Ptr<T> {
  return { v: null };
}
// // useful when:
// function foo(obj: Ptr<ImageData>) {
//   obj.v = new ImageData(1, 1);
// }
// const obj: Ptr<ImageData> = { v: new ImageData(2, 2) };
// foo(obj);
