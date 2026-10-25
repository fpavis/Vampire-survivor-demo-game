// Dungeons: caves and ruins that run several floors deep, end in a boss and a guaranteed chest. Land dungeons are a
// seeded share of the ordinary places; plateau dungeons hide on the plateau a climbing tower opens; sea dungeons
// sit on remote islands only a boat reaches. Pure and deterministic, like the rest of the world.
import { WORLD_CONFIG } from '../config';
import { GROUP, WARLORDS } from './biomes';
import { hash } from './noise';
import { CACHE_CELL, cacheForCell, plateauCentre, type TowerRec } from './towers';
import type { Poi, PoiType } from '../types';

const T = WORLD_CONFIG.tile;

export type DungeonRealm = 'land' | 'plateau' | 'sea';

export interface DungeonInfo {
  realm: DungeonRealm;
  floors: number;           // 2..5
  boss: string;             // enemy key of the boss on the last floor
}

export const DUNGEON_SHARE = 0.5;                 // of caves and ruins on land
export const FLOOR_LEVEL_STEP = 2;                // every floor down is this many levels harder
export const BOSS_LEVEL_BONUS = 1;
export const PLATEAU_FLOORS = 3;
export const SEA_FLOORS = 3;
export const SEA_DUNGEON_SHARE = 0.4;             // of island treasure spots hold a shrine instead

export const floorLevel = (base: number, floor: number): number => Math.max(1, Math.round(base + floor * FLOOR_LEVEL_STEP));
export const bossLevel = (base: number, floors: number): number => floorLevel(base, floors - 1) + BOSS_LEVEL_BONUS;
/** Loot tier of the chest the boss leaves behind (see grantLoot): deeper dungeons pay better. */
export const bossChestTier = (floors: number): number => (floors >= 4 ? 3 : 2);

const NAME_A = ['Black', 'Ashen', 'Crimson', 'Hollow', 'Wailing', 'Gilded', 'Dread', 'Ivory'];
const NAME_B: Record<string, string[]> = {
  cave: ['Depths', 'Warrens', 'Abyss', 'Maw', 'Gullet'],
  ruins: ['Citadel', 'Sanctum', 'Bastion', 'Catacombs', 'Keep']
};

export function dungeonName(seed: number, cx: number, cy: number, type: PoiType): string {
  const b = NAME_B[type] ?? NAME_B.ruins;
  return `${NAME_A[Math.floor(hash(cx, cy, seed + 710) * NAME_A.length)]} ${b[Math.floor(hash(cx, cy, seed + 720) * b.length)]}`;
}

/** Is this cave or ruin a dungeon, and how deep? `level` is the zone level at the entrance. */
export function dungeonForLand(seed: number, cx: number, cy: number, type: PoiType, group: string, level: number): DungeonInfo | null {
  if (type === 'city') return null;
  if (hash(cx, cy, seed + 700) >= DUNGEON_SHARE) return null;
  const floors = Math.max(2, Math.min(5, 2 + Math.floor(level / 30) + (hash(cx, cy, seed + 730) < 0.35 ? 1 : 0)));
  return { realm: 'land', floors, boss: WARLORDS[group] ?? WARLORDS.field };
}

// --------------------------------------------------------------- plateau
/** The "Skyvault" on the plateau a built climbing tower opens (the ore that used to sit at its heart makes room). */
export function plateauPoi(rec: Pick<TowerRec, 'id' | 'tx' | 'ty' | 'dir' | 'len' | 'kind'>, seed: number): Poi | null {
  const c = plateauCentre(rec as TowerRec);
  if (!c) return null;
  const x = (c.tx + 0.5) * T, y = (c.ty + 0.5) * T;
  return {
    id: `plat:${rec.id}`, type: 'ruins', group: GROUP.MOUNTAIN, tx: c.tx, ty: c.ty, x, y, ex: x, ey: y + 48,
    seed: Math.floor(hash(c.tx, c.ty, seed + 740) * 1e9),
    name: `Skyvault ${dungeonName(seed, c.tx, c.ty, 'ruins').split(' ')[1]}`,
    dungeon: { realm: 'plateau', floors: PLATEAU_FLOORS, boss: WARLORDS.mountain }
  };
}

// -------------------------------------------------------------------- sea
/** A drowned shrine in place of an island's buried treasure (same cell grid as the caches). */
export function isSeaDungeonCell(seed: number, cx: number, cy: number): boolean {
  return hash(cx, cy, seed + 7100) < SEA_DUNGEON_SHARE;
}

export function seaDungeonPoi(seed: number, cx: number, cy: number, biomeAt: (x: number, y: number) => number): Poi | null {
  if (!isSeaDungeonCell(seed, cx, cy)) return null;
  const c = cacheForCell(seed, cx, cy, biomeAt);
  if (!c) return null;
  const x = (c.tx + 0.5) * T, y = (c.ty + 0.5) * T;
  return {
    id: `sea:${cx},${cy}`, type: 'ruins', group: GROUP.SHORE, tx: c.tx, ty: c.ty, x, y, ex: x, ey: y + 48,
    seed: Math.floor(hash(cx, cy, seed + 750) * 1e9),
    name: `Drowned ${dungeonName(seed, cx, cy, 'ruins').split(' ')[1]}`,
    dungeon: { realm: 'sea', floors: SEA_FLOORS, boss: WARLORDS.shore }
  };
}

export { CACHE_CELL };

/** Cave or ruins layout for a floor: land dungeons follow their entrance, the others are always ruins. */
export const floorSeed = (poiSeed: number, floor: number): number => (floor === 0 ? poiSeed : (poiSeed + floor * 7919) >>> 0);
