import { SAVE_VERSION, validateSave, type SaveData } from './schema';
import { xpForLevel } from '../config';

type Migration = (raw: Record<string, any>) => Record<string, any>;

// Each entry upgrades a save from version N to N + 1. Add new entries at the end when the schema changes.
// Never edit an old migration: players may still have saves at that version.
export const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: weapons become spell items, passives become stat-card picks, mana + loadout are added
  1: (raw) => {
    const old = raw.hero ?? {};
    const spells = (old.weapons ?? []).map((w: any, i: number) => ({
      uid: `m${i}${String(w.id)}`, tpl: String(w.id), level: Math.max(1, w.level | 0), xp: 0,
      runes: [null, null]
    }));
    const dash = { uid: 'm-dash', tpl: 'dash', level: 1, xp: 0, runes: [null] };
    spells.push(dash);
    return {
      ...raw,
      version: 2,
      hero: {
        level: old.level, experience: old.experience, nextLevel: old.nextLevel, health: old.health,
        mana: 60, pendingPicks: 0,
        picks: { ...(old.passives ?? {}) },
        spells,
        runes: [],
        auto: spells.filter((s: any) => s.tpl !== 'dash').slice(0, 5).map((s: any) => s.uid),
        active: [dash.uid, null, null]
      }
    };
  },
  // v2 -> v3: wallet (gold + resources) and the loot filter
  2: (raw) => ({
    ...raw,
    version: 3,
    hero: { ...raw.hero, wallet: { gold: 0, wood: 0, stone: 0, iron: 0 }, lootFilter: 'off' }
  }),
  // v3 -> v4: a single hero becomes a party of three sharing one inventory
  3: (raw) => {
    const old = raw.hero ?? {};
    const spells: any[] = [...(old.spells ?? [])];
    const mk = (tpl: string, sockets: number, n: string) => { const s = { uid: `p4${n}${tpl}`, tpl, level: 1, xp: 0, runes: Array(sockets).fill(null) }; spells.push(s); return s.uid; };
    const bench = [
      { id: 'brann', auto: [mk('orbit', 2, 'b')], active: [mk('barrier', 1, 'b'), null, null] },
      { id: 'cyra', auto: [mk('nova', 2, 'c')], active: [mk('blink', 1, 'c'), null, null] }
    ].map((b) => ({ ...b, level: 1, experience: 0, nextLevel: xpForLevel(1), health: 100, mana: 60, pending: 0, picks: {}, dead: false }));
    const { world } = raw;
    const out: Record<string, any> = {
      ...raw,
      version: 4,
      party: {
        active: 0,
        heroes: [{
          id: 'aria', level: old.level, experience: old.experience, nextLevel: old.nextLevel, health: old.health, mana: old.mana ?? 60,
          pending: old.pendingPicks ?? 0, picks: { ...(old.picks ?? {}) }, auto: [...(old.auto ?? [])], active: [...(old.active ?? [null, null, null])], dead: false
        }, ...bench]
      },
      inventory: { spells, runes: [...(old.runes ?? [])], wallet: { ...(old.wallet ?? { gold: 0, wood: 0, stone: 0, iron: 0 }) }, lootFilter: old.lootFilter ?? 'off' },
      world: { ...world, lastCity: world?.cities?.length ? world.cities[world.cities.length - 1].id : null }
    };
    delete out.hero;
    return out;
  },
  // v4 -> v5: surfaces, claim zones, ambush plates, gathered nodes and shop purchases are world deltas
  4: (raw) => ({
    ...raw,
    version: 5,
    world: { ...raw.world, claimed: {}, triggered: {}, gathered: [], shopSold: {} }
  }),
  // v5 -> v6: towers, docks and boats, island caches
  5: (raw) => ({
    ...raw,
    version: 6,
    world: { ...raw.world, towers: [], boats: {}, caches: [] }
  }),
  // v6 -> v7: quests, story flags and bounty boards (dungeon progress lives inside each place's state)
  6: (raw) => ({
    ...raw,
    version: 7,
    quests: { active: {}, done: [], flags: {}, tracked: null, bounties: {} }
  }),
  // v7 -> v8: onboarding tips already shown and named regions discovered
  7: (raw) => ({ ...raw, version: 8, tips: [], regions: [] }),
  // v8 -> v9: statistics (kills per monster, distance walked, gold earned, party wipes), the codex, and per hero
  // three loadout sets and the spell lent while resting
  8: (raw) => ({
    ...raw,
    version: 9,
    stats: { ...raw.stats, byType: {}, distance: 0, goldEarned: 0, deaths: 0 },
    codex: {
      monsters: Object.keys(raw.stats?.byType ?? {}),
      spells: [...new Set<string>((raw.inventory?.spells ?? []).map((s: { tpl: string }) => s.tpl))],
      runes: [...new Set<string>(raw.inventory?.runes ?? [])]
    },
    party: { ...raw.party, heroes: raw.party.heroes.map((h: object) => ({ ...h, presets: [null, null, null], assist: null })) }
  }),
  // v9 -> v10: the passive cards were rebalanced (ten small ranks each, new cards, mastery), so every hero's picks
  // are refunded as pending upgrades to spend again; a notice says so once, on the first load
  9: (raw) => {
    const refunds: string[] = [];
    const heroes = raw.party.heroes.map((h: { id: string; pending?: number; picks?: Record<string, number> }) => {
      const n = Object.values(h.picks ?? {}).reduce((a, r) => a + (Number(r) || 0), 0);
      if (n > 0) refunds.push(`${h.id.charAt(0).toUpperCase()}${h.id.slice(1)} ${n}`);
      return { ...h, pending: (h.pending ?? 0) + n, picks: {} };
    });
    const notices = refunds.length ? [`Passives were rebalanced: upgrades refunded to spend again (${refunds.join(', ')})`] : [];
    return { ...raw, version: 10, party: { ...raw.party, heroes }, notices: [...(raw.notices ?? []), ...notices] };
  }
};

export class SaveError extends Error {
  constructor(message: string, readonly details: string[] = []) { super(message); this.name = 'SaveError'; }
}

export function migrate(raw: unknown, targetVersion: number = SAVE_VERSION): SaveData {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('Save is not valid data');
  let data = raw as Record<string, any>;
  let version = typeof data.version === 'number' ? data.version : 0;
  if (version > targetVersion) throw new SaveError(`Save was made by a newer game version (${version} > ${targetVersion})`);
  if (version < 1) throw new SaveError('Save is too old to load');
  while (version < targetVersion) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveError(`No migration from save version ${version}`);
    data = step(data);
    version = data.version;
  }
  const problems = validateSave(data);
  if (problems.length) throw new SaveError('Save is corrupted', problems);
  return data as SaveData;
}