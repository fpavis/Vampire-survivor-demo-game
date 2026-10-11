// Towers, docks and the terrain they change. Pure: placement rules, costs, construction, tile edits.
// The world is regenerated from its seed, so a tower is saved as a tiny record and its tile edits are re-derived.
import { WORLD_CONFIG } from '../config';
import { hash } from './noise';
import { BIOME, isSolidBiome, isWaterBiome } from './biomes';

const T = WORLD_CONFIG.tile;

export type TowerKind = 'spire' | 'ward' | 'beacon' | 'waypoint' | 'climb' | 'bridge' | 'dock';
export interface Cost { gold: number; wood: number; stone: number; iron: number }
export const emptyCost = (): Cost => ({ gold: 0, wood: 0, stone: 0, iron: 0 });
export const RES: (keyof Cost)[] = ['gold', 'wood', 'stone', 'iron'];

export interface TowerDef {
  kind: TowerKind;
  name: string;
  icon: string;
  color: number;
  cost: Cost;
  blurb: string;
  /** minimum distance in tiles to any other tower */
  spacing: number;
}

// Monumental: every tower is a long-term investment. Resources are the only cap on how many exist.
export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  spire: { kind: 'spire', name: 'Arcane Spire', icon: '🗼', color: 0x7ab4ff, cost: { gold: 140, wood: 40, stone: 70, iron: 28 }, spacing: 7,
    blurb: 'Fires a spell of your choice at anything that comes near. Arm it with a spare spell from your bag.' },
  ward: { kind: 'ward', name: 'Warding Obelisk', icon: '🔰', color: 0xf3c75a, cost: { gold: 260, wood: 20, stone: 130, iron: 45 }, spacing: 10,
    blurb: 'A shimmering dome that repels monsters and slowly heals those within.' },
  beacon: { kind: 'beacon', name: 'Beacon', icon: '🔥', color: 0xff9a4a, cost: { gold: 70, wood: 36, stone: 44, iron: 6 }, spacing: 9,
    blurb: 'Reveals the land around it for good and shines through the dark.' },
  waypoint: { kind: 'waypoint', name: 'Waypoint', icon: '🌀', color: 0xb06af0, cost: { gold: 110, wood: 14, stone: 54, iron: 14 }, spacing: 9,
    blurb: 'A stone gate. Travel between waypoints for a little gold.' },
  climb: { kind: 'climb', name: 'Climbing Tower', icon: '⛰️', color: 0xa8a090, cost: { gold: 320, wood: 130, stone: 170, iron: 64 }, spacing: 8,
    blurb: 'Cuts a stair into a mountain and opens the plateau at its heart, with ore and crystals to mine.' },
  bridge: { kind: 'bridge', name: 'Bridge Tower', icon: '🌉', color: 0xc8a060, cost: { gold: 90, wood: 110, stone: 80, iron: 24 }, spacing: 6,
    blurb: 'Spans the water in front of it with a bridge, joining the shores.' },
  dock: { kind: 'dock', name: 'Dock', icon: '⚓', color: 0x6ab8d8, cost: { gold: 90, wood: 84, stone: 30, iron: 12 }, spacing: 4,
    blurb: 'A pier on the shore with a boat. Sail across deep water to far islands.' }
};
export const TOWER_KINDS = Object.keys(TOWER_DEFS) as TowerKind[];

export interface TowerRec {
  id: string;
  kind: TowerKind;
  tx: number; ty: number;            // centre tile
  dir: number;                       // 0..7, direction of a bridge / pier / climbing stair
  len: number;                       // length in tiles of that structure
  delivered: Cost;
  built: boolean;
  spell: string | null;              // spell uid armed in a spire
}

export const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

export function newTower(kind: TowerKind, tx: number, ty: number, plan?: { dir: number; len: number }): TowerRec {
  return { id: `t${tx},${ty}`, kind, tx, ty, dir: plan?.dir ?? 0, len: plan?.len ?? 0, delivered: emptyCost(), built: false, spell: null };
}

// -------------------------------------------------------------------- construction
export const remaining = (cost: Cost, d: Cost): Cost => ({ gold: Math.max(0, cost.gold - d.gold), wood: Math.max(0, cost.wood - d.wood), stone: Math.max(0, cost.stone - d.stone), iron: Math.max(0, cost.iron - d.iron) });
export const totalOf = (c: Cost) => c.gold + c.wood + c.stone + c.iron;
export const isFunded = (rec: TowerRec) => totalOf(remaining(TOWER_DEFS[rec.kind].cost, rec.delivered)) === 0;
export const progressOf = (rec: TowerRec): number => {
  const cost = TOWER_DEFS[rec.kind].cost;
  const need = totalOf(cost);
  return need ? Math.min(1, totalOf(rec.delivered) / need) : 1;
};
/** which of 3 scaffolding stages to draw (0 = bare foundation) */
export const stageOf = (rec: TowerRec) => Math.min(3, Math.floor(progressOf(rec) * 4));

/** Moves as much of the missing material as the wallet holds into the site. Returns what was handed over. */
export function deposit(rec: TowerRec, wallet: Cost): Cost {
  const need = remaining(TOWER_DEFS[rec.kind].cost, rec.delivered);
  const given = emptyCost();
  for (const r of RES) {
    const n = Math.min(need[r], Math.max(0, Math.floor(wallet[r])));
    given[r] = n;
    wallet[r] -= n;
    rec.delivered[r] += n;
  }
  return given;
}

// -------------------------------------------------------------------- placement
export interface PlaceEnv {
  /** biome BEFORE any tower edits (the generator's own) */
  baseBiomeAt(tx: number, ty: number): number;
  /** biome with edits applied (what the player sees) */
  biomeAt(tx: number, ty: number): number;
  towers: TowerRec[];
  /** places of interest (towns, caves, ruins) near the spot */
  pois: { tx: number; ty: number; type: string }[];
}

export interface PlacementResult { ok: boolean; reason?: string; plan?: { dir: number; len: number } }

const walkableLand = (b: number) => !isSolidBiome(b) && !isWaterBiome(b) && b !== BIOME.VOID;

function footprint(kind: TowerKind): [number, number][] {
  const out: [number, number][] = [];
  const r = kind === 'dock' || kind === 'bridge' ? 0 : 1;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) out.push([i, j]);
  return out;
}

export function checkPlacement(kind: TowerKind, tx: number, ty: number, env: PlaceEnv): PlacementResult {
  const def = TOWER_DEFS[kind];
  for (const [i, j] of footprint(kind)) {
    if (!walkableLand(env.biomeAt(tx + i, ty + j))) return { ok: false, reason: 'Needs solid, open ground' };
  }
  for (const o of env.towers) {
    if (Math.hypot(o.tx - tx, o.ty - ty) < Math.max(def.spacing, TOWER_DEFS[o.kind].spacing * 0.6)) return { ok: false, reason: 'Too close to another tower' };
  }
  for (const p of env.pois) {
    if (Math.hypot(p.tx - tx, p.ty - ty) < (p.type === 'city' ? 14 : 9)) return { ok: false, reason: p.type === 'city' ? 'Too close to a town' : 'Too close to a landmark' };
  }
  if (Math.hypot(tx, ty) < 12) return { ok: false, reason: 'Too close to where the journey began' };
  if (kind === 'climb') {
    const plan = planClimb(tx, ty, env.baseBiomeAt);
    return plan ? { ok: true, plan: { dir: plan.dir, len: plan.len } } : { ok: false, reason: 'Needs the foot of a tall mountain range' };
  }
  if (kind === 'bridge') {
    const plan = planBridge(tx, ty, env.baseBiomeAt, 18, false);
    return plan ? { ok: true, plan: { dir: plan.dir, len: plan.len } } : { ok: false, reason: 'Needs a shore with land across the water' };
  }
  if (kind === 'dock') {
    const plan = planBridge(tx, ty, env.baseBiomeAt, 3, true);
    return plan ? { ok: true, plan: { dir: plan.dir, len: plan.len } } : { ok: false, reason: 'Needs a shore with deep water in front' };
  }
  return { ok: true };
}

// -------------------------------------------------------------------- terrain edits
export type TileEdit = [number, number, number];   // tx, ty, biome

const CARDINAL = [0, 1, 2, 3];
const perp = (dir: number): [number, number] => { const [dx, dy] = DIRS[dir]; return [-dy, dx]; };

/**
 * Bridge across water (or a short pier for a dock). Looks along each direction from the tower for water;
 * a bridge needs land on the far side within `maxLen`, a pier just needs deep water.
 */
export function planBridge(tx: number, ty: number, biomeAt: (x: number, y: number) => number, maxLen: number, pier: boolean): { dir: number; len: number } | null {
  let best: { dir: number; len: number; score: number } | null = null;
  for (const dir of CARDINAL) {
    const [dx, dy] = DIRS[dir];
    // skip any land between the tower and the water (up to 3 tiles of beach)
    let k = 1, lead = 0;
    while (k <= 3 && !isWaterBiome(biomeAt(tx + dx * k, ty + dy * k))) { if (!walkableLand(biomeAt(tx + dx * k, ty + dy * k))) { lead = -1; break; } k++; lead++; }
    if (lead < 0 || k > 3) continue;
    // measure the water run (long enough to see past a pier's end)
    const cap = pier ? maxLen + 4 : maxLen;
    let n = 0, deep = 0;
    while (n < cap && isWaterBiome(biomeAt(tx + dx * (k + n), ty + dy * (k + n)))) { if (biomeAt(tx + dx * (k + n), ty + dy * (k + n)) === BIOME.DEEP) deep++; n++; }
    if (n === 0) continue;
    if (pier) {
      // the pier reaches `maxLen` tiles into the water and there must be open water beyond it for the boat
      if (n < maxLen + 1) continue;
      const score = deep * 2 + n;
      if (!best || score > best.score) best = { dir, len: k - 1 + maxLen, score };
    } else {
      const endsOnLand = walkableLand(biomeAt(tx + dx * (k + n), ty + dy * (k + n)));
      if (!endsOnLand || n < 2 || deep < 1) continue;     // only worth a tower when deep water really cuts the way
      const score = 100 - n;               // shorter spans first
      if (!best || score > best.score) best = { dir, len: k + n, score };
    }
  }
  return best ? { dir: best.dir, len: best.len } : null;
}

/** Stair + plateau carved into a mountain: a corridor of walkable plateau tiles ending in a clearing. */
export function planClimb(tx: number, ty: number, biomeAt: (x: number, y: number) => number): { dir: number; len: number } | null {
  let best: { dir: number; len: number; depth: number } | null = null;
  for (const dir of CARDINAL) {
    const [dx, dy] = DIRS[dir];
    let k = 2;
    while (k <= 5 && !(biomeAt(tx + dx * k, ty + dy * k) === BIOME.MOUNTAIN || biomeAt(tx + dx * k, ty + dy * k) === BIOME.PEAK)) {
      if (isWaterBiome(biomeAt(tx + dx * k, ty + dy * k))) { k = 99; break; }
      k++;
    }
    if (k > 5) continue;
    let depth = 0;
    while (depth < 24) {
      const b = biomeAt(tx + dx * (k + depth), ty + dy * (k + depth));
      if (b !== BIOME.MOUNTAIN && b !== BIOME.PEAK) break;
      depth++;
    }
    if (depth < 9) continue;                                  // a real range, not a bump
    if (!best || depth > best.depth) best = { dir, len: k + Math.min(depth - 3, 13), depth };
  }
  return best ? { dir: best.dir, len: best.len } : null;
}

export const PLATEAU_RADIUS = 5.5;

/** Every tile a built tower rewrites, derived from its record alone. */
export function towerEdits(rec: TowerRec): TileEdit[] {
  const out: TileEdit[] = [];
  const [dx, dy] = DIRS[rec.dir];
  const [px, py] = perp(rec.dir);
  if (rec.kind === 'bridge' || rec.kind === 'dock') {
    const half = rec.kind === 'bridge' ? 1 : 0;
    for (let k = 1; k <= rec.len; k++) {
      for (let w = -half; w <= half; w++) out.push([rec.tx + dx * k + px * w, rec.ty + dy * k + py * w, BIOME.BRIDGE]);
    }
  } else if (rec.kind === 'climb') {
    const cxT = rec.tx + dx * rec.len, cyT = rec.ty + dy * rec.len;
    for (let k = 2; k <= rec.len; k++) for (let w = -1; w <= 1; w++) out.push([rec.tx + dx * k + px * w, rec.ty + dy * k + py * w, BIOME.PLATEAU]);
    const R = Math.ceil(PLATEAU_RADIUS);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= PLATEAU_RADIUS * PLATEAU_RADIUS) out.push([cxT + i, cyT + j, BIOME.PLATEAU]);
  }
  return out;
}

/** Plateau centre (tile) of a climbing tower, or null for other towers. */
export function plateauCentre(rec: TowerRec): { tx: number; ty: number } | null {
  if (rec.kind !== 'climb') return null;
  const [dx, dy] = DIRS[rec.dir];
  return { tx: rec.tx + dx * rec.len, ty: rec.ty + dy * rec.len };
}

export interface EditDecor { type: string; x: number; y: number; variant: number }
/** Ore and crystals that grow on a carved plateau (deterministic). */
export function plateauDecor(rec: TowerRec, seed: number): EditDecor[] {
  const c = plateauCentre(rec);
  if (!c) return [];
  const out: EditDecor[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(c.tx, c.ty, seed + 90) * 1.5;
    const r = (1.2 + hash(c.tx + i, c.ty, seed + 91) * (PLATEAU_RADIUS - 2)) * T;
    out.push({ type: i % 3 === 2 ? 'crystal' : i % 3 === 1 ? 'boulder' : 'ore', x: (c.tx + 0.5) * T + Math.cos(a) * r, y: (c.ty + 0.5) * T + Math.sin(a) * r * 0.9, variant: i });
  }
  out.push({ type: 'ore', x: (c.tx + 0.5) * T, y: (c.ty + 0.5) * T, variant: 0 });
  return out;
}

/** Where the boat of a dock floats: the water tile just past the pier. */
export function boatSpot(rec: TowerRec): { x: number; y: number } {
  const [dx, dy] = DIRS[rec.dir];
  const k = rec.len + 1;
  return { x: (rec.tx + dx * k + 0.5) * T, y: (rec.ty + dy * k + 0.5) * T };
}

/** A map of all edits by tile key, for quick lookup while generating chunks. */
export function editMap(towers: TowerRec[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of towers) if (t.built) for (const [x, y, b] of towerEdits(t)) m.set(`${x},${y}`, b);
  return m;
}

// ------------------------------------------------------------------ waypoints and sea
export const fareBetween = (a: { tx: number; ty: number }, b: { tx: number; ty: number }) => Math.round(12 + Math.hypot(a.tx - b.tx, a.ty - b.ty) * 0.45);

export const WARD_RADIUS = 7 * T;
export const SPIRE_RANGE = 540;
export const BOAT_SPEED = 1.35;

/** Walkability for a hero in a boat: water is open, land is closed. */
export const boatBlocked = (b: number) => !(b === BIOME.DEEP || b === BIOME.SHALLOW);

export interface Cache { id: string; tx: number; ty: number; level: number }
export const CACHE_CELL = 22;

/**
 * Treasure on remote islands: a land tile with water all around it. Deterministic and sparse.
 * `biomeAt` is the generator's own biome function.
 */
export function cacheForCell(seed: number, cx: number, cy: number, biomeAt: (x: number, y: number) => number): Cache | null {
  if (hash(cx, cy, seed + 7000) > 0.6) return null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const tx = cx * CACHE_CELL + 2 + Math.floor(hash(cx, cy, seed + 7010 + attempt) * (CACHE_CELL - 4));
    const ty = cy * CACHE_CELL + 2 + Math.floor(hash(cx, cy, seed + 7030 + attempt) * (CACHE_CELL - 4));
    const b = biomeAt(tx, ty);
    if (b !== BIOME.SAND && b !== BIOME.GRASS && b !== BIOME.FOREST && b !== BIOME.DRY) continue;
    if (Math.hypot(tx, ty) < 40) continue;
    // an island (or a far shore): over half of a ring 8 tiles out is water, and nothing solid hugs the spot
    let water = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (isWaterBiome(biomeAt(Math.round(tx + Math.cos(a) * 8), Math.round(ty + Math.sin(a) * 8)))) water++;
    }
    if (water < 11) continue;
    return { id: `c${cx},${cy}`, tx, ty, level: 1 + Math.floor(Math.hypot(tx, ty) / 30) };
  }
  return null;
}
