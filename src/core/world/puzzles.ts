// Dungeon vaults and their puzzles: a side room carved behind a gate, opened by a key, a set of levers or pressure
// plates that must all be lit at once. The generator proves every puzzle solvable before it keeps it: everything
// that opens the gate is reachable with the gate shut, the way on (stairs or boss) never needs the vault, and the
// plates' time window is set from the shortest walk between them. Pure and deterministic.
import { WORLD_CONFIG } from '../config';
import { makeRng, shuffle } from './noise';
import type { InteriorSource } from './interiors';

const T = WORLD_CONFIG.tile;

export type PuzzleKind = 'key' | 'levers' | 'plates';
export interface Spot { tx: number; ty: number; x: number; y: number }
export interface Vault {
  /** the two corridor tiles the gate fills (tile indices), and where it stands */
  gate: { tiles: number[]; x: number; y: number; horizontal: boolean };
  room: { x0: number; y0: number; x1: number; y1: number };
  chest: Spot;
}
export interface Puzzle extends Vault {
  kind: PuzzleKind;
  key?: Spot;
  levers?: Spot[];
  plates?: Spot[];
  /** seconds the plates stay lit (plates only) */
  window?: number;
  /** the shortest walk through all plates, in tiles (plates only) */
  tour?: number;
  /** extra monsters guarding the key */
  guards?: Spot[];
}

/** Chance that a dungeon floor has a vault. */
export const VAULT_CHANCE = 0.65;
/** Tiles per second of the slowest hero, for the plates' time window. */
export const SLOW_HERO_TILES_PER_SEC = 2.5;
export const plateWindow = (tour: number) => Math.ceil(tour / SLOW_HERO_TILES_PER_SEC + 4);

const spot = (tx: number, ty: number): Spot => ({ tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T });
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const tileOf = (p: { x: number; y: number }) => ({ tx: Math.floor(p.x / T), ty: Math.floor(p.y / T) });

/**
 * Carve a corridor (2 long, 2 wide) and a room (5 deep, 6 wide) into solid rock beside the floor, if there is room
 * for it with a wall all round. Returns the vault, or null when no spot fits.
 */
export function carveVault(src: InteriorSource, rng: () => number, floorTile: number): Vault | null {
  const start = tileOf(src.start);
  const dist = src.distanceMap(start.tx, start.ty);
  const avoid = [src.stairsDown, src.boss, src.exit].filter(Boolean).map((p) => tileOf(p!));
  const w = src.w;
  const cands: { x: number; y: number }[] = [];
  for (let y = 2; y < src.h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const d = dist[y * w + x];
    if (d > 10 && avoid.every((a) => Math.hypot(a.tx - x, a.ty - y) > 7)) cands.push({ x, y });
  }
  for (let attempt = 0; attempt < 220 && cands.length; attempt++) {
    const c = cands[Math.floor(rng() * cands.length)];
    const dirs = shuffle(DIRS.slice(), rng);
    for (const [fx, fy] of dirs) {
      const sx = fy !== 0 ? 1 : 0, sy = fx !== 0 ? 1 : 0;               // the side axis, across the corridor
      const at = (k: number, s: number) => ({ x: c.x + fx * k + sx * s, y: c.y + fy * k + sy * s });
      // the corridor mouth: both tiles beside it must be floor
      const m1 = at(0, 0), m2 = at(0, 1);
      if (!src.isFloor(m1.x, m1.y) || !src.isFloor(m2.x, m2.y)) continue;
      // everything from the corridor to the room's far wall, with a margin, must be solid rock inside the map
      let ok = true;
      for (let k = 1; k <= 8 && ok; k++) for (let s = -3; s <= 4 && ok; s++) {
        const p = at(k, s);
        if (p.x < 2 || p.y < 2 || p.x >= w - 2 || p.y >= src.h - 2 || src.isFloor(p.x, p.y)) ok = false;
      }
      if (!ok) continue;
      const set = (p: { x: number; y: number }) => { src.tiles[p.y * w + p.x] = floorTile; };
      for (let k = 1; k <= 2; k++) for (let s = 0; s <= 1; s++) set(at(k, s));
      for (let k = 3; k <= 7; k++) for (let s = -2; s <= 3; s++) set(at(k, s));
      const g1 = at(1, 0), g2 = at(1, 1);
      const corners = [at(3, -2), at(7, 3)];
      const centre = at(5, 0);
      return {
        gate: { tiles: [g1.y * w + g1.x, g2.y * w + g2.x], x: ((g1.x + g2.x) / 2 + 0.5) * T, y: ((g1.y + g2.y) / 2 + 0.5) * T, horizontal: fy !== 0 },
        room: { x0: Math.min(corners[0].x, corners[1].x), y0: Math.min(corners[0].y, corners[1].y), x1: Math.max(corners[0].x, corners[1].x), y1: Math.max(corners[0].y, corners[1].y) },
        chest: spot(centre.x, centre.y)
      };
    }
  }
  return null;
}

/** Floor cells reachable with the gate shut, with their walking distance from a tile. */
function reach(src: InteriorSource, from: { tx: number; ty: number }, gate: number[]): Int16Array {
  return src.distanceMap(from.tx, from.ty, new Set(gate));
}

/** Pick `n` reachable cells, spread at least `apart` tiles from each other, `fromGate` tiles from the gate and clear of the way on. */
function pickSpots(src: InteriorSource, rng: () => number, vault: Vault, n: number, apart: number, fromGate: number): Spot[] | null {
  const start = tileOf(src.start);
  const d = reach(src, start, vault.gate.tiles);
  const gd = reach(src, tileOf(vault.gate), []);
  const avoid = [src.stairsDown, src.boss, src.exit].filter(Boolean).map((p) => tileOf(p!));
  const w = src.w;
  const cands: Spot[] = [];
  for (let y = 0; y < src.h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i] < 3 || gd[i] < fromGate) continue;
    if (x >= vault.room.x0 - 1 && x <= vault.room.x1 + 1 && y >= vault.room.y0 - 1 && y <= vault.room.y1 + 1) continue;
    if (avoid.some((a) => Math.hypot(a.tx - x, a.ty - y) < 4)) continue;
    cands.push(spot(x, y));
  }
  const out: Spot[] = [];
  for (let tries = 0; tries < 300 && out.length < n && cands.length; tries++) {
    const c = cands[Math.floor(rng() * cands.length)];
    if (out.every((o) => Math.hypot(o.tx - c.tx, o.ty - c.ty) >= apart)) out.push(c);
  }
  return out.length === n ? out : null;
}

/** Shortest walk (tiles) that visits every plate, starting at any of them; Infinity if one cannot be reached. */
export function plateTour(src: InteriorSource, plates: Spot[], gate: number[]): number {
  const w = src.w;
  const d = plates.map((p) => reach(src, p, gate));
  const between = (a: number, b: number) => { const v = d[a][plates[b].ty * w + plates[b].tx]; return v < 0 ? Infinity : v; };
  let best = Infinity;
  const perm = (order: number[], rest: number[]) => {
    if (!rest.length) {
      let len = 0;
      for (let i = 1; i < order.length; i++) len += between(order[i - 1], order[i]);
      best = Math.min(best, len);
      return;
    }
    rest.forEach((r, i) => perm([...order, r], rest.filter((_, j) => j !== i)));
  };
  perm([], plates.map((_, i) => i));
  return best;
}

export interface Proof { ok: boolean; reason?: string }

/** Prove a puzzle solvable (see the file comment). */
export function verifyPuzzle(src: InteriorSource, pz: Puzzle): Proof {
  const w = src.w;
  const start = tileOf(src.start);
  const shut = reach(src, start, pz.gate.tiles);
  const open = src.distanceMap(start.tx, start.ty);
  const at = (m: Int16Array, p: { tx: number; ty: number }) => m[p.ty * w + p.tx];
  const mechanisms: Spot[] = pz.kind === 'key' ? [pz.key!] : pz.kind === 'levers' ? pz.levers! : pz.plates!;
  if (!mechanisms.length) return { ok: false, reason: 'no mechanism' };
  if (mechanisms.some((m) => at(shut, m) < 0)) return { ok: false, reason: 'a mechanism is behind the gate or cut off' };
  for (const way of [src.stairsDown, src.boss]) if (way && at(shut, tileOf(way)) < 0) return { ok: false, reason: 'the way on needs the vault' };
  if (at(shut, pz.chest) >= 0) return { ok: false, reason: 'the vault can be entered without opening the gate' };
  if (at(open, pz.chest) < 0) return { ok: false, reason: 'the vault cannot be reached even with the gate open' };
  if (pz.kind === 'plates') {
    const tour = plateTour(src, pz.plates!, pz.gate.tiles);
    if (!Number.isFinite(tour)) return { ok: false, reason: 'the plates are not connected' };
    if ((pz.window ?? 0) < tour / SLOW_HERO_TILES_PER_SEC + 4) return { ok: false, reason: 'the plates time window is too short' };
  }
  return { ok: true };
}

/** Try to give a dungeon floor a vault with a puzzle; keeps it only if the proof holds. */
export function addVault(src: InteriorSource, seed: number, floorTile: number): Puzzle | null {
  const rng = makeRng((seed ^ 0x5eed5) >>> 0);
  if (rng() >= VAULT_CHANCE) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const before = src.tiles.slice();
    const vault = carveVault(src, rng, floorTile);
    if (!vault) return null;
    const r = rng();
    const kind: PuzzleKind = r < 0.4 ? 'key' : r < 0.75 ? 'levers' : 'plates';
    let pz: Puzzle | null = null;
    if (kind === 'key') {
      const k = pickSpots(src, rng, vault, 1, 0, 12);
      if (k) {
        const guards = pickSpots(src, rng, vault, 6, 0, 8)?.filter((g) => Math.hypot(g.tx - k[0].tx, g.ty - k[0].ty) < 9).slice(0, 2) ?? [];
        pz = { ...vault, kind, key: k[0], guards };
      }
    } else if (kind === 'levers') {
      const n = 2 + (rng() < 0.5 ? 1 : 0);
      const l = pickSpots(src, rng, vault, n, 8, 5);
      if (l) pz = { ...vault, kind, levers: l };
    } else {
      const p = pickSpots(src, rng, vault, 3, 6, 4);
      if (p) {
        const tour = plateTour(src, p, vault.gate.tiles);
        if (Number.isFinite(tour)) pz = { ...vault, kind, plates: p, tour, window: plateWindow(tour) };
      }
    }
    if (pz && verifyPuzzle(src, pz).ok) return pz;
    src.tiles.set(before);              // put the rock back and try elsewhere
  }
  return null;
}
