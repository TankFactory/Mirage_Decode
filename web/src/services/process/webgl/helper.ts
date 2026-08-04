type InputTextureCache = {
  cacheWidth: number;
  cacheHeight: number;
  cachedData: Uint8ClampedArray | null;
  cachedTex: WebGLTexture | null;
};

type UniformValue = {
  type: 'Integer' | 'Float' | 'Vec2' | 'Vec4' | 'Boolean';
  value: number | number[] | boolean;
};

export class WebGLHelper {
  _canvas: OffscreenCanvas | HTMLCanvasElement;
  _gl: WebGL2RenderingContext;
  _fullscreenVAO: WebGLVertexArrayObject | null = null;
  _srcTextureCacheSlots: number = 2; // how many src textures to cache

  constructor() {
    // really necessary?
    // if (!('OffscreenCanvas' in window)) {
    this._canvas = document.createElement('canvas');
    // } else {
    // this._canvas = new OffscreenCanvas(350, 150); // some random size
    // }

    const ctx = this._canvas.getContext('webgl2');
    if (!ctx || !(ctx instanceof WebGL2RenderingContext)) {
      throw new Error('WebGL2 not available');
    }
    this._gl = ctx;
  }

  init() {
    this._initVAO();
    this._initShaders();
    this._initPrograms();
    this._initSrcTextureCache(this._srcTextureCacheSlots);
  }

  _initVAO() {
    this._fullscreenVAO = this._gl.createVertexArray();
    this._gl.bindVertexArray(this._fullscreenVAO);
    const buf = this._gl.createBuffer();
    this._gl.bindBuffer(this._gl.ARRAY_BUFFER, buf);
    this._gl.bufferData(
      this._gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1]),
      this._gl.STATIC_DRAW
    );
    const stride = 16;
    const a_position = 0,
      a_texCoord = 1;
    this._gl.enableVertexAttribArray(a_position);
    this._gl.vertexAttribPointer(a_position, 2, this._gl.FLOAT, false, stride, 0);
    this._gl.enableVertexAttribArray(a_texCoord);
    this._gl.vertexAttribPointer(a_texCoord, 2, this._gl.FLOAT, false, stride, 8);
  }

  _initShaders() {
    return;
  }

  _initPrograms() {
    return;
  }

  _initSrcTextureCache(slots: number = 2) {
    this._srcTextureCache = Array.from({ length: slots }, () => this._createSrcTextureCache());
  }

  _createShader(type: number, src: string): WebGLShader {
    const shader = this._gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    this._gl.shaderSource(shader, src);
    this._gl.compileShader(shader);
    if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
      throw new Error(this._gl.getShaderInfoLog(shader) ?? 'Unknown error compiling shader');
    }
    return shader;
  }

  _createProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const vs = this._createShader(this._gl.VERTEX_SHADER, vsSrc);
    const fs = this._createShader(this._gl.FRAGMENT_SHADER, fsSrc);
    const program = this._gl.createProgram();
    this._gl.attachShader(program, vs);
    this._gl.attachShader(program, fs);
    this._gl.linkProgram(program);
    // the program keeps its own copy after linking, so the shaders can go now
    this._gl.detachShader(program, vs);
    this._gl.detachShader(program, fs);
    this._gl.deleteShader(vs);
    this._gl.deleteShader(fs);
    if (!this._gl.getProgramParameter(program, this._gl.LINK_STATUS)) {
      throw new Error(this._gl.getProgramInfoLog(program) ?? 'Unknown error linking program');
    }
    return program;
  }

  // comparing every element in two Uint8ClampedArrays appears to be less expensive
  // than creating a new texture each time :/ or does it?
  //
  // oh it does. likey 25% faster than not caching srcTexture at all
  //
  // and guess what, even another 25% faster when using CPU instead of WebGL 😅
  // well, I've only tested toGray function, maybe better with complexer calculations?

  _srcTextureCache: InputTextureCache[] = [];
  _createSrcTextureCache() {
    return {
      cacheWidth: 0,
      cacheHeight: 0,
      cachedData: null,
      cachedTex: null,
    };
  }
  _createSrcTexture(
    width: number,
    height: number,
    data: Uint8ClampedArray,
    enableLinear: boolean = false,
    enableCache: boolean = true,
    cacheSlot: number = 0
  ): WebGLTexture {
    if (enableCache) {
      const cache = this._srcTextureCache[cacheSlot % this._srcTextureCacheSlots];

      if (cache.cacheWidth && cache.cacheHeight && cache.cachedData && cache.cachedTex) {
        // compare length
        if (cache.cachedData.length === data.length && width === cache.cacheWidth && height === cache.cacheHeight) {
          // comparing reference wont help here, since we have to compare the content anyway
          // compare content
          let matches = true;
          for (let i = 0; i < data.length; i++) {
            if (cache.cachedData[i] !== data[i]) {
              // note: don't drop the handle here, the block below still has to delete it
              matches = false;
              break;
            }
          }
          if (matches) {
            return cache.cachedTex;
          }
        }
      }

      if (cache.cachedTex) {
        this._gl.deleteTexture(cache.cachedTex);
        cache.cachedTex = null;
      }
    }

    const tex = this._gl.createTexture();
    this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, enableLinear ? this._gl.LINEAR : this._gl.NEAREST);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, enableLinear ? this._gl.LINEAR : this._gl.NEAREST);
    this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, width, height, 0, this._gl.RGBA, this._gl.UNSIGNED_BYTE, data);

    if (enableCache) {
      const cache = this._srcTextureCache[cacheSlot % this._srcTextureCacheSlots];
      cache.cachedData = data;
      cache.cachedTex = tex;
      cache.cacheWidth = width;
      cache.cacheHeight = height;
    }

    return tex;
  }

  // only enable cache if every pixel in returned texture will be written
  // and true is returned as second element if cache is used.
  // when enableCache is false the texture is unowned -- the caller has to delete it
  _cacheTarWidth: number = 0;
  _cacheTarHeight: number = 0;
  _cacheTarTex: WebGLTexture | null = null;
  _createTarTexture(
    width: number,
    height: number,
    enableCache: boolean,
    enableLinear: boolean = false
  ): [WebGLTexture, boolean] {
    if (enableCache && this._cacheTarWidth && this._cacheTarHeight && this._cacheTarTex) {
      if (width === this._cacheTarWidth && height === this._cacheTarHeight) {
        return [this._cacheTarTex, true];
      }
    }

    if (enableCache && this._cacheTarTex) {
      this._gl.deleteTexture(this._cacheTarTex);
      this._cacheTarTex = null;
    }

    const tex = this._gl.createTexture();
    this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, enableLinear ? this._gl.LINEAR : this._gl.NEAREST);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, enableLinear ? this._gl.LINEAR : this._gl.NEAREST);
    this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, width, height, 0, this._gl.RGBA, this._gl.UNSIGNED_BYTE, null);

    if (enableCache) {
      this._cacheTarTex = tex;
      this._cacheTarWidth = width;
      this._cacheTarHeight = height;
    }

    return [tex, false];
  }

  // when useCache is true, cached framebuffer will be returned if available.
  // always returns a framebuffer that is bound and has 'tex' on COLOR_ATTACHMENT0 --
  // callers must not have to remember to bind it themselves
  _cacheFrameBuffer: WebGLFramebuffer | null = null;
  _createFramebuffer(tex: WebGLTexture, useCache: boolean): WebGLFramebuffer {
    if (this._cacheFrameBuffer && useCache) {
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._cacheFrameBuffer);
      this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, this._gl.COLOR_ATTACHMENT0, this._gl.TEXTURE_2D, tex, 0);
      return this._cacheFrameBuffer;
    }

    if (this._cacheFrameBuffer) {
      this._gl.deleteFramebuffer(this._cacheFrameBuffer);
      this._cacheFrameBuffer = null;
    }

    const fb = this._gl.createFramebuffer();
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, fb);
    this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, this._gl.COLOR_ATTACHMENT0, this._gl.TEXTURE_2D, tex, 0);

    if (useCache) {
      this._cacheFrameBuffer = fb;
    }

    return fb;
  }

  _adjustSize(width: number, height: number) {
    this._canvas.width = width;
    this._canvas.height = height;
    this._gl.viewport(0, 0, width, height);
  }

  _drawFullScreen(program: WebGLProgram, uniforms: Record<string, UniformValue> = {}) {
    this._gl.useProgram(program);
    this._gl.bindVertexArray(this._fullscreenVAO);

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = this._gl.getUniformLocation(program, name);
      if (loc === null) continue;
      switch (value.type) {
        case 'Integer':
          this._gl.uniform1i(loc, value.value as number);
          break;
        case 'Float':
          this._gl.uniform1f(loc, value.value as number);
          break;
        case 'Vec2':
          this._gl.uniform2fv(loc, value.value as number[]);
          break;
        case 'Vec4':
          this._gl.uniform4fv(loc, value.value as number[]);
          break;
        case 'Boolean':
          this._gl.uniform1i(loc, value.value ? 1 : 0);
          break;
      }
    }

    this._gl.drawArrays(this._gl.TRIANGLES, 0, 6);
  }
}

export type WebGLProcessConstructor = new (...args: any[]) => WebGLHelper;
