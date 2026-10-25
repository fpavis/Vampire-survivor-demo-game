// Quest engine: data-defined quests, objectives that listen to game facts, rewards and prerequisites.
// Pure and deterministic. The runtime feeds it events and applies the rewards it returns.
import { ENEMY_TYPES } from '../config';
import { GROUP_NAMES } from './text';

export type Resource = 'gold' | 'wood' | 'stone' | 'iron';
export const RESOURCES: Resource[] = ['gold', 'wood', 'stone', 'iron'];

/** Which place an objective means. `nth` counts matching places by distance (0 = nearest) from `near`, or the start. */
export interface PlaceTarget {
  kind: 'dungeon' | 'town' | 'cave' | 'ruins' | 'any';
  group?: string;                       // region: field, forest, desert, shore, mountain
  realm?: 'land' | 'plateau' | 'sea';   // dungeons only; plateau and sea ones are found by id once they exist
  nth?: number;
  near?: { tx: number; ty: number };
}

export type ObjectiveDef =
  | { type: 'talk'; npc: string; text?: string }
  | { type: 'kill'; count: number; enemy?: string; group?: string; text?: string }
  | { type: 'killBoss'; count: number; text?: string }
  | { type: 'discover'; target: PlaceTarget; text?: string }
  | { type: 'enter'; target: PlaceTarget; text?: string }
  | { type: 'clear'; target: PlaceTarget; text?: string }
  | { type: 'gather'; resource: Resource; count: number; text?: string }
  | { type: 'deliver'; resource: Resource; count: number; text?: string }
  | { type: 'survive'; seconds: number; group?: string; text?: string }
  | { type: 'build'; kind: string; text?: string };

export interface Rewards {
  gold?: number;
  xp?: number;
  loot?: number;                         // loot tier handed out as skill picks (see grantLoot)
  resources?: Partial<Record<Resource, number>>;
  flags?: string[];
}

export interface QuestDef {
  id: string;
  title: string;
  summary: string;
  kind: 'main' | 'bounty';
  giver: string;                         // 'elder' | 'board'
  chapter?: string;
  level?: number;                        // recommended hero level
  prerequisites?: { quests?: string[]; flags?: string[]; minLevel?: number };
  objectives: ObjectiveDef[];
  rewards: Rewards;
  dialogue?: { offer?: string; turnIn?: string; hint?: string };
}

export interface ActiveQuest {
  progress: number[];                    // per objective: a count, seconds, or 0 / 1
  targets: (string | null)[];            // per objective: the place it resolved to (place objectives)
  startedAt: number;
  def?: QuestDef;                        // kept for generated quests (bounties); main quests live in the data
}

export interface QuestState {
  active: Record<string, ActiveQuest>;
  done: string[];
  flags: Record<string, number | boolean>;
  tracked: string | null;
  bounties: Record<string, { epoch: number; taken: string[] }>;   // per board: which rotation and which slots were accepted
}

export const newQuestState = (): QuestState => ({ active: {}, done: [], flags: {}, tracked: null, bounties: {} });

export interface PlaceFacts { id: string; type: string; group: string; dungeon?: { realm: string } }

export type QuestEvent =
  | { type: 'talk'; npc: string }
  | { type: 'kill'; enemy: string; group: string; boss: boolean }
  | { type: 'discover'; poi: PlaceFacts }
  | { type: 'enter'; poi: PlaceFacts }
  | { type: 'clear'; poi: PlaceFacts }
  | { type: 'gather'; resource: Resource; count: number }
  | { type: 'survive'; seconds: number; group: string }
  | { type: 'build'; kind: string };

export interface QuestUpdate { quest: string; index: number; before: number; after: number; objectiveDone: boolean; ready: boolean }

export type DefLookup = (id: string) => QuestDef | undefined;

// ----------------------------------------------------------------- objectives
export function goalOf(o: ObjectiveDef): number {
  switch (o.type) {
    case 'kill': case 'killBoss': case 'gather': case 'deliver': return o.count;
    case 'survive': return o.seconds;
    default: return 1;
  }
}

const placeMatches = (t: PlaceTarget, poi: PlaceFacts, resolved: string | null): boolean => {
  if (resolved) return poi.id === resolved;
  if (t.kind === 'dungeon' && !poi.dungeon) return false;
  if (t.kind === 'town' && poi.type !== 'city') return false;
  if ((t.kind === 'cave' || t.kind === 'ruins') && poi.type !== t.kind) return false;
  if (t.realm && (poi.dungeon?.realm ?? 'land') !== t.realm) return false;
  if (t.group && poi.group !== t.group) return false;
  return true;
};

/** How far an event moves one objective (0 when it is not relevant). */
function gain(o: ObjectiveDef, target: string | null, ev: QuestEvent): number {
  switch (o.type) {
    case 'talk': return ev.type === 'talk' && ev.npc === o.npc ? 1 : 0;
    case 'kill':
      if (ev.type !== 'kill') return 0;
      if (o.enemy && ev.enemy !== o.enemy) return 0;
      if (o.group && ev.group !== o.group) return 0;
      return 1;
    case 'killBoss': return ev.type === 'kill' && ev.boss ? 1 : 0;
    case 'discover': return ev.type === 'discover' && placeMatches(o.target, ev.poi, target) ? 1 : 0;
    case 'enter': return ev.type === 'enter' && placeMatches(o.target, ev.poi, target) ? 1 : 0;
    case 'clear': return ev.type === 'clear' && placeMatches(o.target, ev.poi, target) ? 1 : 0;
    case 'gather': return ev.type === 'gather' && ev.resource === o.resource ? ev.count : 0;
    case 'survive': return ev.type === 'survive' && (!o.group || ev.group === o.group) ? ev.seconds : 0;
    case 'build': return ev.type === 'build' && ev.kind === o.kind ? 1 : 0;
    default: return 0;   // deliver is settled at turn-in
  }
}

export const defOf = (state: QuestState, lookup: DefLookup, id: string): QuestDef | undefined => state.active[id]?.def ?? lookup(id);

/** Every objective but the hand-overs is met; the quest can be turned in once the hand-overs can be paid. */
export function isReady(state: QuestState, def: QuestDef): boolean {
  const q = state.active[def.id];
  if (!q) return false;
  return def.objectives.every((o, i) => o.type === 'deliver' || q.progress[i] >= goalOf(o));
}

/** Feed one fact to every active quest. Returns what moved (for toasts and the tracker). */
export function applyEvent(state: QuestState, lookup: DefLookup, ev: QuestEvent): QuestUpdate[] {
  const out: QuestUpdate[] = [];
  for (const id of Object.keys(state.active)) {
    const def = defOf(state, lookup, id);
    const q = state.active[id];
    if (!def) continue;
    def.objectives.forEach((o, i) => {
      const goal = goalOf(o);
      if (q.progress[i] >= goal) return;
      const g = gain(o, q.targets[i] ?? null, ev);
      if (!g) return;
      const before = q.progress[i];
      q.progress[i] = Math.min(goal, before + g);
      out.push({ quest: id, index: i, before, after: q.progress[i], objectiveDone: q.progress[i] >= goal, ready: isReady(state, def) });
    });
  }
  return out;
}

// ------------------------------------------------------------------ starting
export interface StartContext { level: number }

export function prerequisitesMet(state: QuestState, def: QuestDef, ctx: StartContext): boolean {
  const p = def.prerequisites;
  if (!p) return true;
  if (p.quests && !p.quests.every((q) => state.done.includes(q))) return false;
  if (p.flags && !p.flags.every((f) => !!state.flags[f])) return false;
  if (p.minLevel && ctx.level < p.minLevel) return false;
  return true;
}

export const isActive = (s: QuestState, id: string) => !!s.active[id];
export const isDone = (s: QuestState, id: string) => s.done.includes(id);

export function canStart(state: QuestState, def: QuestDef, ctx: StartContext): boolean {
  return !isActive(state, def.id) && !isDone(state, def.id) && prerequisitesMet(state, def, ctx);
}

/** Begin a quest. `resolve` turns a place target into a concrete place id (or null when any match will do). */
export function startQuest(state: QuestState, def: QuestDef, now: number, ctx: StartContext, resolve: (t: PlaceTarget) => string | null = () => null): boolean {
  if (!canStart(state, def, ctx)) return false;
  state.active[def.id] = {
    progress: def.objectives.map(() => 0),
    targets: def.objectives.map((o) => ('target' in o ? resolve(o.target) : null)),
    startedAt: now,
    ...(def.kind === 'bounty' ? { def } : {})
  };
  if (!state.tracked) state.tracked = def.id;
  return true;
}

export function abandonQuest(state: QuestState, id: string): boolean {
  const def = state.active[id]?.def;
  if (!state.active[id] || (state.active[id] && !def)) return false;     // story quests cannot be dropped
  delete state.active[id];
  if (state.tracked === id) state.tracked = Object.keys(state.active)[0] ?? null;
  return true;
}

// ----------------------------------------------------------------- turning in
export interface TurnIn { ok: boolean; reason?: string; consume: Partial<Record<Resource, number>>; rewards: Rewards }

/** Check the hand-overs against what the party carries; on success the quest is done and its flags are set. */
export function turnIn(state: QuestState, lookup: DefLookup, id: string, wallet: Record<Resource, number>): TurnIn {
  const def = defOf(state, lookup, id);
  const none: TurnIn = { ok: false, consume: {}, rewards: {} };
  if (!def || !state.active[id]) return { ...none, reason: 'That quest is not active' };
  if (!isReady(state, def)) return { ...none, reason: 'There is still work to do' };
  const consume: Partial<Record<Resource, number>> = {};
  for (const o of def.objectives) if (o.type === 'deliver') consume[o.resource] = (consume[o.resource] ?? 0) + o.count;
  for (const r of RESOURCES) if ((consume[r] ?? 0) > wallet[r]) return { ...none, consume, reason: `You need ${consume[r]} ${r}` };
  delete state.active[id];
  state.done.push(id);
  for (const f of def.rewards.flags ?? []) state.flags[f] = true;
  if (state.tracked === id) state.tracked = Object.keys(state.active)[0] ?? null;
  return { ok: true, consume, rewards: def.rewards };
}

/** Main quests that are offered next (all prerequisites met, not started, not done), in chain order. */
export function availableQuests(state: QuestState, defs: readonly QuestDef[], giver: string, ctx: StartContext): QuestDef[] {
  return defs.filter((d) => d.giver === giver && canStart(state, d, ctx));
}

// --------------------------------------------------------------------- flags
export const setFlag = (s: QuestState, f: string, v: number | boolean = true) => { s.flags[f] = v; };
export const hasFlag = (s: QuestState, f: string) => !!s.flags[f];

// ---------------------------------------------------------------- description
export interface TextNames { place: (target: PlaceTarget, resolved: string | null) => string }

const plural = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);
const enemyName = (key: string) => ENEMY_TYPES[key]?.name ?? key;

/** "Defeat 20 Wolves", "Clear Gloom Depths" ... the objective as a sentence (without the count of progress). */
export function describeObjective(o: ObjectiveDef, names: TextNames, resolved: string | null = null): string {
  if (o.text) return o.text;
  switch (o.type) {
    case 'talk': return `Speak with the ${o.npc}`;
    case 'kill': return `Defeat ${o.count} ${o.enemy ? plural(o.count, enemyName(o.enemy)) : o.group ? `monsters in the ${GROUP_NAMES[o.group] ?? o.group}` : 'monsters'}`;
    case 'killBoss': return `Defeat ${o.count} ${plural(o.count, 'warlord')}`;
    case 'discover': return `Find ${names.place(o.target, resolved)}`;
    case 'enter': return `Enter ${names.place(o.target, resolved)}`;
    case 'clear': return `Clear ${names.place(o.target, resolved)}`;
    case 'gather': return `Collect ${o.count} ${o.resource}`;
    case 'deliver': return `Bring ${o.count} ${o.resource}`;
    case 'survive': return `Survive ${o.seconds} seconds${o.group ? ` in the ${GROUP_NAMES[o.group] ?? o.group}` : ' out in the world'}`;
    case 'build': return `Build a ${o.kind === 'climb' ? 'climbing tower' : o.kind === 'spire' ? 'spire' : o.kind}`;
  }
}

/** "7 / 20" for counted objectives, a tick for the rest. */
export function progressText(o: ObjectiveDef, value: number): string {
  const goal = goalOf(o);
  if (value >= goal) return '✔';
  return goal > 1 ? `${Math.floor(value)} / ${goal}` : '';
}
