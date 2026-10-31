// The Corrupted lands: an uncommon blight that lies over any region in large patches. It does not change what the
// ground is (a corrupted forest is still a forest, barren and dying), only how it looks and how many monsters
// roam it. Pure and seeded: 0 is untouched, 1 is the heart of a blighted patch.
import { fbm, smooth, clamp01 } from './noise';

/** Noise level where the blight begins, and how soft its edge is. About 8% of land lies past the midpoint. */
export const CORRUPT_THRESHOLD = 0.685;
export const CORRUPT_EDGE = 0.04;
/** None near the start; it grows to full strength farther out (tiles from the origin). */
export const CORRUPT_START = { inner: 150, outer: 230 };
/** At or above this a tile counts as Corrupted (banners, monster density, music). */
export const CORRUPT_AT = 0.5;
const SCALE = 230, DETAIL = 36;

export function corruptionAt(seed: number, tx: number, ty: number): number {
  const d = Math.hypot(tx, ty);
  if (d < CORRUPT_START.inner) return 0;
  const base = fbm(tx / SCALE, ty / SCALE, seed + 9400, 3) + (fbm(tx / DETAIL, ty / DETAIL, seed + 9410, 2) - 0.5) * 0.06;
  if (base <= CORRUPT_THRESHOLD) return 0;
  const s = smooth(clamp01((base - CORRUPT_THRESHOLD) / CORRUPT_EDGE));
  const fade = smooth(clamp01((d - CORRUPT_START.inner) / (CORRUPT_START.outer - CORRUPT_START.inner)));
  return s * fade;
}

export const isCorrupt = (c: number): boolean => c >= CORRUPT_AT;

/**
 * Can any tile of the square at (x0, y0) of `size` tiles be blighted? The broad noise is smooth over a chunk, so
 * its corners and centre tell: when all sit well below the threshold the whole square is clean (most of the world),
 * and the per-tile work can be skipped. Never says no where a tile is in fact corrupted.
 */
export function areaMayBeCorrupt(seed: number, x0: number, y0: number, size: number): boolean {
  const far = Math.max(Math.hypot(x0, y0), Math.hypot(x0 + size, y0), Math.hypot(x0, y0 + size), Math.hypot(x0 + size, y0 + size));
  if (far < CORRUPT_START.inner) return false;
  const at = (x: number, y: number) => fbm(x / SCALE, y / SCALE, seed + 9400, 3);
  const top = Math.max(at(x0, y0), at(x0 + size, y0), at(x0, y0 + size), at(x0 + size, y0 + size), at(x0 + size / 2, y0 + size / 2));
  // the detail adds at most 0.03, and the broad noise moves little more than that across a chunk
  return top > CORRUPT_THRESHOLD - 0.08;
}

/** Ground colour under the blight: drained, darkened and leaning violet, still recognisably its own biome. */
export function blightColor(color: number, c: number): number {
  if (c <= 0) return color;
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = Math.min(1, c);
  const mix = (v: number, tint: number) => {
    const grey = v + (l - v) * 0.6 * k;                  // drained
    return Math.round((grey + (tint - grey) * 0.28 * k) * (1 - 0.32 * k));   // toward violet, and darker
  };
  return (mix(r, 0x6a) << 16) | (mix(g, 0x3e) << 8) | mix(b, 0x8a);
}

/** Monster density in the blight: camps and roamers are this many times as common (levels stay the same). */
export const CORRUPT_DENSITY = 2.5;
/** World events come this many times as often. */
export const CORRUPT_EVENTS = 3;
