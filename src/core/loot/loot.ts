// Kill loot: independent rolls per kill (decided rates). Pure and testable.
import { RARITY_NAMES, RUNES, TEMPLATES, type SpellItem } from '../spells/spells';

export type ResourceId = 'wood' | 'stone' | 'iron';
export interface Wallet { gold: number; wood: number; stone: number; iron: number }
export const emptyWallet = (): Wallet => ({ gold: 0, wood: 0, stone: 0, iron: 0 });

export const DROP_RATES = { gold: 0.10, resource: 0.01, skill: 0.001 } as const;

export interface KillInfo { level: number; elite?: boolean; boss?: boolean; group?: string; luck?: number }   // luck: the Fortune card, x find chance
export interface KillLoot {
  xp: true;                                   // always
  gold: number;                               // 0 when the roll failed
  resource: { id: ResourceId; amount: number } | null;
  skill: boolean;                             // caller then rolls what kind (rollSkillDrop)
  power: number;                              // 0..3 rarity bias for the skill roll
}

/** Which resource a region yields (iron appears deeper in the world). */
export function resourceFor(group: string | undefined, level: number, rand: () => number): ResourceId {
  switch (group) {
    case 'mountain': return rand() < Math.min(0.6, 0.25 + level * 0.01) ? 'iron' : 'stone';
    case 'cave': case 'ruins': return rand() < 0.35 ? 'iron' : 'stone';
    case 'desert': return rand() < 0.7 ? 'stone' : 'wood';
    default: return rand() < 0.85 ? 'wood' : 'stone';
  }
}

export function goldAmount(level: number, mult: number, rand: () => number): number {
  const base = 2 + level * 1.4;
  return Math.max(1, Math.round(base * mult * (0.75 + rand() * 0.5)));
}

export function rollKillLoot(rand: () => number, k: KillInfo): KillLoot {
  const strength = Math.min(3, k.level / 25);
  const mult = k.boss ? 12 : k.elite ? 3 : 1;
  const luck = k.luck ?? 1;
  const gold = k.boss || rand() < DROP_RATES.gold * luck * (k.elite ? 2.5 : 1 + strength * 0.4) ? goldAmount(k.level, mult, rand) : 0;
  const rChance = DROP_RATES.resource * luck * (k.elite ? 4 : 1 + strength * 0.5);
  const resource = k.boss || rand() < rChance
    ? { id: resourceFor(k.group, k.level, rand), amount: Math.max(1, Math.round((1 + k.level / 12) * (k.boss ? 5 : k.elite ? 2 : 1))) }
    : null;
  let sChance = DROP_RATES.skill * luck * (1 + strength * 1.5);
  if (k.elite) sChance *= 8;
  if (k.boss) sChance = 1;
  return { xp: true, gold, resource, skill: rand() < sChance, power: k.boss ? 3 : Math.min(3, strength + (k.elite ? 1 : 0)) };
}

// ---------------------------------------------------------------- dungeon loot
/** Schools of magic each region's (or realm's) dungeons favour in their chests. */
export const LOOT_AFFINITY: Record<string, string[]> = {
  field: ['arcane', 'life'], forest: ['life', 'force'], desert: ['fire', 'arcane'], shore: ['frost', 'lightning'],
  mountain: ['force', 'frost'], plateau: ['lightning', 'arcane'], sea: ['frost', 'lightning']
};
/** The affinity of a dungeon: its realm when that is special (plateau, sea), otherwise its region. */
export const dungeonAffinity = (group: string, realm?: string): string[] =>
  (realm && realm !== 'land' && LOOT_AFFINITY[realm]) || LOOT_AFFINITY[group] || [];
/** Extra rarity for chests deeper down: half a step per floor. */
export const dungeonPower = (floor: number): number => Math.max(0, floor) * 0.5;

// ---------------------------------------------------------------- salvage
export function runeValue(id: string): number { return 6 * Math.pow(2.2, RUNES[id].rarity); }
export function spellValue(s: SpellItem): number {
  const t = TEMPLATES[s.tpl];
  return Math.round(25 * s.level + s.runes.filter(Boolean).length * 10 + (t.mode === 'active' ? 10 : 0));
}

export type LootFilter = 'off' | 'basic' | 'advanced';
/** Runes at or below the filter rarity convert to gold the moment they drop. */
export function filteredOut(runeId: string, f: LootFilter): boolean {
  if (f === 'off') return false;
  return RUNES[runeId].rarity <= (f === 'basic' ? 1 : 2);
}

export { RARITY_NAMES };
