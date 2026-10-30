// Bounty boards: every town offers a few side quests, rotating every twenty minutes of play. They are generated
// from templates and the board's own surroundings, deterministically, so a town always posts the same bounties.
import { hash } from '../world/noise';
import { ENEMY_TYPES } from '../config';
import { ROSTERS } from '../world/biomes';
import { GROUP_NAMES, pluralName } from './text';
import type { QuestDef, Resource } from './quests';

export interface BoardInfo { id: string; group: string; level: number; tx: number; ty: number }

export const BOUNTY_SLOTS = 4;
export const BOUNTY_EPOCH_SECONDS = 1200;
export const epochOf = (playSeconds: number): number => Math.floor(playSeconds / BOUNTY_EPOCH_SECONDS);
export const bountyId = (board: string, epoch: number, slot: number): string => `b:${board}:${epoch}:${slot}`;

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const RESOURCE_BY_GROUP: Record<string, Resource[]> = {
  field: ['wood', 'stone'], forest: ['wood', 'iron'], desert: ['stone', 'iron'], shore: ['wood', 'stone'], mountain: ['stone', 'iron']
};

const BUILD_KINDS: { kind: string; title: string; summary: string; bonus: number }[] = [
  { kind: 'beacon', title: 'A Light in the Dark', summary: 'Raise a beacon so travellers can find their way.', bonus: 1 },
  { kind: 'waypoint', title: 'Open Roads', summary: 'Build a waypoint and shorten the long journeys.', bonus: 1.4 },
  { kind: 'spire', title: 'Arcane Watch', summary: 'Raise a spire; the town will sleep easier.', bonus: 1.8 }
];

const pick = <A,>(arr: readonly A[], h: number): A => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

/** The four bounties a board posts in a rotation. Slots 0..3 are kill, gather, explore, and build-or-survive. */
export function boardBounties(seed: number, board: BoardInfo, epoch: number): QuestDef[] {
  const out: QuestDef[] = [];
  const lvl = Math.max(1, board.level);
  const h = (slot: number, n: number) => hash(slot * 31 + n, epoch + 7, seed + 8100 + board.tx * 3 + board.ty);
  const near = { tx: board.tx, ty: board.ty };
  const base = (slot: number): Pick<QuestDef, 'id' | 'kind' | 'giver' | 'level'> => ({ id: bountyId(board.id, epoch, slot), kind: 'bounty', giver: 'board', level: lvl });

  // 0: cull monsters of the region
  {
    const roster = (ROSTERS[board.group] ?? ROSTERS.field).filter((r) => r.level <= Math.max(1, lvl));
    const entry = pick(roster.length ? roster : ROSTERS.field, h(0, 1));
    const count = 12 + Math.floor(h(0, 2) * 14);
    const name = ENEMY_TYPES[entry.type]?.name ?? entry.type;
    out.push({
      ...base(0), title: `Cull the ${pluralName(name)}`, summary: `${pluralName(name)} are troubling the ${GROUP_NAMES[board.group] ?? 'land'}. Thin them out.`,
      objectives: [{ type: 'kill', count, enemy: entry.type }],
      rewards: { gold: round5(count * (3 + lvl * 0.6)), xp: Math.round(count * (1 + lvl * 0.25)) }
    });
  }
  // 1: gather materials
  {
    const res = pick(RESOURCE_BY_GROUP[board.group] ?? ['wood'], h(1, 1));
    const count = 8 + Math.floor(h(1, 2) * 9);
    out.push({
      ...base(1), title: `Supplies: ${res}`, summary: `The town needs ${res}. Chop, mine or loot it, then bring it to the board.`,
      objectives: [{ type: 'deliver', resource: res, count }],
      rewards: { gold: round5(count * (6 + lvl * 0.6)), xp: Math.round(count * 2) }
    });
  }
  // 2: explore: map a dungeon or clear one
  if (h(2, 1) < 0.5) {
    out.push({
      ...base(2), title: 'Scout the Depths', summary: 'Find the nearest dungeon so the guild can plan around it.',
      objectives: [{ type: 'discover', target: { kind: 'dungeon', nth: Math.floor(h(2, 2) * 3), near } }],
      rewards: { gold: round5(90 + lvl * 9), xp: 30 + lvl * 4 }
    });
  } else {
    out.push({
      ...base(2), title: 'Break the Dungeon', summary: 'A dungeon near the town spawns worse every season. Go down, find its boss, and end it.',
      objectives: [{ type: 'clear', target: { kind: 'dungeon', nth: Math.floor(h(2, 3) * 2), near } }],
      rewards: { gold: round5(240 + lvl * 22), xp: 120 + lvl * 12, loot: 1 }
    });
  }
  // 3: build a tower, or hold out
  if (h(3, 1) < 0.5) {
    const b = pick(BUILD_KINDS, h(3, 2));
    out.push({
      ...base(3), title: b.title, summary: b.summary,
      objectives: [{ type: 'build', kind: b.kind }],
      rewards: { gold: round5((110 + lvl * 9) * b.bonus), xp: Math.round(50 * b.bonus + lvl * 3) }
    });
  } else {
    const seconds = 60 + 15 * Math.floor(h(3, 3) * 5);
    out.push({
      ...base(3), title: 'Hold the Line', summary: 'Stay out in the wild and keep the monsters busy for a while.',
      objectives: [{ type: 'survive', seconds, group: board.group }],
      rewards: { gold: round5(50 + lvl * 6 + seconds * 0.5), xp: 20 + lvl * 3 }
    });
  }
  return out;
}
