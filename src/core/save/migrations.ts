import { SAVE_VERSION, validateSave, type SaveData } from './schema';

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
  })
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