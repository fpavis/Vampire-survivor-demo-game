// Surface layer: lava, poison swamp, mud ... laid over the biome. Pure and seeded.
import { hash, fbm } from './noise';
import { BIOME, isSolidBiome, isWaterBiome } from './biomes';

export type SurfaceId = 'lava' | 'swamp' | 'mud' | 'ice' | 'quicksand' | 'tidal' | 'spring' | 'manawell' | 'glyph' | 'road';

export interface SurfaceDef {
  id: SurfaceId;
  name: string;
  color: number;
  glow?: number;           // light colour (also draws the glowing animated overlay)
  playerDps: number;       // damage per second to the player
  enemyDps: number;        // damage per second to non-immune ground enemies
  playerSpeed: number;     // movement multiplier
  enemySpeed: number;
  heal: number;            // player healing per second
  manaRegen: number;       // multiplier on mana regeneration
  haste: number;           // multiplier on spell cooldown recovery
  hazard: boolean;         // ground enemies path around it unless immune
  desc: string;
}

export const SURFACES: Record<SurfaceId, SurfaceDef> = {
  lava: { id: 'lava', name: 'Lava', color: 0xd8480f, glow: 0xff7a1a, playerDps: 14, enemyDps: 24, playerSpeed: 0.85, enemySpeed: 0.85, heal: 0, manaRegen: 1, haste: 1, hazard: true, desc: 'Burns anything that is not fireproof.' },
  swamp: { id: 'swamp', name: 'Poison swamp', color: 0x6a7a1c, glow: 0xb8ff4a, playerDps: 5, enemyDps: 8, playerSpeed: 0.7, enemySpeed: 0.7, heal: 0, manaRegen: 1, haste: 1, hazard: true, desc: 'Slows and poisons.' },
  mud: { id: 'mud', name: 'Mud', color: 0x6a4a2a, playerDps: 0, enemyDps: 0, playerSpeed: 0.7, enemySpeed: 0.7, heal: 0, manaRegen: 1, haste: 1, hazard: false, desc: 'Slows everything that walks through.' },
  ice: { id: 'ice', name: 'Ice', color: 0xa8d8f0, glow: 0xcff0ff, playerDps: 0, enemyDps: 0, playerSpeed: 1.18, enemySpeed: 1.18, heal: 0, manaRegen: 1, haste: 1, hazard: false, desc: 'Slippery: everyone moves faster.' },
  quicksand: { id: 'quicksand', name: 'Quicksand', color: 0xb89a58, playerDps: 2, enemyDps: 3, playerSpeed: 0.55, enemySpeed: 0.55, heal: 0, manaRegen: 1, haste: 1, hazard: true, desc: 'Drags you down.' },
  tidal: { id: 'tidal', name: 'Tidal pool', color: 0x6ab8c8, glow: 0x9ae8ff, playerDps: 0, enemyDps: 0, playerSpeed: 0.85, enemySpeed: 0.85, heal: 0, manaRegen: 1.4, haste: 1, hazard: false, desc: 'Shallow water that stirs mana.' },
  spring: { id: 'spring', name: 'Healing spring', color: 0x6ad8b0, glow: 0x9bffd0, playerDps: 0, enemyDps: 0, playerSpeed: 1, enemySpeed: 1, heal: 4, manaRegen: 1, haste: 1, hazard: false, desc: 'Slowly heals the active hero.' },
  manawell: { id: 'manawell', name: 'Mana well', color: 0x5a7ae8, glow: 0x8aa8ff, playerDps: 0, enemyDps: 0, playerSpeed: 1, enemySpeed: 1, heal: 0, manaRegen: 3.5, haste: 1, hazard: false, desc: 'Mana returns much faster.' },
  glyph: { id: 'glyph', name: 'Arcane glyph', color: 0xb06af0, glow: 0xd8a0ff, playerDps: 0, enemyDps: 0, playerSpeed: 1, enemySpeed: 1, heal: 0, manaRegen: 1, haste: 1.6, hazard: false, desc: 'Spells recharge faster.' },
  road: { id: 'road', name: 'Road', color: 0xa88a5c, playerDps: 0, enemyDps: 0, playerSpeed: 1.25, enemySpeed: 1, heal: 0, manaRegen: 1, haste: 1, hazard: false, desc: 'You travel faster on the road.' }
};

/** numeric ids stored in chunk grids (0 = none) */
export const SURFACE_IDS: SurfaceId[] = ['lava', 'swamp', 'mud', 'ice', 'quicksand', 'tidal', 'spring', 'manawell', 'glyph', 'road'];
export const SURFACE_NUM: Record<SurfaceId, number> = Object.fromEntries(SURFACE_IDS.map((s, i) => [s, i + 1])) as Record<SurfaceId, number>;
export const surfaceByNum = (n: number): SurfaceDef | null => (n > 0 ? SURFACES[SURFACE_IDS[n - 1]] : null);

/** What a tile of each surface costs a walking monster in the flow field (plain ground costs 1). */
export const NAV_COST: Partial<Record<SurfaceId, number>> = { lava: 8, quicksand: 6, swamp: 5, mud: 2 };
/** NAV_COST by the numeric id stored in chunk grids (index 0 = no surface). */
export const NAV_COST_BY_NUM: Uint8Array = Uint8Array.from([1, ...SURFACE_IDS.map((s) => NAV_COST[s] ?? 1)]);

/** Enemies that shrug off a surface (by enemy type key). Flying enemies ignore every surface. */
export const IMMUNITY: Record<string, SurfaceId[]> = {
  GOLEM: ['lava', 'quicksand'], STONE_TITAN: ['lava', 'quicksand', 'swamp'], TROLL: ['swamp', 'mud'],
  SPIDER: ['swamp'], SLIME: ['swamp', 'mud'], TREANT: ['swamp', 'mud'], ANCIENT_TREANT: ['swamp', 'mud'],
  SCORPION: ['quicksand', 'lava'], SCARAB: ['quicksand'], MUMMY: ['quicksand'], SAND_PHARAOH: ['quicksand', 'lava'],
  CRAB: ['tidal', 'mud'], CRAB_KING: ['tidal', 'mud', 'swamp'], BOAR: ['mud'], BOAR_KING: ['mud'], WOLF: ['ice'],
  SKELETON: ['swamp'], BAT: [], GHOST: ['lava', 'swamp', 'quicksand', 'mud', 'ice', 'tidal']
};

export const isImmune = (enemyType: string, flying: boolean, s: SurfaceId): boolean =>
  flying || (IMMUNITY[enemyType]?.includes(s) ?? false);

/** Effect multiplier strength grows with zone level: harsher damage far from the start. */
export const surfaceScale = (level: number) => 1 + Math.min(3, Math.max(0, level - 1) * 0.06);

const SPECIAL_CELL = 10;

/** Surface at a tile, or null. Depends only on seed, tile, biome and zone level. */
export function surfaceAt(seed: number, tx: number, ty: number, biome: number, level: number): SurfaceId | null {
  if (isSolidBiome(biome) || isWaterBiome(biome)) return null;
  if (biome === BIOME.CITY_FLOOR || biome === BIOME.RUIN_FLOOR || biome === BIOME.CAVE_FLOOR) return null;
  const d = Math.hypot(tx, ty);
  if (d < 26) return null;                                   // the start area stays friendly

  // small deterministic sites first: springs, wells, glyphs (rare, ~2 tile blobs)
  const cx = Math.floor(tx / SPECIAL_CELL), cy = Math.floor(ty / SPECIAL_CELL);
  const roll = hash(cx, cy, seed + 4100);
  if (roll < 0.06) {
    const sx = cx * SPECIAL_CELL + 2 + hash(cx, cy, seed + 4101) * (SPECIAL_CELL - 4);
    const sy = cy * SPECIAL_CELL + 2 + hash(cx, cy, seed + 4102) * (SPECIAL_CELL - 4);
    const r = 1.4 + hash(cx, cy, seed + 4103) * 0.8;
    if ((tx + 0.5 - sx) ** 2 + (ty + 0.5 - sy) ** 2 < r * r) {
      const k = hash(cx, cy, seed + 4104);
      return k < 0.45 ? 'spring' : k < 0.8 ? 'manawell' : 'glyph';
    }
  }

  const harsh = Math.min(0.1, Math.max(0, level - 1) * 0.004);   // bigger patches deeper in
  const n1 = fbm(tx * 0.09, ty * 0.09, seed + 4200, 3);
  const n2 = fbm(tx * 0.11 + 50, ty * 0.11 - 20, seed + 4210, 3);
  switch (biome) {
    case BIOME.FOREST:
      if (n1 > 0.7 - harsh) return 'swamp';
      if (n2 > 0.74 - harsh) return 'mud';
      return null;
    case BIOME.GRASS:
      return n2 > 0.76 - harsh ? 'mud' : null;
    case BIOME.DRY:
      return n1 > 0.7 - harsh ? 'quicksand' : null;
    case BIOME.SAND:
      return n1 > 0.72 - harsh ? 'tidal' : null;
    case BIOME.HILL:
      if (level >= 6 && n1 > 0.7 - harsh * 1.5) return 'lava';
      if (n2 > 0.66 - harsh) return 'ice';
      return null;
    default:
      return null;
  }
}

/** Per-frame effect numbers for something standing on a surface. */
export interface SurfaceEffect { dps: number; speed: number; heal: number; manaRegen: number; haste: number }
export const NO_EFFECT: SurfaceEffect = { dps: 0, speed: 1, heal: 0, manaRegen: 1, haste: 1 };

export function playerEffect(s: SurfaceId | null, level: number): SurfaceEffect {
  if (!s) return NO_EFFECT;
  const d = SURFACES[s];
  return { dps: d.playerDps * surfaceScale(level), speed: d.playerSpeed, heal: d.heal, manaRegen: d.manaRegen, haste: d.haste };
}

export function enemyEffect(s: SurfaceId | null, enemyType: string, flying: boolean, level: number): SurfaceEffect {
  if (!s || isImmune(enemyType, flying, s)) return NO_EFFECT;
  const d = SURFACES[s];
  return { dps: d.enemyDps * surfaceScale(level), speed: d.enemySpeed, heal: 0, manaRegen: 1, haste: 1 };
}
