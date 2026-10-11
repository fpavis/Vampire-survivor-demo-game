import { fbm } from './noise';

// Enemy level is a pure function of position (distance from the start, plus gentle regional variation).
// It never depends on the player. See docs/IMPLEMENTATION_PLAN.md section 4.2.
export const DIFFICULTY = {
  safeRadius: 80,     // tiles around the start where everything is level 1
  scale: 0.0301,      // level gained per tile^power
  power: 0.85,        // slow incline
  regionAmp: 3,       // +/- levels of regional variation (fades in with distance)
  tierSize: 12        // levels per biome tier
} as const;

// Per-region flavour (added to the level): fields are gentlest, mountains harshest.
export const GROUP_LEVEL_OFFSET: Record<string, number> = {
  field: -1, shore: 0, forest: 0.5, desert: 1, mountain: 2
};

export const tileDistance = (tx: number, ty: number): number => Math.hypot(tx, ty);

export function baseLevel(distanceTiles: number): number {
  const d = Math.max(0, distanceTiles - DIFFICULTY.safeRadius);
  return 1 + DIFFICULTY.scale * Math.pow(d, DIFFICULTY.power);
}

/** Integer zone level at a tile. `groupOffset` comes from the biome group (see GROUP_LEVEL_OFFSET). */
export function zoneLevel(seed: number, tx: number, ty: number, groupOffset = 0): number {
  const d = tileDistance(tx, ty);
  const fade = Math.min(1, Math.max(0, (d - DIFFICULTY.safeRadius) / 200));
  const region = (fbm(tx * 0.012, ty * 0.012, seed + 777, 3) - 0.5) * 2 * DIFFICULTY.regionAmp * fade;
  const biome = groupOffset * fade;
  return Math.max(1, Math.round(baseLevel(d) + region + biome));
}

export const tierOf = (level: number): number => Math.max(0, Math.floor((level - 1) / DIFFICULTY.tierSize));

export const TIER_NAMES = ['', 'Blighted', 'Ashen', 'Abyssal', 'Doomed', 'Cataclysmic'];
export const tierName = (tier: number): string => TIER_NAMES[Math.min(tier, TIER_NAMES.length - 1)] ?? '';

// Enemy stat scaling by level (level 1 = 1.0).
export const enemyHealthScale = (level: number): number => 1 + 0.18 * (level - 1) + 0.004 * (level - 1) ** 2;
export const enemyDamageScale = (level: number): number => 1 + 0.08 * (level - 1) + 0.001 * (level - 1) ** 2;
export const enemyXpScale = (level: number): number => 1 + 0.12 * (level - 1);
export const enemySpeedScale = (level: number): number => Math.min(1.5, 1 + 0.006 * (level - 1));

/** How threatening a monster is to a hero: used for colour hints on the HUD. */
export function threatBand(enemyLevel: number, heroLevel: number): 'low' | 'even' | 'high' | 'deadly' {
  const diff = enemyLevel - heroLevel;
  if (diff <= -5) return 'low';
  if (diff <= 3) return 'even';
  if (diff <= 9) return 'high';
  return 'deadly';
}
