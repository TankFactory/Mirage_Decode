import type { PrismDecodeConfig, PrismDecodeService } from '../../prism-decode';
import type { WebGLProcessConstructor } from './helper';

function scaleContrastExpand(value: number): number {
  return Math.max(Math.min(((value - 50) * 255) / 50, 255), -255);
}

// see common.ts: _initVAO hardcodes locations 0/1
const passthroughVS = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, a_texCoord.y);
}
`;

// highp for the same reason as the encode shader: exact byte values matter
const scaleFS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outMask;
uniform sampler2D u_texture;
uniform int u_fillMethod; // 0: black, 1: white, 2: transparent
uniform float u_scaleRatio;
uniform float u_lowerThreshold;
uniform float u_higherThreshold;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  float l = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  if (l < u_lowerThreshold || l > u_higherThreshold) {
    outMask = vec4(1.0, 0.0, 0.0, 1.0);
    if (u_fillMethod == 2) {
      outColor = vec4(0.0, 0.0, 0.0, 0.0); // transparent
    } else if (u_fillMethod == 1) {
      outColor = vec4(1.0); // white
    } else {
      outColor = vec4(0.0); // black
    }
  } else {
    outColor = vec4(
      clamp((color.r - u_lowerThreshold) * u_scaleRatio, 0.0, 1.0),
      clamp((color.g - u_lowerThreshold) * u_scaleRatio, 0.0, 1.0),
      clamp((color.b - u_lowerThreshold) * u_scaleRatio, 0.0, 1.0),
      color.a
    );
    outMask = vec4(0.0);
  }
}
`;

const fillFS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_image;
uniform sampler2D u_mask;
uniform vec2 u_texelSize;
uniform float u_threshold;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outMask;

void main() {
  vec4 current = texture(u_image, v_texCoord);
  vec4 mask = texture(u_mask, v_texCoord);

  if (mask.r < 0.5) {
    outColor = current;
    outMask = vec4(0.0);
    return;
  }

  vec4 sum = vec4(0.0);
  float weightSum = 0.0;
  int count = 0;
  vec2 offsets[24] = vec2[](
    vec2(-1.0, 0.0), vec2(1.0, 0.0),
    vec2(0.0, -1.0), vec2(0.0, 1.0),
    vec2(-1.0, -1.0), vec2(1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0),
    vec2(-2.0, 0.0), vec2(2.0, 0.0),
    vec2(0.0, -2.0), vec2(0.0, 2.0),
    vec2(-2.0, -2.0), vec2(2.0, 2.0),
    vec2(-2.0, 2.0), vec2(2.0, -2.0),
    vec2(-1.0, -2.0), vec2(1.0, 2.0),
    vec2(-2.0, -1.0), vec2(2.0, 1.0),
    vec2(-1.0, 2.0), vec2(1.0, -2.0),
    vec2(-2.0, 1.0), vec2(2.0, -1.0)
  );

  // exp(-d² / (2 * sigma²)) where sigma = 1.0
  float weights[24] = float[](
    0.6065, 0.6065, // 1
    0.6065, 0.6065,
    0.3679, 0.3679, // 2
    0.3679, 0.3679,
    0.1353, 0.1353, // 4
    0.1353, 0.1353,
    0.0183, 0.0183, // 8
    0.0183, 0.0183,
    0.0821, 0.0821, // 5
    0.0821, 0.0821,
    0.0821, 0.0821,
    0.0821, 0.0821
  );

  for (int i = 0; i < 24; i++) {
    vec2 uv = v_texCoord + offsets[i] * u_texelSize;
    vec4 neighbor = texture(u_image, uv);
    vec4 neighborMask = texture(u_mask, uv);
    if (neighborMask.r < 0.5) {
      sum += neighbor * weights[i];
      weightSum += weights[i];
      count++;
    }
  }

  if (count > 0) {
    outColor = sum / weightSum;
    outMask = vec4(0.0);
  } else {
    outColor = current;
    outMask = mask;
  }
}`;

export function WebGLDecodeProcess<TBase extends WebGLProcessConstructor>(Base: TBase) {
  return class extends Base implements PrismDecodeService {
    _scaleProgram: WebGLProgram | null = null;
    _fillProgram: WebGLProgram | null = null;

    _initPrograms(): void {
      super._initPrograms();
      this._scaleProgram = this._createProgram(passthroughVS, scaleFS);
      this._fillProgram = this._createProgram(passthroughVS, fillFS);
    }

    _texCache: Record<
      number,
      {
        texMask: WebGLTexture | null;
        width: number;
        height: number;
      }
    > = {
      0: { texMask: null, width: 0, height: 0 }, // texMaskA
      1: { texMask: null, width: 0, height: 0 }, // texMaskB
      3: { texMask: null, width: 0, height: 0 }, // texA
      4: { texMask: null, width: 0, height: 0 }, // texB
    };
    _encodeCreateTexture(width: number, height: number, slot: number): WebGLTexture {
      const cache = this._texCache[slot];
      if (cache.texMask && cache.width === width && cache.height === height) {
        return cache.texMask;
      }

      if (cache.texMask) {
        this._gl.deleteTexture(cache.texMask);
        cache.texMask = null;
      }

      const isRGBA = slot >= 3;

      const texMask = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, texMask);
      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        0,
        isRGBA ? this._gl.RGBA : this._gl.R8,
        width,
        height,
        0,
        isRGBA ? this._gl.RGBA : this._gl.RED,
        this._gl.UNSIGNED_BYTE,
        null
      );
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.NEAREST);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.NEAREST);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.bindTexture(this._gl.TEXTURE_2D, null);

      cache.texMask = texMask;
      cache.width = width;
      cache.height = height;

      return texMask;
    }

    _attachOutputTexture(texColor: WebGLTexture, texMask: WebGLTexture): void {
      const gl = this._gl;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texColor, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texMask, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }

    _activeInputTexture(texColor: WebGLTexture, texMask: WebGLTexture | null = null): void {
      const gl = this._gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texColor);
      if (texMask) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texMask);
      }
    }

    prismDecode(imageData: ImageData, newImageData: ImageData, config: PrismDecodeConfig): void {
      if (!this._scaleProgram || !this._fillProgram) {
        return;
      }

      this._adjustSize(imageData.width, imageData.height);

      const gl = this._gl;

      const texInput = this._createSrcTexture(imageData.width, imageData.height, imageData.data);
      const texA = this._encodeCreateTexture(newImageData.width, newImageData.height, 3);
      const texB = this._encodeCreateTexture(newImageData.width, newImageData.height, 4);
      const texMaskA = this._encodeCreateTexture(newImageData.width, newImageData.height, 0);
      const texMaskB = this._encodeCreateTexture(newImageData.width, newImageData.height, 1);

      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      this._attachOutputTexture(texA, texMaskA);

      this._activeInputTexture(texInput);
      this._drawFullScreen(this._scaleProgram, {
        u_texture: { value: 0, type: 'Integer' },
        u_scaleRatio: {
          value: config.higherThreshold === config.lowerThreshold ? 0 : 255 / (config.higherThreshold - config.lowerThreshold),
          type: 'Float',
        },
        u_lowerThreshold: { value: config.lowerThreshold / 255, type: 'Float' },
        u_higherThreshold: { value: config.higherThreshold / 255, type: 'Float' },
        u_fillMethod: { value: config.method === 'black' ? 0 : config.method === 'white' ? 1 : 2, type: 'Integer' },
      });

      let srcColor = texA;
      let dstColor = texB;
      let srcMask = texMaskA;
      let dstMask = texMaskB;
      const texelSize = [1 / newImageData.width, 1 / newImageData.height];

      if (config.method === 'ltavg') {
        for (let iter = 0; iter < config.iterations; iter++) {
          this._attachOutputTexture(dstColor, dstMask);

          this._activeInputTexture(srcColor, srcMask);

          this._drawFullScreen(this._fillProgram, {
            u_image: { value: 0, type: 'Integer' },
            u_mask: { value: 1, type: 'Integer' },
            u_texelSize: { value: texelSize, type: 'Vec2' },
            u_threshold: { value: config.lowerThreshold / 255, type: 'Float' },
          });

          // swap for next iteration
          const tmpColor = srcColor;
          srcColor = dstColor;
          dstColor = tmpColor;
          const tmpMask = srcMask;
          srcMask = dstMask;
          dstMask = tmpMask;
        }
      }

      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, newImageData.width, newImageData.height, gl.RGBA, gl.UNSIGNED_BYTE, newImageData.data);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.deleteFramebuffer(fb);
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
