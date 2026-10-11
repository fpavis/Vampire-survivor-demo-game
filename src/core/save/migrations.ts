import { SAVE_VERSION, validateSave, type SaveData } from './schema';

type Migration = (raw: Record<string, any>) => Record<string, any>;

// Each entry upgrades a save from version N to N + 1. Add new entries at the end when the schema changes.
// Never edit an old migration: players may still have saves at that version.
export const MIGRATIONS: Record<number, Migration> = {
  // example shape for the future:
  // 1: (raw) => ({ ...raw, version: 2, hero: { ...raw.hero, newField: 0 } })
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
