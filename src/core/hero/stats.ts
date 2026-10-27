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
  mastery?: boolean;     // endless: offered only when every ordinary card is complete
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const PATHS: Record<PathId, { name: string; icon: string; color: number }> = {
  arcane: { name: 'Arcane', icon: 'path-arcane', color: 0xc08bff },
  vigor: { name: 'Vigor', icon: 'path-vigor', color: 0xff7a7a },
  mobility: { name: 'Wayfarer', icon: 'path-wayfarer', color: 0x7be0d0 },
  mana: { name: 'Spirit', icon: 'path-spirit', color: 0x6ab8ff }
};

// Ten ranks a card in small steps (Phase 11: the old five big ones were used up by level 60 and each felt too
// strong). Sixteen cards hold 160 ranks, so a level up to 99 always has something to pick; past that, mastery.
export const CARDS: Record<string, StatCard> = {
  might: { id: 'might', name: 'Might', icon: 'card-might', path: 'arcane', max: 10, label: 'Spell damage', desc: 'All spell damage is increased.', value: (l) => 0.08 * l, fmt: (v) => `+${pct(v)}` },
  haste: { id: 'haste', name: 'Cast Speed', icon: 'card-haste', path: 'arcane', max: 10, label: 'Cooldowns', desc: 'Spells recharge faster.', value: (l) => 1 - Math.pow(0.96, l), fmt: (v) => `-${pct(v)}` },
  crit: { id: 'crit', name: 'Precision', icon: 'card-crit', path: 'arcane', max: 10, label: 'Crit chance', desc: 'Hits can deal double damage.', value: (l) => 0.03 * l, fmt: (v) => `+${pct(v)}` },
  reach: { id: 'reach', name: 'Reach', icon: 'card-reach', path: 'arcane', max: 10, label: 'Spell area', desc: 'Novas, meteors, clouds, trails and blades cover more ground.', value: (l) => 0.05 * l, fmt: (v) => `+${pct(v)}` },
  vitality: { id: 'vitality', name: 'Vitality', icon: 'card-vitality', path: 'vigor', max: 10, label: 'Max health', desc: 'More health, and heals when taken.', value: (l) => 12 * l, fmt: (v) => `+${v}` },
  recovery: { id: 'recovery', name: 'Recovery', icon: 'card-recovery', path: 'vigor', max: 10, label: 'Regeneration', desc: 'Slowly heal over time.', value: (l) => 0.3 * l, fmt: (v) => `+${v.toFixed(1)}/s` },
  armor: { id: 'armor', name: 'Armor', icon: 'card-armor', path: 'vigor', max: 10, label: 'Damage taken', desc: 'Reduces all incoming damage.', value: (l) => 0.03 * l, fmt: (v) => `-${pct(v)}` },
  swift: { id: 'swift', name: 'Swiftness', icon: 'card-swift', path: 'mobility', max: 10, label: 'Move speed', desc: 'Run faster.', value: (l) => 0.04 * l, fmt: (v) => `+${pct(v)}` },
  magnet: { id: 'magnet', name: 'Magnet', icon: 'card-magnet', path: 'mobility', max: 10, label: 'Pickup range', desc: 'Gems fly to you from further away.', value: (l) => 0.18 * l, fmt: (v) => `+${pct(v)}` },
  growth: { id: 'growth', name: 'Wisdom', icon: 'card-growth', path: 'mobility', max: 10, label: 'XP gain', desc: 'Gain experience faster.', value: (l) => 0.06 * l, fmt: (v) => `+${pct(v)}` },
  fortune: { id: 'fortune', name: 'Fortune', icon: 'card-fortune', path: 'mobility', max: 10, label: 'Find chance', desc: 'Monsters drop gold, materials, spells and runes more often.', value: (l) => 0.06 * l, fmt: (v) => `+${pct(v)}` },
  greed: { id: 'greed', name: 'Greed', icon: 'card-greed', path: 'mobility', max: 10, label: 'Gold found', desc: 'Every coin picked up is worth more.', value: (l) => 0.08 * l, fmt: (v) => `+${pct(v)}` },
  reservoir: { id: 'reservoir', name: 'Reservoir', icon: 'card-reservoir', path: 'mana', max: 10, label: 'Max mana', desc: 'A deeper pool of mana for dashes, blinks and wards.', value: (l) => 10 * l, fmt: (v) => `+${v}` },
  wellspring: { id: 'wellspring', name: 'Wellspring', icon: 'card-wellspring', path: 'mana', max: 10, label: 'Mana regen', desc: 'Mana returns faster.', value: (l) => 1.25 * l, fmt: (v) => `+${v.toFixed(2)}/s` },
  thrift: { id: 'thrift', name: 'Thrift', icon: 'card-thrift', path: 'mana', max: 10, label: 'Mana cost', desc: 'Active skills cost less mana.', value: (l) => 0.03 * l, fmt: (v) => `-${pct(v)}` },
  persistence: { id: 'persistence', name: 'Persistence', icon: 'card-persistence', path: 'mana', max: 10, label: 'Effect duration', desc: 'Burns, slows, trails, clouds and wards last longer.', value: (l) => 0.06 * l, fmt: (v) => `+${pct(v)}` },
  // mastery: offered only once every card above is complete; no limit, small steps, so no level is ever wasted
  'mastery-might': { id: 'mastery-might', name: 'Mastery: Might', icon: 'card-might', path: 'arcane', max: Infinity, mastery: true, label: 'Spell damage', desc: 'A little more damage, without end.', value: (l) => 0.02 * l, fmt: (v) => `+${pct(v)}` },
  'mastery-vitality': { id: 'mastery-vitality', name: 'Mastery: Vitality', icon: 'card-vitality', path: 'vigor', max: Infinity, mastery: true, label: 'Max health', desc: 'A little more health, without end.', value: (l) => 8 * l, fmt: (v) => `+${v}` },
  'mastery-haste': { id: 'mastery-haste', name: 'Mastery: Haste', icon: 'card-haste', path: 'arcane', max: Infinity, mastery: true, label: 'Cooldowns', desc: 'Spells recharge a little faster, without end.', value: (l) => 1 - Math.pow(0.98, l), fmt: (v) => `-${pct(v)}` },
  'mastery-greed': { id: 'mastery-greed', name: 'Mastery: Greed', icon: 'card-greed', path: 'mobility', max: Infinity, mastery: true, label: 'Gold found', desc: 'Coins are worth a little more, without end.', value: (l) => 0.03 * l, fmt: (v) => `+${pct(v)}` }
};

/** The ordinary cards (not the mastery ones), in their display order. */
export const CARD_IDS = Object.keys(CARDS).filter((id) => !CARDS[id].mastery);
export const MASTERY_IDS = Object.keys(CARDS).filter((id) => CARDS[id].mastery);
/** Ranks needed to complete every ordinary card. */
export const TOTAL_RANKS = CARD_IDS.reduce((n, id) => n + CARDS[id].max, 0);

export type Picks = Record<string, number>;

export interface HeroStats {
  might: number; cooldown: number; speed: number; maxHealth: number; regen: number;
  magnet: number; armor: number; growth: number; crit: number;
  maxMana: number; manaRegen: number; manaCost: number;
  area: number; duration: number; luck: number; gold: number;
}

export const BASE_HEALTH = 100;
export const BASE_MANA = 60;
export const BASE_MANA_REGEN = 7;

export function computeStats(picks: Picks): HeroStats {
  const lv = (id: string) => picks[id] || 0;
  const v = (id: string) => CARDS[id].value(lv(id));
  return {
    might: 1 + v('might') + v('mastery-might'),
    cooldown: Math.max(0.3, (1 - v('haste')) * (1 - v('mastery-haste'))),
    speed: 1 + v('swift'),
    maxHealth: BASE_HEALTH + v('vitality') + v('mastery-vitality'),
    regen: v('recovery'),
    magnet: 1 + v('magnet'),
    armor: Math.min(0.6, v('armor')),
    growth: 1 + v('growth'),
    crit: 0.05 + v('crit'),
    maxMana: BASE_MANA + v('reservoir'),
    manaRegen: BASE_MANA_REGEN + v('wellspring'),
    manaCost: 1 - v('thrift'),
    area: 1 + v('reach'),
    duration: 1 + v('persistence'),
    luck: 1 + v('fortune'),
    gold: 1 + v('greed') + v('mastery-greed')
  };
}

export interface OfferedCard {
  id: string;
  toLevel: number;
  isNew: boolean;
  rarity: number;
  lines: string[];
}

/** Rarity shown on an offered card: by the rank it brings (it only colours the card). */
const rarityOf = (toLevel: number, mastery: boolean) => (mastery ? 3 : toLevel >= 9 ? 3 : toLevel >= 6 ? 2 : toLevel >= 3 ? 1 : 0);

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
  const offer = (c: StatCard): OfferedCard => {
    const cur = picks[c.id] || 0;
    return {
      id: c.id, toLevel: cur + 1, isNew: cur === 0, rarity: rarityOf(cur + 1, !!c.mastery),
      lines: cur === 0 ? [c.desc, `${c.label}: ${c.fmt(c.value(1))}`] : [`${c.label}: ${c.fmt(c.value(cur))} → ${c.fmt(c.value(cur + 1))}`]
    };
  };
  const draw = (pool: { w: number; card: OfferedCard }[], out: OfferedCard[]) => {
    while (out.length < count && pool.length) {
      let roll = rand() * pool.reduce((s, p) => s + p.w, 0);
      let i = 0;
      for (; i < pool.length - 1; i++) { roll -= pool[i].w; if (roll <= 0) break; }
      out.push(pool.splice(i, 1)[0].card);
    }
    return out;
  };
  const pool: { w: number; card: OfferedCard }[] = [];
  for (const id of CARD_IDS) {
    const c = CARDS[id], cur = picks[id] || 0;
    if (cur >= c.max) continue;
    let w = cur === 0 ? 1 : 1.4;
    if (dom && c.path === dom) w *= 1.8;
    pool.push({ w, card: offer(c) });
  }
  const out = draw(pool, []);
  // the ordinary cards are running out (or gone): mastery fills the hand, so a level is never wasted
  return draw(MASTERY_IDS.map((id) => ({ w: 1, card: offer(CARDS[id]) })), out);
}

/** Every rank a hero has taken, ordinary and mastery. */
export const ranksTaken = (picks: Picks) => Object.entries(picks).filter(([id]) => CARDS[id]).reduce((n, [, r]) => n + r, 0);

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
