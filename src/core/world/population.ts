import { WORLD_CONFIG } from '../config';
import { hash } from './noise';
import { BIOME, ROSTERS, WARLORDS, groupOf, isSolidBiome, isWaterBiome, type RosterEntry } from './biomes';
import type { OverworldSource } from './terrain';
import { GROUP_LEVEL_OFFSET, tierOf, zoneLevel } from './difficulty';

const T = WORLD_CONFIG.tile;
const CT = WORLD_CONFIG.chunkTiles;

export const POPULATION = {
  noCampRadius: 16,       // tiles around the start without camps
  lairCell: 64,           // tiles per lair cell
  lairMinDistance: 130,   // tiles from the start
  lairChance: 0.55,
  respawnSeconds: 1800    // cleared camps come back after this much play time
} as const;

export interface CampMember { type: string; elite: boolean }

export interface Camp {
  id: string;
  cx: number; cy: number;          // chunk the camp belongs to
  tx: number; ty: number;          // home tile
  x: number; y: number;            // home position (world units)
  level: number;
  tier: number;
  group: string;
  members: CampMember[];
  leash: number;
  lair: boolean;
}

export function pickRosterEntry(group: string, level: number, r: number): RosterEntry {
  const roster = ROSTERS[group] ?? ROSTERS.field;
  const options = roster.filter((e) => e.level <= level);
  const list = options.length ? options : [roster[0]];
  const total = list.reduce((s, e) => s + e.weight, 0);
  let roll = r * total;
  for (const e of list) { roll -= e.weight; if (roll <= 0) return e; }
  return list[list.length - 1];
}

const walkable = (biome: number) => !isSolidBiome(biome) && !isWaterBiome(biome);

/** Deterministic resident monsters: seeded camps per chunk and warlord lairs per large cell. */
export class Population {
  private cache = new Map<string, Camp[]>();
  private lairCache = new Map<string, Camp | null>();

  constructor(private source: OverworldSource, private seed: number = source.seed) {}

  campsForChunk(cx: number, cy: number): Camp[] {
    const key = `${cx},${cy}`;
    let list = this.cache.get(key);
    if (list) return list;
    list = this.build(cx, cy);
    this.cache.set(key, list);
    return list;
  }

  private tileFree(tx: number, ty: number, clearance: number): boolean {
    for (let y = -clearance; y <= clearance; y++) for (let x = -clearance; x <= clearance; x++) {
      if (!walkable(this.source.biomeAt(tx + x, ty + y))) return false;
    }
    return !this.source.poisNear(tx, ty, 7).some((p) => Math.hypot(p.tx - tx, p.ty - ty) < 7);
  }

  private build(cx: number, cy: number): Camp[] {
    const out: Camp[] = [];
    const seed = this.seed;
    const centerTx = cx * CT + CT / 2, centerTy = cy * CT + CT / 2;
    const dist = Math.hypot(centerTx, centerTy);

    if (dist >= POPULATION.noCampRadius) {
      const level = this.source.levelAt(Math.floor(centerTx), Math.floor(centerTy));
      const chance = Math.min(0.62, 0.28 + 0.008 * level);
      const count = hash(cx, cy, seed + 4001) < chance ? (level > 10 && hash(cx, cy, seed + 4002) < chance * 0.3 ? 2 : 1) : 0;
      for (let i = 0; i < count; i++) {
        const camp = this.makeCamp(cx, cy, i);
        if (camp) out.push(camp);
      }
    }

    const lair = this.lairInChunk(cx, cy);
    if (lair) out.push(lair);
    return out;
  }

  private makeCamp(cx: number, cy: number, index: number): Camp | null {
    const seed = this.seed;
    for (let attempt = 0; attempt < 8; attempt++) {
      const tx = cx * CT + 2 + Math.floor(hash(cx, cy, seed + 4100 + index * 31 + attempt) * (CT - 4));
      const ty = cy * CT + 2 + Math.floor(hash(cx, cy, seed + 4200 + index * 31 + attempt) * (CT - 4));
      if (Math.hypot(tx, ty) < POPULATION.noCampRadius) continue;
      if (!this.tileFree(tx, ty, 1)) continue;
      const biome = this.source.biomeAt(tx, ty);
      const group = groupOf(biome);
      const level = this.source.levelAt(tx, ty);
      const tier = tierOf(level);
      const h = (n: number) => hash(tx, ty, seed + 4300 + n);

      const primary = pickRosterEntry(group, level, h(1));
      const [lo, hi] = primary.group ?? [2, 4];
      let n = lo + Math.floor(h(2) * (hi - lo + 1)) + Math.floor(level / 20);
      n = Math.min(10, Math.max(1, n));
      const members: CampMember[] = [];
      const eliteChance = 0.05 + 0.01 * tier;
      for (let k = 0; k < n; k++) members.push({ type: primary.type, elite: k === 0 && h(3) < eliteChance * 4 });
      if (h(4) < 0.4) {
        const second = pickRosterEntry(group, level, h(5));
        if (second.type !== primary.type) for (let k = 0; k < 1 + Math.floor(h(6) * 2); k++) members.push({ type: second.type, elite: false });
      }
      return {
        id: `${cx},${cy},${index}`, cx, cy, tx, ty,
        x: (tx + 0.5) * T, y: (ty + 0.5) * T,
        level, tier, group, members, leash: 340 + 22 * members.length, lair: false
      };
    }
    return null;
  }

  // ----- warlord lairs: at most one per large cell, far from the start, defeated once (persisted)
  private lairInChunk(cx: number, cy: number): Camp | null {
    const cellTiles = POPULATION.lairCell;
    const lx = Math.floor((cx * CT + CT / 2) / cellTiles), ly = Math.floor((cy * CT + CT / 2) / cellTiles);
    const lair = this.lairForCell(lx, ly);
    if (!lair) return null;
    return lair.cx === cx && lair.cy === cy ? lair : null;
  }

  lairForCell(lx: number, ly: number): Camp | null {
    const key = `${lx},${ly}`;
    if (this.lairCache.has(key)) return this.lairCache.get(key) ?? null;
    const lair = this.makeLair(lx, ly);
    this.lairCache.set(key, lair);
    return lair;
  }

  private makeLair(lx: number, ly: number): Camp | null {
    const seed = this.seed;
    const size = POPULATION.lairCell;
    if (hash(lx, ly, seed + 5001) > POPULATION.lairChance) return null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = lx * size + 12 + Math.floor(hash(lx, ly, seed + 5100 + attempt) * (size - 24));
      const ty = ly * size + 12 + Math.floor(hash(lx, ly, seed + 5200 + attempt) * (size - 24));
      if (Math.hypot(tx, ty) < POPULATION.lairMinDistance) continue;
      if (!this.tileFree(tx, ty, 3)) continue;
      const biome = this.source.biomeAt(tx, ty);
      const group = groupOf(biome);
      const boss = WARLORDS[group];
      if (!boss) continue;
      const level = this.source.levelAt(tx, ty) + 2;
      const members: CampMember[] = [{ type: boss, elite: false }];
      const entry = pickRosterEntry(group, level, hash(lx, ly, seed + 5300));
      const escorts = 4 + Math.floor(hash(lx, ly, seed + 5400) * 3);
      for (let k = 0; k < escorts; k++) members.push({ type: entry.type, elite: k === 0 });
      const cx = Math.floor(tx / CT), cy = Math.floor(ty / CT);
      return {
        id: `lair:${lx},${ly}`, cx, cy, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T,
        level, tier: tierOf(level), group, members, leash: 520, lair: true
      };
    }
    return null;
  }
}

export { zoneLevel, GROUP_LEVEL_OFFSET, BIOME };
