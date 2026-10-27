// Save file shape, validation and versioning.
// The world itself is never saved: only the seed plus what the player changed (deltas).

export const SAVE_VERSION = 9;
// Bump when terrain / POI / camp generation changes in a way that alters existing worlds.
export const GENERATOR_VERSION = 3;   // 2: seeded Fisher–Yates shuffles in dungeon floors (were engine-dependent); 3: towns laid out by core/world/towns

export interface SpellSave { uid: string; tpl: string; level: number; xp: number; runes: (string | null)[]; locked?: boolean; fav?: boolean }

export interface HeroSave {
  id: string;
  level: number;
  experience: number;
  nextLevel: number;
  health: number;
  mana: number;
  pending: number;
  picks: Record<string, number>;   // stat card id -> level
  auto: string[];                  // uids of equipped auto-cast spells
  active: (string | null)[];       // uids bound to the active skill slots
  dead: boolean;
  presets: (LoadoutSet | null)[];  // three stored loadouts
  assist: string | null;           // the auto spell this hero lends while resting
}

export interface LoadoutSet { auto: string[]; active: (string | null)[] }

export interface InventorySave {
  spells: SpellSave[];             // every spell item the party owns (a spell is equipped by at most one hero)
  runes: string[];
  wallet: { gold: number; wood: number; stone: number; iron: number };
  lootFilter: 'off' | 'basic' | 'advanced';
}

export interface TowerSave {
  id: string;
  kind: string;
  tx: number; ty: number;
  dir: number; len: number;
  delivered: { gold: number; wood: number; stone: number; iron: number };
  built: boolean;
  spell: string | null;
}

export interface FloorState {
  opened: (number | string)[];           // chest indices, and 'vault' for a vault's chest
  cleared: boolean;
  altarUsed: boolean;
  unsealed?: boolean;
  fog?: unknown;                         // what of the floor has been explored (FogOfWar.toJSON)
}

export interface PlaceState {
  opened: (number | string)[];
  cleared: boolean;
  altarUsed: boolean;
  fountainAt?: number;
  unsealed?: boolean;                    // the guardians of the first floor are down for good
  floors?: Record<string, FloorState>;   // dungeon floors below the first, by floor number
  bossDead?: boolean;                    // the dungeon boss has fallen for good
  bossChestOpened?: boolean;             // and its guaranteed chest has been opened
  complete?: boolean;                    // every floor cleared and every chest opened (a badge on the map)
  fog?: unknown;                         // what of the first floor has been explored (FogOfWar.toJSON)
}

export interface CityRef { id: string; name: string; ex: number; ey: number }

export interface QuestSave {
  active: Record<string, { progress: number[]; targets: (string | null)[]; startedAt: number; def?: unknown }>;
  done: string[];
  flags: Record<string, number | boolean>;
  tracked: string | null;
  bounties: Record<string, { epoch: number; taken: number[] }>;
}
export const emptyQuests = (): QuestSave => ({ active: {}, done: [], flags: {}, tracked: null, bounties: {} });

export interface SaveData {
  version: number;
  generatorVersion: number;
  seed: number;
  createdAt: number;
  savedAt: number;
  playSeconds: number;
  player: { x: number; y: number; boat?: string | null };
  party: { active: number; heroes: HeroSave[] };
  inventory: InventorySave;
  stats: {
    kills: number; score: number; bossesDefeated: number;
    byType: Record<string, number>;          // kills per monster type
    distance: number;                        // world units walked
    goldEarned: number;
    deaths: number;                          // party wipes
  };
  world: {
    clearedCamps: Record<string, number>;   // camp id -> play seconds when cleared
    defeatedLairs: Record<string, number>;  // lair id -> play seconds when defeated
    places: Record<string, PlaceState>;     // POI id -> state
    fog: Record<string, string>;            // chunk key -> base64 bitmask
    cities: CityRef[];                      // visited cities (respawn points)
    lastCity: string | null;                // id of the last town the party entered (death respawn)
    claimed: Record<string, number>;        // claim zone id -> play seconds when claimed
    triggered: Record<string, number>;      // ambush plate id -> play seconds when sprung
    gathered: string[];                     // harvested resource nodes (trees, rocks, ore)
    shopSold: Record<string, number[]>;     // `${townId}:${epoch}` -> stock slots already bought
    towers: TowerSave[];                    // placed towers, construction sites and docks
    boats: Record<string, { x: number; y: number }>;  // dock id -> where its boat is moored
    caches: string[];                       // island treasure already opened
  };
  quests: QuestSave;                        // story progress, active quests, bounty board rotations
  codex: { monsters: string[]; spells: string[]; runes: string[] };   // what the party has met and found
  tips: string[];                           // onboarding tips already shown
  regions: string[];                        // named regions discovered
  name?: string;                            // a name the player gave the save
  thumb?: string;                           // small JPEG of the screen when saved (data URL)
  meta?: { region?: string; place?: string };   // where the party was, for the slot list
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
  const party = data.party;
  if (!isObj(party) || !isNum(party.active) || !Array.isArray(party.heroes) || party.heroes.length < 1) errs.push('party missing');
  else {
    for (const h of party.heroes as unknown[]) {
      if (!isObj(h)) { errs.push('party hero invalid'); continue; }
      for (const k of ['level', 'experience', 'nextLevel', 'health']) if (!isNum(h[k])) errs.push(`hero.${k} must be a number`);
      if (!isObj(h.picks)) errs.push('hero.picks missing');
      if (!Array.isArray(h.auto) || !Array.isArray(h.active)) errs.push('hero loadout missing');
    }
  }
  const inv = data.inventory;
  if (!isObj(inv)) errs.push('inventory missing');
  else {
    if (!Array.isArray(inv.spells)) errs.push('inventory.spells missing');
    if (!Array.isArray(inv.runes)) errs.push('inventory.runes missing');
    if (!isObj(inv.wallet)) errs.push('inventory.wallet missing');
  }
  const stats = data.stats;
  if (!isObj(stats) || !isNum(stats.kills) || !isNum(stats.score)) errs.push('stats missing');
  else if (!isObj(stats.byType) || !isNum(stats.distance) || !isNum(stats.goldEarned) || !isNum(stats.deaths)) errs.push('statistics missing');
  const world = data.world;
  if (!isObj(world)) errs.push('world missing');
  else {
    for (const k of ['clearedCamps', 'defeatedLairs', 'places', 'fog', 'claimed', 'triggered', 'shopSold', 'boats']) if (!isObj(world[k])) errs.push(`world.${k} missing`);
    if (!Array.isArray(world.gathered)) errs.push('world.gathered missing');
    if (!Array.isArray(world.towers)) errs.push('world.towers missing');
    if (!Array.isArray(world.caches)) errs.push('world.caches missing');
    if (!Array.isArray(world.cities)) errs.push('world.cities missing');
  }
  const q = data.quests;
  if (!isObj(q) || !isObj(q.active) || !Array.isArray(q.done) || !isObj(q.flags) || !isObj(q.bounties)) errs.push('quests missing');
  if (!Array.isArray(data.tips)) errs.push('tips missing');
  const cx = data.codex;
  if (!isObj(cx) || !Array.isArray(cx.monsters) || !Array.isArray(cx.spells) || !Array.isArray(cx.runes)) errs.push('codex missing');
  if (!Array.isArray(data.regions)) errs.push('regions missing');
  return errs;
}

export function summarize(slot: string, data: SaveData): SaveSummary {
  return { slot, savedAt: data.savedAt, playSeconds: data.playSeconds, level: data.party.heroes[data.party.active]?.level ?? 1, seed: data.seed };
}
