import type { PrismEncodeConfig, PrismEncodeService } from '../../prism-encode';
import type { WebGLProcessConstructor } from './helper';

function scaleContrastCompress(value: number): number {
  return Math.max(Math.min((value * 50) / 255 + 50, 100), 0);
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

// highp, not mediump: the encoded bytes are the product here, and mediump is
// only 16-bit on mobile GPUs -- enough to land on the wrong byte after readPixels
const encodeFS = `#version 300 es
precision highp float;

uniform sampler2D u_innerImage;
uniform sampler2D u_coverImage;
in vec2 v_texCoord;
out vec4 outVec4;

uniform float u_innerThreshold;
uniform float u_coverThreshold;
uniform int u_slope;
uniform int u_gap;
uniform bool u_isRow;
uniform bool u_isReverse;
uniform vec2 u_texelSize;

void main() {
    vec4 innerColor = texture(u_innerImage, v_texCoord);
    vec4 coverColor = texture(u_coverImage, v_texCoord);

    int x = int(v_texCoord.x / u_texelSize.x);
    int y = int(v_texCoord.y / u_texelSize.y);

    bool isCoverPixel;
    if (u_slope == 0) {
        isCoverPixel = (u_isRow ? y : x) % (u_gap + 1) < u_gap;
    } else if (u_isRow) {
        isCoverPixel = (y / u_slope + x) % (u_gap + 1) < u_gap;
    } else {
        isCoverPixel = (x / u_slope + y) % (u_gap + 1) < u_gap;
    }

    if (isCoverPixel) {
        if (u_isReverse) {
            outVec4 = vec4(
                (coverColor.r * (1.0 - u_coverThreshold)),
                (coverColor.g * (1.0 - u_coverThreshold)),
                (coverColor.b * (1.0 - u_coverThreshold)),
                coverColor.a
            );
        } else {
            outVec4 = vec4(
                u_coverThreshold + (coverColor.r * (1.0 - u_coverThreshold)),
                u_coverThreshold + (coverColor.g * (1.0 - u_coverThreshold)),
                u_coverThreshold + (coverColor.b * (1.0 - u_coverThreshold)),
                coverColor.a
            );
        }
    } else {
        if (u_isReverse) {
            outVec4 = vec4(
                (1.0 - u_innerThreshold) + (innerColor.r * u_innerThreshold),
                (1.0 - u_innerThreshold) + (innerColor.g * u_innerThreshold),
                (1.0 - u_innerThreshold) + (innerColor.b * u_innerThreshold),
                innerColor.a
            );
        } else {
            outVec4 = vec4(
                innerColor.r * u_innerThreshold,
                innerColor.g * u_innerThreshold,
                innerColor.b * u_innerThreshold,
                innerColor.a
            );
        }
    }
}
`;

export function WebGLEncodeProcess<TBase extends WebGLProcessConstructor>(Base: TBase) {
  return class extends Base implements PrismEncodeService {
    _encodeProgram: WebGLProgram | null = null;

    _initPrograms(): void {
      super._initPrograms();
      this._encodeProgram = this._createProgram(passthroughVS, encodeFS);
    }

    prismEncode(
      innerData: ImageData,
      coverData: ImageData,
      resultData: ImageData,
      { innerThreshold, coverThreshold, slope, gap, isRow, isReverse }: PrismEncodeConfig
    ) {
      if (!this._encodeProgram) {
        return;
      }
      const width = innerData.width;
      const height = innerData.height;

      this._adjustSize(width, height);

      const innerTex = this._createSrcTexture(width, height, innerData.data, false, false);
      const coverTex = this._createSrcTexture(width, height, coverData.data, false, false);

      const [targetTex, useCache] = this._createTarTexture(width, height, true, false);

      const fb = this._createFramebuffer(targetTex, useCache);

      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, innerTex);
      this._gl.activeTexture(this._gl.TEXTURE1);
      this._gl.bindTexture(this._gl.TEXTURE_2D, coverTex);

      this._drawFullScreen(this._encodeProgram, {
        u_innerImage: { value: 0, type: 'Integer' },
        u_coverImage: { value: 1, type: 'Integer' },
        u_innerThreshold: { value: innerThreshold / 255, type: 'Float' },
        u_coverThreshold: { value: coverThreshold / 255, type: 'Float' },
        u_slope: { value: slope, type: 'Integer' },
        u_gap: { value: gap, type: 'Integer' },
        u_isRow: { value: isRow, type: 'Boolean' },
        u_isReverse: { value: isReverse, type: 'Boolean' },
        u_texelSize: { value: [1 / width, 1 / height], type: 'Vec2' },
      });

      this._gl.readBuffer(this._gl.COLOR_ATTACHMENT0);
      this._gl.readPixels(0, 0, width, height, this._gl.RGBA, this._gl.UNSIGNED_BYTE, resultData.data);
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);

      if (!useCache) {
        this._gl.deleteFramebuffer(fb);
      }
      // both source textures were created with caching off, so they are ours to free
      this._gl.deleteTexture(innerTex);
      this._gl.deleteTexture(coverTex);
    }

    encodePreset(innerThreshold: number, contrast: number, isReverse: boolean) {
      contrast = scaleContrastCompress(contrast);
      return `${isReverse ? '1' : '0'}\
${innerThreshold.toString(16).padStart(2, '0')}\
${contrast.toString(16).padStart(2, '0')}`;
    }

    encodeIsCover(x: number, y: number, slope: number, gap: number, isRow: boolean): boolean {
      if (slope === 0) {
        return (isRow ? y : x) % (gap + 1) < gap;
      } else if (isRow) {
        return (y / slope + x) % (gap + 1) < gap;
      } else {
        return (x / slope + y) % (gap + 1) < gap;
      }
    }
  };
}
