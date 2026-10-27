// @ts-nocheck -- Pixi filter glue
// Screen filters. WorldGradeFilter sits on the world layer: it gives every asset the same pixel grain as the
// terrain (one pass, nearest-neighbour cells aligned to the screen), and carries the terrain tints (lava, ice,
// quicksand) and the lava heat haze. PostFilter sits over the whole scene: the optional pixelate, CRT and film
// grain looks, and colour grades. Names, health bars and the HUD stay outside both, crisp and readable.
import * as PIXI from 'pixi.js';

const VERT = undefined;     // Pixi's default filter vertex shader

const WORLD_FRAG = `
precision highp float;     // highp: screen coordinates, and it must match the vertex shader for inputSize and outputFrame
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform vec4 inputClamp;
uniform float uCell;
uniform vec3 uTint;
uniform float uTintA;
uniform float uDesat;
uniform float uShimmer;
uniform float uTime;
uniform vec3 uTint2;
uniform float uTint2A;
// screen coordinates in CSS pixels (inputSize and outputFrame are always set; the legacy filterArea is not)
vec2 mapCoord(vec2 c) { return c * inputSize.xy + outputFrame.xy; }
vec2 unmapCoord(vec2 c) { return (c - outputFrame.xy) * inputSize.zw; }
void main(void) {
  vec2 p = mapCoord(vTextureCoord);
  if (uShimmer > 0.0) {
    p.x += sin(p.y * 0.055 + uTime * 6.3) * 1.7 * uShimmer;
    p.y += cos(p.x * 0.045 + uTime * 4.1) * 0.9 * uShimmer;
  }
  if (uCell > 1.0) p = floor(p / uCell) * uCell + uCell * 0.5;
  vec2 uv = clamp(unmapCoord(p), inputClamp.xy, inputClamp.zw);
  vec4 col = texture2D(uSampler, uv);
  float l = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  col.rgb = mix(col.rgb, vec3(l), uDesat);
  col.rgb = mix(col.rgb, uTint * col.a, uTintA);
  col.rgb = mix(col.rgb, uTint2 * col.a, uTint2A);
  gl_FragColor = col;
}`;

const POST_FRAG = `
precision highp float;     // highp: screen coordinates, and it must match the vertex shader for inputSize and outputFrame
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform vec4 inputClamp;
uniform vec2 uScreen;
uniform float uMode;      // 0 none, 1 pixelate, 2 crt, 3 film grain
uniform float uPix;
uniform float uCurve;
uniform float uFlicker;
uniform float uTime;
uniform mat3 uGrade;
uniform float uContrast;
// screen coordinates in CSS pixels (inputSize and outputFrame are always set; the legacy filterArea is not)
vec2 mapCoord(vec2 c) { return c * inputSize.xy + outputFrame.xy; }
vec2 unmapCoord(vec2 c) { return (c - outputFrame.xy) * inputSize.zw; }
vec4 at(vec2 p) { return texture2D(uSampler, clamp(unmapCoord(p), inputClamp.xy, inputClamp.zw)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(void) {
  vec2 p = mapCoord(vTextureCoord);
  vec4 col;
  if (uMode > 1.5 && uMode < 2.5) {
    // CRT: a slightly curved glass, scanlines, a soft vignette and colour fringes
    vec2 uv = p / uScreen, cc = uv - 0.5;
    float d = dot(cc, cc);
    uv = 0.5 + cc * (1.0 + uCurve * d);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec2 q = uv * uScreen;
    col = vec4(at(q + vec2(0.7, 0.0)).r, at(q).g, at(q - vec2(0.7, 0.0)).b, 1.0);
    float scan = 0.5 + 0.5 * sin(q.y * 3.14159 * 0.66);
    col.rgb *= 1.0 - 0.16 * scan;
    col.rgb *= 1.0 - uFlicker * 0.025 * sin(uTime * 59.0);
    col.rgb *= smoothstep(0.92, 0.38, length(cc * vec2(1.05, 1.2)));
    col.rgb *= 1.08;
  } else if (uMode > 0.5 && uMode < 1.5) {
    col = at(floor(p / uPix) * uPix + uPix * 0.5);
  } else {
    col = at(p);
  }
  if (uMode > 2.5) {
    float n = hash(floor(p) + fract(uTime) * 61.0);
    col.rgb += (n - 0.5) * 0.09;
    vec2 cc = p / uScreen - 0.5;
    col.rgb *= smoothstep(0.95, 0.4, length(cc));
  }
  col.rgb = uGrade * col.rgb;
  col.rgb = (col.rgb - 0.5) * uContrast + 0.5;
  gl_FragColor = col;
}`;

/** Colour grades as 3x3 matrices (column-major for GLSL), with a contrast. */
export const GRADES = {
  none: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], contrast: 1 },
  warm: { m: [1.08, 0.02, 0, 0, 1.0, 0, 0, -0.02, 0.86], contrast: 1.04 },
  cool: { m: [0.9, 0, 0.02, 0, 1.0, 0.03, 0, 0, 1.12], contrast: 1.03 },
  noir: { m: [0.299, 0.299, 0.299, 0.587, 0.587, 0.587, 0.114, 0.114, 0.114], contrast: 1.18 },
  sepia: { m: [0.393, 0.349, 0.272, 0.769, 0.686, 0.534, 0.189, 0.168, 0.131], contrast: 1.02 }
};

export class WorldGradeFilter extends PIXI.Filter {
  constructor() {
    super(VERT, WORLD_FRAG, {
      uCell: 0, uTint: new Float32Array([1, 1, 1]), uTintA: 0, uDesat: 0, uShimmer: 0, uTime: 0,
      uTint2: new Float32Array([1, 1, 1]), uTint2A: 0
    });
    this.padding = 0;
  }
  /** true when it changes nothing (then it can be taken off and the world draws directly) */
  get idle() { const u = this.uniforms; return u.uCell <= 1 && u.uTintA < 0.003 && u.uDesat < 0.003 && u.uShimmer < 0.003 && u.uTint2A < 0.003; }
}

export class PostFilter extends PIXI.Filter {
  constructor() {
    super(VERT, POST_FRAG, {
      uScreen: new Float32Array([1, 1]), uMode: 0, uPix: 4, uCurve: 0.06, uFlicker: 1, uTime: 0,
      uGrade: new Float32Array(GRADES.none.m), uContrast: 1
    });
    this.padding = 0;
  }
  get idle() { return this.uniforms.uMode < 0.5 && this.uniforms.uContrast === 1 && this.uniforms.uGrade[0] === 1 && this.uniforms.uGrade[4] === 1 && this.uniforms.uGrade[8] === 1 && this.uniforms.uGrade[1] === 0; }
}

export const hexToVec = (c: number, out: Float32Array) => { out[0] = ((c >> 16) & 255) / 255; out[1] = ((c >> 8) & 255) / 255; out[2] = (c & 255) / 255; return out; };

/**
 * Where a click on the curved CRT glass lands on the flat scene: the same warp the shader samples with, so
 * clicking still hits what is drawn under the cursor.
 */
export function crtWarp(x: number, y: number, w: number, h: number, k: number) {
  const cx = x / w - 0.5, cy = y / h - 0.5;
  const d = cx * cx + cy * cy;
  return { x: (0.5 + cx * (1 + k * d)) * w, y: (0.5 + cy * (1 + k * d)) * h };
}
