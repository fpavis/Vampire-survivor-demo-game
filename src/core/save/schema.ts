// Save file shape, validation and versioning.
// The world itself is never saved: only the seed plus what the player changed (deltas).

export const SAVE_VERSION = 1;
// Bump when terrain / POI / camp generation changes in a way that alters existing worlds.
export const GENERATOR_VERSION = 1;

export interface HeroSave {
  level: number;
  experience: number;
  nextLevel: number;
  health: number;
  passives: Record<string, number>;
  weapons: { id: string; level: number }[];
}

export interface PlaceState {
  opened: number[];
  cleared: boolean;
  altarUsed: boolean;
  fountainAt?: number;
}

export interface CityRef { id: string; name: string; ex: number; ey: number }

export interface SaveData {
  version: number;
  generatorVersion: number;
  seed: number;
  createdAt: number;
  savedAt: number;
  playSeconds: number;
  player: { x: number; y: number };
  hero: HeroSave;
  stats: { kills: number; score: number; bossesDefeated: number };
  world: {
    clearedCamps: Record<string, number>;   // camp id -> play seconds when cleared
    defeatedLairs: Record<string, number>;  // lair id -> play seconds when defeated
    places: Record<string, PlaceState>;     // POI id -> state
    fog: Record<string, string>;            // chunk key -> base64 bitmask
    cities: CityRef[];                      // visited cities (respawn points)
  };
}

export interface SaveSummary {
  slot: string;
  savedAt: number;
  playSeconds: number;
  level: number;
  seed: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Returns a list of problems (empty when the save is structurally sound). */
export function validateSave(data: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(data)) return ['save is not an object'];
  for (const k of ['version', 'generatorVersion', 'seed', 'createdAt', 'savedAt', 'playSeconds']) {
    if (!isNum(data[k])) errs.push(`${k} must be a number`);
  }
  const player = data.player;
  if (!isObj(player) || !isNum(player.x) || !isNum(player.y)) errs.push('player position missing');
  const hero = data.hero;
  if (!isObj(hero)) errs.push('hero missing');
  else {
    for (const k of ['level', 'experience', 'nextLevel', 'health']) if (!isNum(hero[k])) errs.push(`hero.${k} must be a number`);
    if (!isObj(hero.passives)) errs.push('hero.passives missing');
    if (!Array.isArray(hero.weapons)) errs.push('hero.weapons missing');
  }
  const stats = data.stats;
  if (!isObj(stats) || !isNum(stats.kills) || !isNum(stats.score)) errs.push('stats missing');
  const world = data.world;
  if (!isObj(world)) errs.push('world missing');
  else {
    for (const k of ['clearedCamps', 'defeatedLairs', 'places', 'fog']) if (!isObj(world[k])) errs.push(`world.${k} missing`);
    if (!Array.isArray(world.cities)) errs.push('world.cities missing');
  }
  return errs;
}

export function summarize(slot: string, data: SaveData): SaveSummary {
  return { slot, savedAt: data.savedAt, playSeconds: data.playSeconds, level: data.hero.level, seed: data.seed };
}
