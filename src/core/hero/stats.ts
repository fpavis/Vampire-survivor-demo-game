// Hero stats and level-up cards. Cards only improve the hero (never spells); they form specialisation paths.

export type PathId = 'arcane' | 'vigor' | 'mobility' | 'mana';

export interface StatCard {
  id: string;
  name: string;
  icon: string;
  path: PathId;
  max: number;
  label: string;
  desc: string;
  value: (lv: number) => number;
  fmt: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const PATHS: Record<PathId, { name: string; icon: string; color: number }> = {
  arcane: { name: 'Arcane', icon: '🔮', color: 0xc08bff },
  vigor: { name: 'Vigor', icon: '❤️', color: 0xff7a7a },
  mobility: { name: 'Wayfarer', icon: '👟', color: 0x7be0d0 },
  mana: { name: 'Spirit', icon: '💧', color: 0x6ab8ff }
};

export const CARDS: Record<string, StatCard> = {
  might: { id: 'might', name: 'Might', icon: '💪', path: 'arcane', max: 5, label: 'Spell damage', desc: 'All spell damage is increased.', value: (l) => 0.15 * l, fmt: (v) => `+${pct(v)}` },
  haste: { id: 'haste', name: 'Cast Speed', icon: '⏱️', path: 'arcane', max: 5, label: 'Cooldowns', desc: 'Spells recharge faster.', value: (l) => 1 - Math.pow(0.92, l), fmt: (v) => `-${pct(v)}` },
  crit: { id: 'crit', name: 'Precision', icon: '🎯', path: 'arcane', max: 5, label: 'Crit chance', desc: 'Hits can deal double damage.', value: (l) => 0.06 * l, fmt: (v) => `+${pct(v)}` },
  vitality: { id: 'vitality', name: 'Vitality', icon: '❤️', path: 'vigor', max: 5, label: 'Max health', desc: 'More health, and heals when taken.', value: (l) => 25 * l, fmt: (v) => `+${v}` },
  recovery: { id: 'recovery', name: 'Recovery', icon: '💖', path: 'vigor', max: 5, label: 'Regeneration', desc: 'Slowly heal over time.', value: (l) => 0.6 * l, fmt: (v) => `+${v.toFixed(1)}/s` },
  armor: { id: 'armor', name: 'Armor', icon: '🛡️', path: 'vigor', max: 5, label: 'Damage taken', desc: 'Reduces all incoming damage.', value: (l) => 0.06 * l, fmt: (v) => `-${pct(v)}` },
  swift: { id: 'swift', name: 'Swiftness', icon: '👟', path: 'mobility', max: 5, label: 'Move speed', desc: 'Run faster.', value: (l) => 0.08 * l, fmt: (v) => `+${pct(v)}` },
  magnet: { id: 'magnet', name: 'Magnet', icon: '🧲', path: 'mobility', max: 5, label: 'Pickup range', desc: 'Gems fly to you from further away.', value: (l) => 0.35 * l, fmt: (v) => `+${pct(v)}` },
  growth: { id: 'growth', name: 'Wisdom', icon: '📘', path: 'mobility', max: 5, label: 'XP gain', desc: 'Gain experience faster.', value: (l) => 0.12 * l, fmt: (v) => `+${pct(v)}` },
  reservoir: { id: 'reservoir', name: 'Reservoir', icon: '🔷', path: 'mana', max: 5, label: 'Max mana', desc: 'A deeper pool of mana for dashes, blinks and wards.', value: (l) => 20 * l, fmt: (v) => `+${v}` },
  wellspring: { id: 'wellspring', name: 'Wellspring', icon: '🌊', path: 'mana', max: 5, label: 'Mana regen', desc: 'Mana returns faster.', value: (l) => 2.5 * l, fmt: (v) => `+${v.toFixed(1)}/s` },
  thrift: { id: 'thrift', name: 'Thrift', icon: '🪙', path: 'mana', max: 4, label: 'Mana cost', desc: 'Active skills cost less mana.', value: (l) => 0.08 * l, fmt: (v) => `-${pct(v)}` }
};

export type Picks = Record<string, number>;

export interface HeroStats {
  might: number; cooldown: number; speed: number; maxHealth: number; regen: number;
  magnet: number; armor: number; growth: number; crit: number;
  maxMana: number; manaRegen: number; manaCost: number;
}

export const BASE_HEALTH = 100;
export const BASE_MANA = 60;
export const BASE_MANA_REGEN = 7;

export function computeStats(picks: Picks): HeroStats {
  const lv = (id: string) => picks[id] || 0;
  const v = (id: string) => CARDS[id].value(lv(id));
  return {
    might: 1 + v('might'),
    cooldown: 1 - v('haste'),
    speed: 1 + v('swift'),
    maxHealth: BASE_HEALTH + v('vitality'),
    regen: v('recovery'),
    magnet: 1 + v('magnet'),
    armor: Math.min(0.6, v('armor')),
    growth: 1 + v('growth'),
    crit: 0.05 + v('crit'),
    maxMana: BASE_MANA + v('reservoir'),
    manaRegen: BASE_MANA_REGEN + v('wellspring'),
    manaCost: 1 - v('thrift')
  };
}

export interface OfferedCard {
  id: string;
  toLevel: number;
  isNew: boolean;
  rarity: number;
  lines: string[];
}

const RARITY_BY_LEVEL = [0, 0, 1, 2, 3];

/** Which path the hero leans on most (needs at least 2 picks in it). */
export function dominantPath(picks: Picks): PathId | null {
  const totals: Partial<Record<PathId, number>> = {};
  for (const [id, n] of Object.entries(picks)) {
    const c = CARDS[id];
    if (c) totals[c.path] = (totals[c.path] || 0) + n;
  }
  let best: PathId | null = null, bn = 1;
  for (const [p, n] of Object.entries(totals) as [PathId, number][]) if (n > bn) { best = p; bn = n; }
  return best;
}

/** Three distinct cards; cards of a path you already invested in appear more often (specialisation). */
export function offerCards(picks: Picks, rand: () => number, count = 3): OfferedCard[] {
  const dom = dominantPath(picks);
  const pool: { w: number; card: OfferedCard }[] = [];
  for (const c of Object.values(CARDS)) {
    const cur = picks[c.id] || 0;
    if (cur >= c.max) continue;
    let w = cur === 0 ? 1 : 1.4;
    if (dom && c.path === dom) w *= 1.8;
    pool.push({
      w,
      card: {
        id: c.id, toLevel: cur + 1, isNew: cur === 0, rarity: RARITY_BY_LEVEL[cur] ?? 3,
        lines: cur === 0 ? [c.desc, `${c.label}: ${c.fmt(c.value(1))}`] : [`${c.label}: ${c.fmt(c.value(cur))} → ${c.fmt(c.value(cur + 1))}`]
      }
    });
  }
  const out: OfferedCard[] = [];
  while (out.length < count && pool.length) {
    let roll = rand() * pool.reduce((s, p) => s + p.w, 0);
    let i = 0;
    for (; i < pool.length - 1; i++) { roll -= pool[i].w; if (roll <= 0) break; }
    out.push(pool.splice(i, 1)[0].card);
  }
  return out;
}

export interface ManaState { value: number }
/** Mana as stamina: only active skills spend it. Returns false when there is not enough. */
export function spendMana(m: ManaState, cost: number): boolean {
  if (m.value < cost) return false;
  m.value -= cost;
  return true;
}
export function regenMana(m: ManaState, stats: HeroStats, deltaFrames: number, regenBlocked = false) {
  if (regenBlocked) return;
  m.value = Math.min(stats.maxMana, m.value + (stats.manaRegen / 60) * deltaFrames);
}
