// Bakes the tops of one chunk's natural rock (mountains, peaks, cave walls) into a smooth texture, the way the
// ground is baked: light that drifts over the rock in broad patches, a fine grain, a snowline that wanders
// between peaks and bare rock instead of following tile edges, soft moss. Its edges are the rock outline
// (core/render/rockShape), anti-aliased, as one path so neighbouring tiles meet without seams.
import * as PIXI from 'pixi.js';
import { WORLD_CONFIG } from '../core/config';
import { valueNoise } from '../core/world/noise';
import { BIOME } from '../core/world/biomes';
import { GROUND_RES } from './groundBake';
import type { RockShape } from '../core/render/rockShape';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;
/** Texels per chunk side, and texels per tile row (each row of rock tops is its own sprite). */
export const ROCK_N = (CT * T) / GROUND_RES;
export const ROCK_ROW = T / GROUND_RES;
const STEP = 6;                                   // coarse noise grid step in texels
const G = Math.ceil(ROCK_N / STEP) + 2;
const LT = CT + 2;                                // local tile grid with a one-tile border

export const NATURAL_ROCK = new Set([BIOME.MOUNTAIN, BIOME.PEAK, BIOME.CAVE_WALL]);
const IS_ROCK = new Uint8Array(32);
NATURAL_ROCK.forEach((b) => { IS_ROCK[b] = 1; });

const ROCK = 0x8e929d, SNOW = 0xe8eef6, MOSS = 0x6a7a52;
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export interface RockBakeOpts {
  biomeAt: (tx: number, ty: number) => number;
  shapeOf: (tx: number, ty: number) => RockShape;
  seed: number;
  caveTop: number;                                // the place's own rock colour for cave walls
}

/** The baked tops of chunk (cx, cy) and which of its rows have any, or null when it has no natural rock. */
export function bakeRockTops(cx: number, cy: number, o: RockBakeOpts): { texture: PIXI.Texture; rows: boolean[] } | null {
  const tx0 = cx * CT, ty0 = cy * CT;
  const tb = new Uint8Array(LT * LT);
  const rows = new Array(CT).fill(false);
  let any = false;
  for (let j = 0; j < LT; j++) for (let i = 0; i < LT; i++) {
    const b = o.biomeAt(tx0 - 1 + i, ty0 - 1 + j);
    tb[j * LT + i] = b;
    if (i > 0 && j > 0 && i <= CT && j <= CT && IS_ROCK[b]) { any = true; rows[j - 1] = true; }
  }
  if (!any) return null;

  // coarse noise channels in world space: macro light, detail, moss, snowline jitter
  const wx0 = tx0 * T, wy0 = ty0 * T, seed = o.seed;
  const mac = new Float32Array(G * G), det = new Float32Array(G * G), mos = new Float32Array(G * G), jit = new Float32Array(G * G);
  for (let gj = 0; gj < G; gj++) for (let gi = 0; gi < G; gi++) {
    const wx = wx0 + gi * STEP * GROUND_RES, wy = wy0 + gj * STEP * GROUND_RES, k = gj * G + gi;
    mac[k] = valueNoise(wx / 110, wy / 110, seed + 510) * 0.75 + valueNoise(wx / 260, wy / 260, seed + 540) * 0.25;
    det[k] = valueNoise(wx / 34, wy / 34, seed + 511);
    mos[k] = valueNoise(wx / 80, wy / 80, seed + 514) * 0.8 + valueNoise(wx / 19, wy / 19, seed + 515) * 0.2;
    jit[k] = valueNoise(wx / 41, wy / 41, seed + 541) - 0.5;
  }

  const rock = rgb(ROCK), snow = rgb(SNOW), moss = rgb(MOSS), cave = rgb(o.caveTop);
  const data = new Uint8ClampedArray(ROCK_N * ROCK_N * 4);
  const invS = 1 / STEP, invT = 1 / T, gx0 = (wx0 / GROUND_RES) | 0, gy0 = (wy0 / GROUND_RES) | 0;
  // snow at each tile centre of the local grid (outside it: none)
  const pk = new Float32Array(LT * LT);
  for (let k = 0; k < LT * LT; k++) pk[k] = tb[k] === BIOME.PEAK ? 1 : 0;
  for (let v = 0; v < ROCK_N; v++) {
    const ly = (v + 0.5) * GROUND_RES;                 // world offset in the chunk
    const rowT = ((Math.floor(ly * invT) + 1) * LT) + 1;
    const fv = v * invS, gj = fv | 0, b = fv - gj, b1 = 1 - b, r0 = gj * G, r1 = r0 + G;
    const gyv = Math.imul(gy0 + v, 19349663);
    for (let u = 0; u < ROCK_N; u++) {
      const lx = (u + 0.5) * GROUND_RES;
      const bm = tb[rowT + Math.floor(lx * invT)];
      if (!IS_ROCK[bm]) continue;                     // left transparent
      const fu = u * invS, gi = fu | 0, a = fu - gi, a1 = 1 - a, k0 = r0 + gi, k1 = r1 + gi;
      const w00 = a1 * b1, w10 = a * b1, w01 = a1 * b, w11 = a * b;
      const m = mac[k0] * w00 + mac[k0 + 1] * w10 + mac[k1] * w01 + mac[k1 + 1] * w11;
      const d = det[k0] * w00 + det[k0 + 1] * w10 + det[k1] * w01 + det[k1 + 1] * w11;
      // a cheap integer hash per texel for the grain
      let hgr = (Math.imul(gx0 + u, 73856093) ^ gyv ^ seed) >>> 0;
      hgr = Math.imul(hgr ^ (hgr >>> 15), 2246822519) >>> 0;
      const grain = ((hgr & 1023) / 1023 - 0.5) * 0.035;
      let R, Gc, B;
      if (bm === BIOME.CAVE_WALL) {
        const sh = (0.8 + m * 0.4 + (d - 0.5) * 0.06 + grain) * 0.7;
        R = cave[0] * sh; Gc = cave[1] * sh; B = cave[2] * sh;
      } else {
        const rs = 0.8 + m * 0.34 + (d - 0.5) * 0.07 + grain;
        R = rock[0] * rs; Gc = rock[1] * rs; B = rock[2] * rs;
        // the snowline: peak-ness between tile centres, nudged by noise, eased
        const j2 = jit[k0] * w00 + jit[k0 + 1] * w10 + jit[k1] * w01 + jit[k1 + 1] * w11;
        const fx = lx * invT - 0.5 + j2 * 0.9, fy = ly * invT - 0.5 - j2 * 0.7;
        const i0 = Math.floor(fx), jj0 = Math.floor(fy), ax = fx - i0, ay = fy - jj0;
        let wsn = 0;
        if (i0 >= -1 && jj0 >= -1 && i0 + 2 < LT && jj0 + 2 < LT) {
          const q = (jj0 + 1) * LT + i0 + 1;
          const p = (pk[q] * (1 - ax) + pk[q + 1] * ax) * (1 - ay) + (pk[q + LT] * (1 - ax) + pk[q + LT + 1] * ax) * ay;
          const t = p <= 0.36 ? 0 : p >= 0.64 ? 1 : (p - 0.36) / 0.28;
          wsn = t * t * (3 - 2 * t);
        }
        // soft moss on bare rock
        if (wsn < 1) {
          const mo = mos[k0] * w00 + mos[k0 + 1] * w10 + mos[k1] * w01 + mos[k1 + 1] * w11;
          if (mo > 0.58) {
            const t = mo >= 0.74 ? 1 : (mo - 0.58) / 0.16, mz = t * t * (3 - 2 * t) * 0.7 * (1 - wsn), ms = 0.85 + d * 0.3;
            R += (moss[0] * ms - R) * mz; Gc += (moss[1] * ms - Gc) * mz; B += (moss[2] * ms - B) * mz;
          }
        }
        if (wsn > 0) { const ss = 0.9 + m * 0.12 + grain * 0.5; R += (snow[0] * ss - R) * wsn; Gc += (snow[1] * ss - Gc) * wsn; B += (snow[2] * ss - B) * wsn; }
      }
      const p = (v * ROCK_N + u) << 2;
      data[p] = R; data[p + 1] = Gc; data[p + 2] = B; data[p + 3] = 255;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ROCK_N;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(data, ROCK_N, ROCK_N), 0, 0);
  // cut to the outline: every rock tile's top as one path, filled once (no seams where tiles meet)
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
    if (!IS_ROCK[tb[(j + 1) * LT + i + 1]]) continue;
    const top = o.shapeOf(tx0 + i, ty0 + j).top;
    ctx.moveTo((top[0] - wx0) / GROUND_RES, (top[1] - wy0) / GROUND_RES);
    for (let k = 2; k < top.length; k += 2) ctx.lineTo((top[k] - wx0) / GROUND_RES, (top[k + 1] - wy0) / GROUND_RES);
    ctx.closePath();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fill('nonzero');
  return { texture: PIXI.Texture.from(canvas, { scaleMode: PIXI.SCALE_MODES.LINEAR }), rows };
}
