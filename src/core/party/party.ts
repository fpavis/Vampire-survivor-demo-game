// Party rules (pure). A party is always three heroes, with no classes: a hero is whatever its cards and loadout make it.
import { CARDS, computeStats, type HeroStats, type Picks } from '../hero/stats';
import { xpForLevel } from '../config';

export const PARTY_SIZE = 3;
export const SWITCH_COOLDOWN_FRAMES = 150;      // 2.5 s
export const BENCH_XP_SHARE = 0.5;
export const BENCH_REGEN = { health: 0.012, mana: 0.5 };   // fraction of max health per second / mana multiplier of base regen
export const AURA_STRENGTH = 0.5;
export const RESPAWN_HEALTH = 0.4;

export interface HeroDef { id: string; name: string; icon: string; color: number; tint: number; starter: { auto: string[]; active: string[] } }

export const HERO_DEFS: HeroDef[] = [
  { id: 'aria', name: 'Aria', icon: '🔮', color: 0x6aa8ff, tint: 0xffffff, starter: { auto: ['bolt'], active: ['dash'] } },
  { id: 'brann', name: 'Brann', icon: '🔥', color: 0xff8a5a, tint: 0xffa890, starter: { auto: ['orbit'], active: ['barrier'] } },
  { id: 'cyra', name: 'Cyra', icon: '🌿', color: 0x7be07b, tint: 0xa6ffb4, starter: { auto: ['nova'], active: ['blink'] } }
];

export interface HeroState {
  id: string;
  level: number;
  experience: number;
  nextLevel: number;
  health: number;
  mana: number;
  pending: number;
  picks: Picks;
  auto: string[];                 // spell uids
  active: (string | null)[];
  dead: boolean;
}

export function newHero(def: HeroDef, auto: string[], active: (string | null)[]): HeroState {
  const st = computeStats({});
  return { id: def.id, level: 1, experience: 0, nextLevel: xpForLevel(1), health: st.maxHealth, mana: st.maxMana, pending: 0, picks: {}, auto, active, dead: false };
}

export const defOf = (id: string): HeroDef => HERO_DEFS.find((d) => d.id === id) ?? HERO_DEFS[0];

/** Fraction of a bench hero's own bonuses that is shared with the active hero. */
export interface Aura { might: number; speed: number; regen: number; armor: number; manaRegen: number; cooldown: number; magnet: number; growth: number }

export function auraOf(s: HeroStats): Aura {
  const k = AURA_STRENGTH;
  return {
    might: (s.might - 1) * k, speed: (s.speed - 1) * k, regen: s.regen * k, armor: s.armor * k,
    manaRegen: (s.manaRegen - computeStats({}).manaRegen) * k, cooldown: (1 - s.cooldown) * k,
    magnet: (s.magnet - 1) * k, growth: (s.growth - 1) * k
  };
}

/** The active hero's stats plus the auras of living bench heroes. Max health and mana never come from auras. */
export function partyStats(heroes: HeroState[], active: number): HeroStats {
  const base = computeStats(heroes[active].picks);
  const out = { ...base };
  heroes.forEach((h, i) => {
    if (i === active || h.dead) return;
    const a = auraOf(computeStats(h.picks));
    out.might += a.might; out.speed += a.speed; out.regen += a.regen; out.armor = Math.min(0.6, out.armor + a.armor);
    out.manaRegen += a.manaRegen; out.cooldown = Math.max(0.4, out.cooldown - a.cooldown);
    out.magnet += a.magnet; out.growth += a.growth;
  });
  return out;
}

export function nextAlive(heroes: HeroState[], from: number): number {
  for (let k = 1; k <= heroes.length; k++) {
    const i = (from + k) % heroes.length;
    if (!heroes[i].dead) return i;
  }
  return -1;
}

export const partyWiped = (heroes: HeroState[]) => heroes.every((h) => h.dead);

// ---------------------------------------------------------------- healer
export const reviveCost = (level: number) => 40 + 20 * level;
export const healCost = (missing: number, level: number) => Math.ceil(missing * (0.3 + level * 0.02));

export interface HealQuote { id: string; dead: boolean; missing: number; cost: number }
export function healerQuote(h: HeroState): HealQuote {
  const max = computeStats(h.picks).maxHealth;
  if (h.dead) return { id: h.id, dead: true, missing: max, cost: reviveCost(h.level) };
  const missing = Math.max(0, Math.ceil(max - h.health));
  return { id: h.id, dead: false, missing, cost: missing > 0 ? healCost(missing, h.level) : 0 };
}

/** Pays for and applies the service. Returns gold spent, or -1 when the wallet cannot cover it. */
export function applyHealer(h: HeroState, gold: number): number {
  const q = healerQuote(h);
  if (q.cost === 0) return 0;
  if (gold < q.cost) return -1;
  const st = computeStats(h.picks);
  h.dead = false; h.health = st.maxHealth; h.mana = st.maxMana;
  return q.cost;
}

/** Everyone is up after a wipe, at a fraction of their health. */
export function reviveAfterWipe(heroes: HeroState[]) {
  for (const h of heroes) { h.dead = false; h.health = Math.max(1, Math.round(computeStats(h.picks).maxHealth * RESPAWN_HEALTH)); }
}

export function benchTick(h: HeroState, deltaFrames: number) {
  if (h.dead) return;
  const st = computeStats(h.picks);
  h.health = Math.min(st.maxHealth, h.health + st.maxHealth * BENCH_REGEN.health * (deltaFrames / 60));
  h.mana = Math.min(st.maxMana, h.mana + st.manaRegen * BENCH_REGEN.mana * (deltaFrames / 60) * 2);
}

/** XP for a bench hero (no card/level side effects; caller levels them). */
export function benchXp(h: HeroState, value: number): number {
  return value * BENCH_XP_SHARE * computeStats(h.picks).growth;
}

/** Processes level-ups for any hero. Returns levels gained. */
export function levelHero(h: HeroState): number {
  let n = 0;
  while (h.experience >= h.nextLevel) { h.experience -= h.nextLevel; h.level++; h.nextLevel = xpForLevel(h.level); h.pending++; n++; }
  return n;
}

export const cardLevels = (h: HeroState) => Object.entries(h.picks).filter(([id]) => CARDS[id]).reduce((a, [, n]) => a + n, 0);
