// Experience relative to the hero's level (Phase 11). A monster gives its full XP to a hero up to a couple of
// levels above it, a little more to a hero below it (catching up), and less and less to a hero far above it. So a
// party that stays in one land settles a few levels over it instead of running away (the playtest that prompted
// this reached hero level 97 in level 29 lands), and resting heroes stay near the land too.
import { xpForLevel } from '../config';
import { enemyXpScale } from '../world/difficulty';

export const XP_LEVEL = {
  catchUp: 0.04,       // extra XP per level the hero is below the source
  catchUpMax: 1.5,     // at most this multiple
  free: 2,             // full XP up to this many levels above the source
  decay: 0.6,          // then this factor per further level
  floor: 0.01          // never quite nothing
} as const;

/** Multiplier on XP from a source of `sourceLevel` for a hero of `heroLevel` (no source level: 1). */
export function xpLevelFactor(heroLevel: number, sourceLevel?: number | null): number {
  if (sourceLevel === undefined || sourceLevel === null || !Number.isFinite(sourceLevel)) return 1;
  const d = heroLevel - sourceLevel;
  if (d < 0) return Math.min(XP_LEVEL.catchUpMax, 1 + XP_LEVEL.catchUp * -d);
  if (d <= XP_LEVEL.free) return 1;
  return Math.max(XP_LEVEL.floor, Math.pow(XP_LEVEL.decay, d - XP_LEVEL.free));
}

export interface LevelSim {
  kills: number;
  zone: number | ((kill: number) => number);   // the level of the land at each kill
  baseXp?: number;                              // a typical monster's own XP (before level scaling)
  growth?: number;                              // the hero's XP gain multiplier
  share?: number;                               // a resting hero's share (1 for the active hero)
  relative?: boolean;                           // false: the old rule, XP ignores the hero's level
}

/** Where a hero ends up after `kills` kills (a balancing aid for the tests and docs/BALANCE.md). */
export function simulateLevel(o: LevelSim): number {
  const base = o.baseXp ?? 15, growth = o.growth ?? 1, share = o.share ?? 1;
  let level = 1, xp = 0;
  for (let k = 0; k < o.kills; k++) {
    const z = typeof o.zone === 'function' ? o.zone(k) : o.zone;
    const f = o.relative === false ? 1 : xpLevelFactor(level, z);
    xp += base * enemyXpScale(z) * growth * share * f;
    while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; }
  }
  return level;
}
