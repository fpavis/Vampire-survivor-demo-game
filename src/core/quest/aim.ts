// Where a quest wants the party to go next, as a direction and a distance. Pure: the runtime says where things are.
import { goalOf, type ActiveQuest, type ObjectiveDef, type QuestDef } from './quests';

export interface Tile { tx: number; ty: number }
export interface AimPlace extends Tile { id: string; name: string }
/** 'objective': a place the quest sends the party to. 'hand-in': where it is handed in once it is done. */
export type AimWhy = 'objective' | 'hand-in';
export interface AimTarget { place: AimPlace; why: AimWhy }

/** The runtime's knowledge of the world. */
export interface AimEnv {
  place(id: string): AimPlace | null;           // a place an objective resolved to
  townOf(def: QuestDef): AimPlace | null;       // the town a job belongs to (where it is handed in)
  visited(): AimPlace[];                        // towns the party has entered
  nearestTown(from: Tile): AimPlace | null;     // a town, seen or not (found from the seeded world)
}

const hasTarget = (o: ObjectiveDef): o is ObjectiveDef & { target: unknown } => 'target' in o;

/** How far and which way, on the tilted ground: the angle is where the place appears on the screen (0 = right, clockwise). */
export function aimOf(from: Tile, to: Tile, tilt = 0.6): { tiles: number; angle: number } {
  const dx = to.tx - from.tx, dy = to.ty - from.ty;
  return { tiles: Math.round(Math.hypot(dx, dy)), angle: Math.atan2(dy * tilt, dx) };
}

export function nearestPlace(from: Tile, places: AimPlace[]): AimPlace | null {
  let best: AimPlace | null = null, bd = Infinity;
  for (const p of places) {
    const d = Math.hypot(p.tx - from.tx, p.ty - from.ty);
    if (d < bd) { best = p; bd = d; }
  }
  return best;
}

/** An Elder lives in every town: the nearest one the party knows, else any town, seen or not. */
export function elderPlace(from: Tile, env: AimEnv): AimPlace | null {
  return nearestPlace(from, env.visited()) ?? env.nearestTown(from);
}

/** Where a finished quest is handed in: the Elder, a board or an inn is in every town, a job is back at its own town. */
export function handInPlace(def: QuestDef, from: Tile, env: AimEnv): AimPlace | null {
  if (def.giver === 'townsfolk') return env.townOf(def) ?? nearestPlace(from, env.visited());
  return elderPlace(from, env);
}

/** The first open objective that points at a place; when everything is done, the place to hand it in. */
export function nextTarget(def: QuestDef, q: ActiveQuest, from: Tile, env: AimEnv): AimTarget | null {
  for (let i = 0; i < def.objectives.length; i++) {
    const o = def.objectives[i];
    if (o.type === 'deliver' || q.progress[i] >= goalOf(o)) continue;
    const place = o.type === 'talk' ? elderPlace(from, env)             // "speak with the Elder"
      : hasTarget(o) && q.targets[i] ? env.place(q.targets[i]!) : null;
    if (place) return { place, why: 'objective' };
  }
  const open = def.objectives.some((o, i) => o.type !== 'deliver' && q.progress[i] < goalOf(o));
  if (open) return null;                        // kills, gathering and the like point nowhere in particular
  const place = handInPlace(def, from, env);
  return place ? { place, why: 'hand-in' } : null;
}
