// Random overworld events: now and then a group of monsters comes looking for the party, so the road is never
// quite predictable, or lays siege to one of the party's towers nearby. Pure: when the next one is due, which
// kind, where its members appear, and when one may not happen at all. The runtime (app/worldEvents.ts) spawns
// them, warns the player and pays the reward.

export type WorldEventKind = 'warband' | 'swarm' | 'hunters' | 'siege';

export interface WorldEventDef {
  name: string;               // for the log
  banner: string;             // the warning shown when it starts
  count: [number, number];    // members, inclusive
  elites: number;             // how many of them are elite
  waves: number;              // arrives in this many groups
  spread: number;             // radians each group fans out over
}

export const EVENT_DEFS: Record<WorldEventKind, WorldEventDef> = {
  warband: { name: 'A warband', banner: 'A WARBAND APPROACHES', count: [6, 9], elites: 1, waves: 1, spread: 0.55 },
  swarm: { name: 'A swarm', banner: 'A SWARM IS COMING', count: [10, 14], elites: 0, waves: 2, spread: 0.7 },
  hunters: { name: 'Hunters', banner: 'YOU ARE BEING HUNTED', count: [3, 3], elites: 3, waves: 1, spread: 0.9 },
  // a siege gathers round one of the party's towers and silences it until the besiegers are beaten
  siege: { name: 'A siege', banner: 'UNDER SIEGE', count: [6, 9], elites: 1, waves: 1, spread: Math.PI * 2 }
};
/** The events that come looking for the party (a siege comes for a tower instead). */
export const EVENT_KINDS: WorldEventKind[] = ['warband', 'swarm', 'hunters'];
/** A tower this close to the party (world units) can be besieged; one in three events near one is a siege. */
export const SIEGE_REACH = 1400;
export const SIEGE_CHANCE = 0.35;

/** Seconds of overworld play between events: 2.5 to 4.5 minutes, a third of that in corrupted lands (never under 1 minute). */
export function nextEventDelay(rand: () => number, corrupt: boolean): number {
  const t = 150 + rand() * 120;
  return Math.max(60, corrupt ? t / 3 : t);
}

/** Which kind of event: warbands are the most common, hunters the rarest; a siege only with a tower near. */
export function pickEvent(rand: () => number, towerNear = false): WorldEventKind {
  if (towerNear && rand() < SIEGE_CHANCE) return 'siege';
  const r = rand();
  return r < 0.42 ? 'warband' : r < 0.77 ? 'swarm' : 'hunters';
}

/** Where the besiegers stand, relative to the tower's centre: all round it, 2.5 to 5 tiles out. */
export function siegeSpawns(rand: () => number, tile: number): EventSpawn[] {
  const def = EVENT_DEFS.siege;
  const n = def.count[0] + Math.floor(rand() * (def.count[1] - def.count[0] + 1));
  const a0 = rand() * Math.PI * 2;
  const out: EventSpawn[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const r = tile * (2.5 + rand() * 2.5);
    out.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, wave: 0, elite: i < def.elites });
  }
  return out;
}

export interface EventSpawn { dx: number; dy: number; wave: number; elite: boolean }

/**
 * Where each member appears, relative to the hero: on a ring from `minR` to `maxR` (outside the screen), groups
 * spread over a narrow arc around a bearing (a swarm's two groups come from sides 140 degrees apart).
 */
export function eventSpawns(kind: WorldEventKind, rand: () => number, minR: number, maxR: number): EventSpawn[] {
  const def = EVENT_DEFS[kind];
  const n = def.count[0] + Math.floor(rand() * (def.count[1] - def.count[0] + 1));
  const bearing = rand() * Math.PI * 2;
  const out: EventSpawn[] = [];
  for (let i = 0; i < n; i++) {
    const wave = i % def.waves;
    const centre = bearing + (def.waves > 1 ? (wave ? 1 : -1) * (70 * Math.PI / 180) : 0);
    const a = centre + (rand() - 0.5) * def.spread;
    const r = minR + rand() * (maxR - minR);
    out.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, wave, elite: i < def.elites });
  }
  return out;
}

/** Things that hold an event back: it must never land on a party that is already in trouble or somewhere safe. */
export interface EventContext {
  overworldSeconds: number;   // play time out in the world this run
  sailing: boolean;
  tilesFromStart: number;
  tilesFromTown: number;      // to the nearest town entrance
  engaged: number;            // monsters already fighting the party
  bossNear: boolean;
  safe: boolean;              // inside a claimed zone, an ambush or a hold-out in progress
}

export function eventAllowed(c: EventContext): boolean {
  return c.overworldSeconds >= 180 && !c.sailing && c.tilesFromStart >= 60 && c.tilesFromTown >= 24 && c.engaged <= 8 && !c.bossNear && !c.safe;
}
