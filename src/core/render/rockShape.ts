// The outline of natural rock (mountains, peaks, cave walls) one tile at a time, so cliffs read as rock
// instead of stacked squares. Edges open to the floor are pulled in by a gentle wobble taken from world-space
// noise, so neighbouring tiles agree where they meet; outer corners are rounded; inner corners stay square
// (the wobble fades out towards them). Points are world coordinates on the ground plane, clockwise. Pure.
import { hash, valueNoise } from '../world/noise';

export interface RockShape {
  /** The top surface: x, y pairs (world units, untilted), clockwise from the north-west. */
  top: number[];
  /** The sunlit rim along the north, west to east (x, y pairs), or null when the north is not open. */
  north: number[] | null;
  /** Where the cliff face hangs from, west to east (x, y pairs), or null when the south is not open. */
  south: number[] | null;
  /** True when no side is open: the whole tile, drawn the old way. */
  whole: boolean;
}

/** How far an open edge is pulled in at most, and how far the wobble fades towards an inner corner. */
export const ROCK_INSET = 6;
const FADE = 0.6;
const STEP = 8;

/** The radius of the rounded outer corner at world vertex (vx, vy) (tile corners, in world units). */
export const cornerRadius = (vx: number, vy: number, seed: number, T: number): number => T * (0.36 + 0.08 * hash(Math.round(vx), Math.round(vy), seed + 621));

/** The wobble of an open edge at a point on it: the same for both tiles that share the point. */
const wobble = (x: number, y: number, horizontal: boolean, seed: number): number =>
  ROCK_INSET * (0.25 + 0.75 * valueNoise((horizontal ? x : y) / 37, (horizontal ? y : x) / 37 + (horizontal ? 0 : 50), seed + 623));

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function rockShape(tx: number, ty: number, wallAt: (tx: number, ty: number) => boolean, seed: number, T: number): RockShape {
  const x0 = tx * T, y0 = ty * T, x1 = x0 + T, y1 = y0 + T;
  const n = !wallAt(tx, ty - 1), s = !wallAt(tx, ty + 1), w = !wallAt(tx - 1, ty), e = !wallAt(tx + 1, ty);
  if (!n && !s && !w && !e) return { top: [x0, y0, x1, y0, x1, y1, x0, y1], north: null, south: null, whole: true };

  // does an open edge carry on straight past this end? (else the end is an inner corner and the wobble fades to it)
  const carries = (side: 'n' | 's' | 'w' | 'e', end: -1 | 1): boolean => {
    if (side === 'n' || side === 's') { const nx = tx + end, oy = side === 'n' ? ty - 1 : ty + 1; return wallAt(nx, ty) && !wallAt(nx, oy); }
    const ny = ty + end, ox = side === 'w' ? tx - 1 : tx + 1; return wallAt(tx, ny) && !wallAt(ox, ny);
  };
  const fade = (side: 'n' | 's' | 'w' | 'e', pos: number) => {
    // pos 0..1 along the edge, from its west (north) end
    let f = 1;
    if (!carries(side, -1)) f *= smooth(pos / FADE);
    if (!carries(side, 1)) f *= smooth((1 - pos) / FADE);
    return f;
  };
  const dN = (x: number) => wobble(x, y0, true, seed) * fade('n', (x - x0) / T);
  const dS = (x: number) => wobble(x, y1, true, seed) * fade('s', (x - x0) / T);
  const dW = (y: number) => wobble(x0, y, false, seed) * fade('w', (y - y0) / T);
  const dE = (y: number) => wobble(x1, y, false, seed) * fade('e', (y - y0) / T);

  const rNW = n && w ? cornerRadius(x0, y0, seed, T) : 0, rNE = n && e ? cornerRadius(x1, y0, seed, T) : 0;
  const rSE = s && e ? cornerRadius(x1, y1, seed, T) : 0, rSW = s && w ? cornerRadius(x0, y1, seed, T) : 0;

  const top: number[] = [];
  const push = (x: number, y: number) => {
    const k = top.length;
    if (k >= 2 && Math.abs(top[k - 2] - x) < 0.01 && Math.abs(top[k - 1] - y) < 0.01) return;
    top.push(x, y);
  };
  // an arc round a rounded corner, from angle a0 to a1 (radians, screen orientation: y down)
  const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, out: (x: number, y: number) => void) => {
    const k = 5;
    for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; out(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
  };
  const samples = (a: number, b: number): number[] => {
    const out: number[] = [];
    const m = Math.max(1, Math.round(Math.abs(b - a) / STEP));
    for (let i = 0; i <= m; i++) out.push(a + ((b - a) * i) / m);
    return out;
  };

  // north-west corner, then the north edge
  if (rNW) arc(x0 + rNW, y0 + rNW, rNW - dW(y0 + rNW), rNW - dN(x0 + rNW), Math.PI, Math.PI * 1.5, push);
  else push(x0 + (w ? dW(y0) : 0), y0 + (n ? dN(x0) : 0));
  if (n) for (const x of samples(x0 + rNW, x1 - rNE)) push(x, y0 + dN(x));
  // north-east corner, east edge
  if (rNE) arc(x1 - rNE, y0 + rNE, rNE - dE(y0 + rNE), rNE - dN(x1 - rNE), Math.PI * 1.5, Math.PI * 2, push);
  else push(x1 - (e ? dE(y0) : 0), y0 + (n ? dN(x1) : 0));
  if (e) for (const y of samples(y0 + rNE, y1 - rSE)) push(x1 - dE(y), y);
  // south-east corner, south edge (east to west)
  if (rSE) arc(x1 - rSE, y1 - rSE, rSE - dE(y1 - rSE), rSE - dS(x1 - rSE), 0, Math.PI * 0.5, push);
  else push(x1 - (e ? dE(y1) : 0), y1 - (s ? dS(x1) : 0));
  if (s) for (const x of samples(x1 - rSE, x0 + rSW)) push(x, y1 - dS(x));
  // south-west corner, west edge (south to north)
  if (rSW) arc(x0 + rSW, y1 - rSW, rSW - dW(y1 - rSW), rSW - dS(x0 + rSW), Math.PI * 0.5, Math.PI, push);
  else push(x0 + (w ? dW(y1) : 0), y1 - (s ? dS(x0) : 0));
  if (w) for (const y of samples(y1 - rSW, y0 + rNW)) push(x0 + dW(y), y);
  // the loop closes on the first point
  if (top.length >= 4 && Math.abs(top[0] - top[top.length - 2]) < 0.01 && Math.abs(top[1] - top[top.length - 1]) < 0.01) top.length -= 2;

  let south: number[] | null = null;
  if (s) {
    south = [];
    const add = (x: number, y: number) => { const k = south!.length; if (k >= 2 && Math.abs(south![k - 2] - x) < 0.01 && Math.abs(south![k - 1] - y) < 0.01) return; south!.push(x, y); };
    // west to east: the south-west arc's lower half, the south edge, the south-east arc's lower half
    if (rSW) arc(x0 + rSW, y1 - rSW, rSW - dW(y1 - rSW), rSW - dS(x0 + rSW), Math.PI, Math.PI * 0.5, add);
    else add(x0 + (w ? dW(y1) : 0), y1 - dS(x0));
    for (const x of samples(x0 + rSW, x1 - rSE)) add(x, y1 - dS(x));
    if (rSE) arc(x1 - rSE, y1 - rSE, rSE - dE(y1 - rSE), rSE - dS(x1 - rSE), Math.PI * 0.5, 0, add);
    else add(x1 - (e ? dE(y1) : 0), y1 - dS(x1));
  }
  let north: number[] | null = null;
  if (n) {
    north = [];
    const add = (x: number, y: number) => { const k = north!.length; if (k >= 2 && Math.abs(north![k - 2] - x) < 0.01 && Math.abs(north![k - 1] - y) < 0.01) return; north!.push(x, y); };
    if (rNW) arc(x0 + rNW, y0 + rNW, rNW - dW(y0 + rNW), rNW - dN(x0 + rNW), Math.PI * 1.25, Math.PI * 1.5, add);
    for (const x of samples(x0 + rNW, x1 - rNE)) add(x, y0 + dN(x));
    if (rNE) arc(x1 - rNE, y0 + rNE, rNE - dE(y0 + rNE), rNE - dN(x1 - rNE), Math.PI * 1.5, Math.PI * 1.75, add);
  }
  return { top, north, south, whole: false };
}

/** Is (x, y) inside the polygon (x, y pairs)? Even-odd rule. */
export function insidePolygon(poly: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The y of a west-to-east polyline at x (clamped to its ends). */
export function lineYAt(line: number[], x: number): number {
  if (x <= line[0]) return line[1];
  for (let i = 2; i < line.length; i += 2) {
    if (x <= line[i]) { const x0 = line[i - 2], y0 = line[i - 1], t = line[i] === x0 ? 0 : (x - x0) / (line[i] - x0); return y0 + (line[i + 1] - y0) * t; }
  }
  return line[line.length - 1];
}

/**
 * Does a circle at (x, y) of radius r touch this rock tile, with its outer corners rounded as drawn? The
 * straight edges keep the tile's own bounds (the wobble is a few pixels; the corners are where it shows).
 */
export function rockTouches(tx: number, ty: number, wallAt: (tx: number, ty: number) => boolean, seed: number, T: number, x: number, y: number, r: number): boolean {
  const x0 = tx * T, y0 = ty * T, x1 = x0 + T, y1 = y0 + T;
  const nx = Math.max(x0, Math.min(x, x1)), ny = Math.max(y0, Math.min(y, y1));
  if ((x - nx) ** 2 + (y - ny) ** 2 >= r * r) return false;
  // which corner square is the circle's centre nearest? only there can rounding matter
  const west = x < x0 + T / 2, north = y < y0 + T / 2;
  const sideX = west ? !wallAt(tx - 1, ty) : !wallAt(tx + 1, ty), sideY = north ? !wallAt(tx, ty - 1) : !wallAt(tx, ty + 1);
  if (!sideX || !sideY) return true;
  const vx = west ? x0 : x1, vy = north ? y0 : y1;
  const R = cornerRadius(vx, vy, seed, T);
  const cx = west ? x0 + R : x1 - R, cy = north ? y0 + R : y1 - R;
  // outside the corner square the tile is square
  if ((west ? x >= cx : x <= cx) || (north ? y >= cy : y <= cy)) return true;
  return (x - cx) ** 2 + (y - cy) ** 2 < (R + r) ** 2;
}
