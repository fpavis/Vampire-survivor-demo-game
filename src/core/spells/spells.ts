// Data-driven spell system (pure, no rendering).
// A spell item = template (core element + expression) + level + up to N rune sockets.
// resolveSpell() folds level curve + runes into final numbers; the app-side runtime only executes them.

export type CoreId = 'arcane' | 'frost' | 'fire' | 'lightning' | 'force' | 'life';
export type ExprId = 'bolt' | 'orbit' | 'chain' | 'nova' | 'meteor' | 'dash' | 'blink' | 'barrier';
export type SpellMode = 'auto' | 'active';

export interface Params {
  damage: number;
  cooldown: number;   // ms
  count: number;
  pierce: number;
  radius: number;
  speed: number;
  jumps: number;
  slow: number;       // 0..1 movement slow applied on hit
  burn: number;       // damage per second applied for 3 s on hit
  knock: number;      // multiplier on knock-back
  mana: number;       // mana per cast (active spells only)
  duration: number;   // seconds (barrier)
  range: number;      // distance (dash / blink)
  leech: number;      // hp healed per kill
}

export type TriggerOn = 'hit' | 'kill';
export type TriggerPayload = 'spark' | 'burst';
export interface Trigger { on: TriggerOn; payload: TriggerPayload; chance: number; power: number }

export interface SpellTemplate {
  id: string;
  name: string;
  icon: string;
  core: CoreId;
  expr: ExprId;
  mode: SpellMode;
  sockets: number;
  max: number;
  desc: string;
  base: (level: number) => Partial<Params>;
}

export interface SpellItem {
  uid: string;
  tpl: string;
  level: number;
  xp: number;
  runes: (string | null)[];
  locked?: boolean;
}

export interface RuneDef {
  id: string;
  name: string;
  icon: string;
  rarity: 0 | 1 | 2 | 3 | 4;
  desc: string;
  /** expressions this rune works with; omitted = all */
  exprs?: ExprId[];
  /** cores this rune cannot be combined with */
  notCores?: CoreId[];
  /** only for these spell modes */
  mode?: SpellMode;
  mods: { p: keyof Params; add?: number; mul?: number }[];
  trigger?: Trigger;
}

export const CORE_INFO: Record<CoreId, { name: string; color: number; icon: string }> = {
  arcane: { name: 'Arcane', color: 0xffd84a, icon: '✨' },
  frost: { name: 'Frost', color: 0x9be7ff, icon: '❄️' },
  fire: { name: 'Fire', color: 0xff8a3a, icon: '🔥' },
  lightning: { name: 'Storm', color: 0xb9a5ff, icon: '⚡' },
  force: { name: 'Force', color: 0xc9d4e0, icon: '💠' },
  life: { name: 'Life', color: 0x7be07b, icon: '🌿' }
};

const D: Params = {
  damage: 0, cooldown: 1000, count: 1, pierce: 0, radius: 0, speed: 0, jumps: 0,
  slow: 0, burn: 0, knock: 1, mana: 0, duration: 0, range: 0, leech: 0
};

const cd = (base: number, f: number, l: number) => Math.round(base * Math.pow(f, l - 1));

// Level curves reproduce the original five weapons so balance stays comparable.
export const TEMPLATES: Record<string, SpellTemplate> = {
  bolt: {
    id: 'bolt', name: 'Arcane Bolt', icon: '✨', core: 'arcane', expr: 'bolt', mode: 'auto', sockets: 2, max: 8,
    desc: 'Fires magic bolts at the nearest enemies.',
    base: (l) => ({ damage: 22 + 6 * (l - 1), cooldown: cd(700, 0.92, l), count: 1 + Math.floor((l - 1) / 2), pierce: Math.floor((l - 1) / 3), speed: 9 })
  },
  orbit: {
    id: 'orbit', name: 'Spirit Blades', icon: '🗡️', core: 'force', expr: 'orbit', mode: 'auto', sockets: 2, max: 8,
    desc: 'Blades circle around you and shred anything close.',
    base: (l) => ({ damage: 12 + 4 * (l - 1), count: 2 + Math.floor(l / 2), radius: 78 + 6 * (l - 1), speed: 0.034 + 0.004 * (l - 1) })
  },
  lightning: {
    id: 'lightning', name: 'Chain Lightning', icon: '⚡', core: 'lightning', expr: 'chain', mode: 'auto', sockets: 2, max: 8,
    desc: 'Calls down lightning that jumps between enemies.',
    base: (l) => ({ damage: 26 + 8 * (l - 1), cooldown: cd(1500, 0.93, l), count: 1 + Math.floor((l - 1) / 3), jumps: 2 + Math.floor(l / 2) })
  },
  nova: {
    id: 'nova', name: 'Frost Nova', icon: '❄️', core: 'frost', expr: 'nova', mode: 'auto', sockets: 2, max: 8,
    desc: 'A freezing shockwave that damages, slows and pushes back.',
    base: (l) => ({ damage: 22 + 7 * (l - 1), cooldown: cd(3200, 0.92, l), radius: 130 + 16 * (l - 1), slow: Math.min(0.75, 0.35 + 0.05 * (l - 1)), knock: 1 })
  },
  meteor: {
    id: 'meteor', name: 'Meteor', icon: '☄️', core: 'fire', expr: 'meteor', mode: 'auto', sockets: 2, max: 8,
    desc: 'Summons meteors that crash down on enemies.',
    base: (l) => ({ damage: 46 + 15 * (l - 1), cooldown: cd(2800, 0.92, l), count: 1 + Math.floor(l / 3), radius: 64 + 7 * (l - 1), burn: 6 })
  },
  dash: {
    id: 'dash', name: 'Dash', icon: '💨', core: 'force', expr: 'dash', mode: 'active', sockets: 1, max: 5,
    desc: 'Burst forward and become untouchable for a moment.',
    base: (l) => ({ cooldown: 900, mana: 22, range: 150 + 12 * (l - 1), duration: 0.28 + 0.03 * l, damage: 0 })
  },
  blink: {
    id: 'blink', name: 'Blink', icon: '🌀', core: 'arcane', expr: 'blink', mode: 'active', sockets: 1, max: 5,
    desc: 'Teleport toward the cursor or your movement direction.',
    base: (l) => ({ cooldown: 2400, mana: 38, range: 260 + 25 * (l - 1), damage: 0 })
  },
  barrier: {
    id: 'barrier', name: 'Aegis', icon: '🛡️', core: 'life', expr: 'barrier', mode: 'active', sockets: 1, max: 5,
    desc: 'A ward that blocks all damage while mana lasts.',
    base: (l) => ({ cooldown: 6000, mana: 45, duration: 2.2 + 0.4 * (l - 1), radius: 60 })
  }
};

const ALL_DMG: ExprId[] = ['bolt', 'orbit', 'chain', 'nova', 'meteor'];

export const RUNES: Record<string, RuneDef> = {
  multishot: { id: 'multishot', name: 'Multishot', icon: '🔱', rarity: 1, desc: '+1 projectile, -12% damage.', exprs: ['bolt', 'chain', 'meteor', 'orbit'],
    mods: [{ p: 'count', add: 1 }, { p: 'damage', mul: 0.88 }] },
  piercing: { id: 'piercing', name: 'Piercing', icon: '➶', rarity: 1, desc: 'Bolts pierce 2 more enemies.', exprs: ['bolt'],
    mods: [{ p: 'pierce', add: 2 }] },
  swift: { id: 'swift', name: 'Swift', icon: '⏩', rarity: 1, desc: '-20% cooldown.', mods: [{ p: 'cooldown', mul: 0.8 }] },
  heavy: { id: 'heavy', name: 'Heavy', icon: '🔨', rarity: 1, desc: '+35% damage, +15% cooldown.', exprs: ALL_DMG,
    mods: [{ p: 'damage', mul: 1.35 }, { p: 'cooldown', mul: 1.15 }] },
  wide: { id: 'wide', name: 'Wide', icon: '⭕', rarity: 1, desc: '+30% area.', exprs: ['nova', 'meteor', 'orbit', 'barrier'],
    mods: [{ p: 'radius', mul: 1.3 }] },
  chaining: { id: 'chaining', name: 'Chaining', icon: '🔗', rarity: 2, desc: '+2 chain jumps.', exprs: ['chain'],
    mods: [{ p: 'jumps', add: 2 }] },
  frostbite: { id: 'frostbite', name: 'Frostbite', icon: '🧊', rarity: 2, desc: 'Hits slow enemies by 30%.', exprs: ALL_DMG, notCores: ['fire'],
    mods: [{ p: 'slow', add: 0.3 }] },
  ignite: { id: 'ignite', name: 'Ignite', icon: '🔥', rarity: 2, desc: 'Hits burn for 8 damage/s.', exprs: ALL_DMG, notCores: ['frost'],
    mods: [{ p: 'burn', add: 8 }] },
  shove: { id: 'shove', name: 'Shove', icon: '👊', rarity: 1, desc: '+80% knock-back.', exprs: ALL_DMG, mods: [{ p: 'knock', add: 0.8 }] },
  spark: { id: 'spark', name: 'Spark', icon: '✴️', rarity: 3, desc: '20% on hit: a spark zaps another enemy for 60% damage.', exprs: ['bolt', 'orbit', 'meteor', 'nova'], notCores: ['lightning'],
    mods: [], trigger: { on: 'hit', payload: 'spark', chance: 0.2, power: 0.6 } },
  echo: { id: 'echo', name: 'Death Echo', icon: '💥', rarity: 3, desc: 'Enemies killed by this spell explode for 70% damage.', exprs: ALL_DMG,
    mods: [], trigger: { on: 'kill', payload: 'burst', chance: 1, power: 0.7 } },
  vampiric: { id: 'vampiric', name: 'Vampiric', icon: '🩸', rarity: 3, desc: 'Each kill heals 1 HP.', exprs: ALL_DMG, mods: [{ p: 'leech', add: 1 }] },
  efficient: { id: 'efficient', name: 'Efficient', icon: '💧', rarity: 1, desc: '-30% mana cost.', mode: 'active', mods: [{ p: 'mana', mul: 0.7 }] },
  reach: { id: 'reach', name: 'Far Reach', icon: '↗️', rarity: 2, desc: '+40% distance.', exprs: ['dash', 'blink'], mods: [{ p: 'range', mul: 1.4 }] },
  lingering: { id: 'lingering', name: 'Lingering', icon: '⏳', rarity: 2, desc: '+50% duration.', exprs: ['barrier', 'dash'], mods: [{ p: 'duration', mul: 1.5 }] }
};

export interface ResolvedSpell {
  item: SpellItem;
  tpl: SpellTemplate;
  p: Params;
  color: number;
  triggers: Trigger[];
}

export function runeFits(rune: RuneDef, tpl: SpellTemplate): string | null {
  if (rune.exprs && !rune.exprs.includes(tpl.expr)) return `Does not work with ${tpl.name}`;
  if (rune.notCores && rune.notCores.includes(tpl.core)) return `Clashes with ${CORE_INFO[tpl.core].name}`;
  if (rune.mode && rune.mode !== tpl.mode) return rune.mode === 'active' ? 'Active spells only' : 'Auto-cast spells only';
  return null;
}

/** Compatibility check used by the UI before a rune can be socketed. */
export function canSocket(item: SpellItem, runeId: string, slot: number): { ok: boolean; reason?: string } {
  const tpl = TEMPLATES[item.tpl];
  const rune = RUNES[runeId];
  if (!tpl || !rune) return { ok: false, reason: 'Unknown item' };
  if (slot < 0 || slot >= tpl.sockets) return { ok: false, reason: 'No such socket' };
  const bad = runeFits(rune, tpl);
  if (bad) return { ok: false, reason: bad };
  if (item.runes.some((r, i) => r === runeId && i !== slot)) return { ok: false, reason: 'Already socketed' };
  return { ok: true };
}

export function resolveSpell(item: SpellItem): ResolvedSpell {
  const tpl = TEMPLATES[item.tpl];
  const p: Params = { ...D, ...tpl.base(Math.min(item.level, tpl.max)) };
  const triggers: Trigger[] = [];
  // additive mods first, then multiplicative, so rune order never matters
  const runes = item.runes.map((r) => (r ? RUNES[r] : null)).filter((r): r is RuneDef => !!r && !runeFits(r, tpl)).sort((x, y) => (x.id < y.id ? -1 : 1));
  for (const r of runes) for (const m of r.mods) if (m.add) p[m.p] += m.add;
  for (const r of runes) for (const m of r.mods) if (m.mul) p[m.p] *= m.mul;
  for (const r of runes) if (r.trigger) triggers.push(r.trigger);
  p.count = Math.max(1, Math.round(p.count));
  p.cooldown = Math.max(120, p.cooldown);
  p.slow = Math.min(0.8, p.slow);
  p.mana = Math.max(0, Math.round(p.mana));
  return { item, tpl, p, color: CORE_INFO[tpl.core].color, triggers };
}

/** Kills a spell needs before reaching the next level. */
export const spellXpFor = (level: number) => Math.round(18 * Math.pow(level, 1.55));

/** Credits a kill; returns true when the spell levelled up. */
export function addSpellXp(item: SpellItem, amount: number): boolean {
  const tpl = TEMPLATES[item.tpl];
  if (item.level >= tpl.max) return false;
  item.xp += amount;
  let up = false;
  while (item.level < tpl.max && item.xp >= spellXpFor(item.level)) {
    item.xp -= spellXpFor(item.level);
    item.level++;
    up = true;
  }
  if (item.level >= tpl.max) item.xp = 0;
  return up;
}

let uidSeq = 0;
export function makeSpell(tplId: string, level = 1): SpellItem {
  const tpl = TEMPLATES[tplId];
  return { uid: `s${Date.now().toString(36)}${(uidSeq++).toString(36)}`, tpl: tplId, level, xp: 0, runes: Array(tpl.sockets).fill(null) };
}

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** One-line summary of what a resolved spell does, for tooltips. */
export function describeSpell(r: ResolvedSpell): string[] {
  const { p, tpl } = r;
  const out: string[] = [];
  if (p.damage) out.push(`Damage ${Math.round(p.damage)}`);
  if (tpl.mode === 'auto' && tpl.expr !== 'orbit') out.push(`Every ${(p.cooldown / 1000).toFixed(2)}s`);
  if (tpl.mode === 'active') out.push(`Costs ${p.mana} mana · ${(p.cooldown / 1000).toFixed(1)}s cooldown`);
  if (p.count > 1) out.push(`×${p.count}`);
  if (p.pierce) out.push(`Pierce ${p.pierce}`);
  if (p.jumps) out.push(`${p.jumps} jumps`);
  if (p.radius && tpl.expr !== 'barrier') out.push(`Radius ${Math.round(p.radius)}`);
  if (p.slow) out.push(`Slow ${Math.round(p.slow * 100)}%`);
  if (p.burn) out.push(`Burn ${Math.round(p.burn)}/s`);
  if (p.range) out.push(`Range ${Math.round(p.range)}`);
  if (p.duration) out.push(`${p.duration.toFixed(1)}s`);
  return out;
}

/** Weighted loot roll for the 0.1 % "skill" drop. `power` biases toward rarer results. */
export function rollSkillDrop(rand: () => number, power = 0): { kind: 'spell'; tpl: string } | { kind: 'rune'; id: string } {
  if (rand() < 0.2) {
    const pool = Object.values(TEMPLATES).filter((t) => t.id !== 'dash' || rand() < 0.5);
    return { kind: 'spell', tpl: pool[Math.floor(rand() * pool.length)].id };
  }
  const runes = Object.values(RUNES);
  const weights = runes.map((r) => Math.max(0.05, Math.pow(0.45, Math.max(0, r.rarity - power * 0.6))));
  let roll = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < runes.length; i++) { roll -= weights[i]; if (roll <= 0) return { kind: 'rune', id: runes[i].id }; }
  return { kind: 'rune', id: runes[0].id };
}

export function starterLoadout(): { spells: SpellItem[]; auto: string[]; active: (string | null)[] } {
  const bolt = makeSpell('bolt');
  const dash = makeSpell('dash');
  return { spells: [bolt, dash], auto: [bolt.uid], active: [dash.uid, null, null] };
}

const PARAM_LABELS: Partial<Record<keyof Params, [string, (v: number) => string]>> = {
  damage: ['Damage', (v) => `${Math.round(v)}`],
  cooldown: ['Cooldown', (v) => `${(v / 1000).toFixed(2)}s`],
  count: ['Count', (v) => `${v}`],
  pierce: ['Pierce', (v) => `${v}`],
  radius: ['Radius', (v) => `${Math.round(v)}`],
  jumps: ['Jumps', (v) => `${v}`],
  slow: ['Slow', (v) => `${Math.round(v * 100)}%`],
  burn: ['Burn/s', (v) => `${Math.round(v)}`],
  knock: ['Knock-back', (v) => `×${v.toFixed(2)}`],
  mana: ['Mana', (v) => `${v}`],
  duration: ['Duration', (v) => `${v.toFixed(1)}s`],
  range: ['Range', (v) => `${Math.round(v)}`],
  leech: ['Heal/kill', (v) => `${v}`]
};

/** What changes if `runeId` were socketed into `slot` (compare tooltip). Empty when it cannot be socketed. */
export function previewRune(item: SpellItem, runeId: string, slot: number): string[] {
  if (!canSocket(item, runeId, slot).ok) return [];
  const before = resolveSpell(item);
  const copy: SpellItem = { ...item, runes: item.runes.map((r, i) => (i === slot ? runeId : r)) };
  const after = resolveSpell(copy);
  const out: string[] = [];
  for (const k of Object.keys(PARAM_LABELS) as (keyof Params)[]) {
    const a = before.p[k], b = after.p[k];
    if (Math.abs(a - b) > 1e-9) { const [label, f] = PARAM_LABELS[k]!; out.push(`${label}: ${f(a)} → ${f(b)}`); }
  }
  const t = RUNES[runeId].trigger;
  if (t) out.push(t.on === 'hit' ? `On hit: ${Math.round(t.chance * 100)}% spark` : 'On kill: explosion');
  return out;
}
