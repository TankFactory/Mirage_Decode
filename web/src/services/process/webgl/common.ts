import type { Ptr } from '../../../utils/general';
import { ImageUtils, type ImageCommonService, type ToGrayAlgo } from '../../image-process';
import { type WebGLProcessConstructor } from './helper';

// locations must be explicit: _initVAO hardcodes 0/1, and the linker is not
// required to assign them in declaration order
const passthroughVS = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, a_texCoord.y);
}
`;

// mediump is deliberate for the three shaders below, unlike encode/decode:
// these only feed the on-screen preview, where being off by one gray level is
// invisible, and mediump is cheaper on mobile
const toGrayFS = `#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
uniform int u_flag;
void main() {
  vec4 color = texture(u_texture, v_texCoord);
  float gray;
  if (u_flag == 0) {
    gray = (color.r + color.g + color.b) / 3.0;
  } else {
    gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  }
  outColor = vec4(gray, gray, gray, color.a);
}
`;

const adjustContrastFS = `#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
uniform float u_factor;
void main() {
  vec4 color = texture(u_texture, v_texCoord);
  outColor.r = clamp(u_factor * (color.r - 0.5) + 0.5, 0.0, 1.0);
  outColor.g = clamp(u_factor * (color.g - 0.5) + 0.5, 0.0, 1.0);
  outColor.b = clamp(u_factor * (color.b - 0.5) + 0.5, 0.0, 1.0);
  outColor.a = color.a;
}
`;

const passthroughFS = `#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
uniform vec4 u_texCoordRect; // [u0, v0, u1, v1]
void main() {
  vec2 uv = mix(u_texCoordRect.xy, u_texCoordRect.zw, v_texCoord);
  outColor = texture(u_texture, uv);
}
`;

export function WebGLCommonProcess<TBase extends WebGLProcessConstructor>(Base: TBase) {
  return class extends Base implements ImageCommonService {
    _toGrayProgram: WebGLProgram | null = null;
    _adjustContrastProgram: WebGLProgram | null = null;
    _passthroughProgram: WebGLProgram | null = null;

    _initPrograms(): void {
      super._initPrograms();
      this._toGrayProgram = this._createProgram(passthroughVS, toGrayFS);
      this._adjustContrastProgram = this._createProgram(passthroughVS, adjustContrastFS);
      this._passthroughProgram = this._createProgram(passthroughVS, passthroughFS);
    }

    _commonProc(src: Ptr<ImageData>, tar: Ptr<ImageData>, program: WebGLProgram | null, uniforms = {}, resize = false): void {
      if (!src.v || !program) {
        tar.v = null;
        return;
      }
      if (!resize) {
        ImageUtils.matchSize(src, tar);
      }
      if (!tar.v) {
        return;
      }

      this._adjustSize(tar.v.width, tar.v.height);
      const texInput = this._createSrcTexture(src.v.width, src.v.height, src.v.data, resize);
      const [texOutput, useCache] = this._createTarTexture(tar.v.width, tar.v.height, resize, true);
      const framebuffer = this._createFramebuffer(texOutput, useCache);

      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, framebuffer);
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.bindTexture(this._gl.TEXTURE_2D, texInput);

      this._drawFullScreen(program, {
        u_texture: { value: 0, type: 'Integer' },
        ...uniforms,
      });

      this._gl.readBuffer(this._gl.COLOR_ATTACHMENT0);
      this._gl.readPixels(0, 0, tar.v.width, tar.v.height, this._gl.RGBA, this._gl.UNSIGNED_BYTE, tar.v.data);
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);

      if (!useCache) {
        this._gl.deleteFramebuffer(framebuffer);
      }
      // 'resize' doubles as the tar-texture cache flag above; without it the
      // texture belongs to nobody and would be left to the GC
      if (!resize) {
        this._gl.deleteTexture(texOutput);
      }
    }

    toGray = (src: Ptr<ImageData>, tar: Ptr<ImageData>, algo?: ToGrayAlgo): void => {
      this._commonProc(src, tar, this._toGrayProgram, {
        u_flag: algo === 'Lum' ? { value: 1, type: 'Integer' } : { value: 0, type: 'Integer' },
      });
    };

    adjustContrast(contrast: number, src: Ptr<ImageData>, tar: Ptr<ImageData>): void {
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      this._commonProc(src, tar, this._adjustContrastProgram, {
        u_factor: { value: factor, type: 'Float' },
      });
    }

    resizeCover(width: number, height: number, src: Ptr<ImageData>, tar: Ptr<ImageData>): void {
      if (!src.v || width === 0 || height === 0 || src.v.width === 0 || src.v.height === 0) {
        tar.v = null;
        return;
      }
      if (src.v.width === width && src.v.height === height) {
        tar.v = new ImageData(src.v.data.slice(), width, height);
        return;
      }
      tar.v = new ImageData(width, height);

      const srcWidth = src.v.width;
      const srcHeight = src.v.height;
      const srcAspect = srcWidth / srcHeight;
      const dstAspect = width / height;

      let scale = 1;
      let offsetX = 0,
        offsetY = 0;
      if (srcAspect > dstAspect) {
        scale = height / srcHeight;
        const scaledWidth = srcWidth * scale;
        offsetX = (scaledWidth - width) / 2 / scaledWidth;
        offsetY = 0;
      } else {
        scale = width / srcWidth;
        const scaledHeight = srcHeight * scale;
        offsetX = 0;
        offsetY = (scaledHeight - height) / 2 / scaledHeight;
      }

      const u0 = offsetX;
      const v0 = offsetY;
      const u1 = 1 - offsetX;
      const v1 = 1 - offsetY;

      this._commonProc(
        src,
        tar,
        this._passthroughProgram,
        {
          u_texCoordRect: { value: [u0, v0, u1, v1], type: 'Vec4' },
        },
        true
      );
    }

    resizeFit(maxSize: number, src: Ptr<ImageData>, tar: Ptr<ImageData>): void {
      if (!src.v || maxSize <= 0) {
        tar.v = null;
        return;
      }
      const { width, height } = src.v;
      if (width <= maxSize && height <= maxSize) {
        tar.v = new ImageData(src.v.data.slice(), width, height);
        return;
      }

      const aspect = width / height;
      let newWidth: number, newHeight: number;

      if (aspect > 1) {
        newWidth = maxSize;
        newHeight = Math.min(Math.round(maxSize / aspect), maxSize);
      } else {
        newHeight = maxSize;
        newWidth = Math.min(Math.round(maxSize * aspect), maxSize);
      }

      this.resizeCover(newWidth, newHeight, src, tar);
    }
  };
}
