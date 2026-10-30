import { describe, expect, it } from 'vitest';
import { aimOf, handInPlace, nearestPlace, nextTarget, type AimEnv, type AimPlace } from '../src/core/quest/aim';
import { compass } from '../src/core/quest/text';
import type { ActiveQuest, QuestDef } from '../src/core/quest/quests';

const place = (id: string, tx: number, ty: number): AimPlace => ({ id, name: `Place ${id}`, tx, ty });
const A = place('a', 100, 0), B = place('b', -40, 30), C = place('c', 500, 500), CAVE = place('cave', 0, -80);
const all = new Map([A, B, C, CAVE].map((p) => [p.id, p]));
const env = (visited: AimPlace[] = [A, B], any: AimPlace | null = C): AimEnv => ({
  place: (id) => all.get(id) ?? null,
  townOf: (def) => (def.town ? all.get(def.town) ?? null : null),
  visited: () => visited,
  nearestTown: () => any
});
const def = (over: Partial<QuestDef>): QuestDef => ({ id: 'q', title: 'Q', summary: '', kind: 'bounty', giver: 'board', objectives: [], rewards: {}, ...over });
const active = (progress: number[], targets: (string | null)[]): ActiveQuest => ({ progress, targets, startedAt: 0 });
const from = { tx: 0, ty: 0 };

describe('aimOf', () => {
  it('measures tiles and points where the place appears on the tilted screen', () => {
    expect(aimOf(from, { tx: 10, ty: 0 })).toEqual({ tiles: 10, angle: 0 });
    expect(aimOf(from, { tx: 0, ty: 10 }).angle).toBeCloseTo(Math.PI / 2);
    expect(aimOf(from, { tx: -10, ty: 0 }).angle).toBeCloseTo(Math.PI);
    expect(aimOf(from, { tx: 0, ty: -10 }).angle).toBeCloseTo(-Math.PI / 2);
  });

  it('squashes the north-south part by the tilt, so a diagonal leans toward east or west', () => {
    const flat = Math.atan2(10, 10), a = aimOf(from, { tx: 10, ty: 10 }, 0.6);
    expect(a.tiles).toBe(14);
    expect(a.angle).toBeCloseTo(Math.atan2(6, 10));
    expect(a.angle).toBeLessThan(flat);
    expect(aimOf(from, { tx: -10, ty: -10 }, 0.6).angle).toBeCloseTo(Math.atan2(-6, -10));
  });

  it('counts distance on the flat map, not the screen', () => {
    expect(aimOf({ tx: 3, ty: 4 }, { tx: 0, ty: 0 }).tiles).toBe(5);
  });
});

describe('compass', () => {
  it('names the eight points, y pointing south', () => {
    expect([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map(([x, y]) => compass(x, y)))
      .toEqual(['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast']);
  });
});

describe('nearestPlace', () => {
  it('picks the closest, and nothing from an empty list', () => {
    expect(nearestPlace(from, [A, B, C])?.id).toBe('b');
    expect(nearestPlace(from, [])).toBeNull();
  });
});

describe('what a quest points at', () => {
  const enter = (target = { kind: 'cave' as const }) => ({ type: 'enter' as const, target });

  it('is the first open objective that has a place', () => {
    const d = def({ objectives: [{ type: 'kill', count: 5 }, enter(), enter()] });
    expect(nextTarget(d, active([0, 0, 0], [null, 'cave', 'a']), from, env())).toEqual({ place: CAVE, why: 'objective' });
    expect(nextTarget(d, active([0, 1, 0], [null, 'cave', 'a']), from, env())).toEqual({ place: A, why: 'objective' });
  });

  it('points nowhere for a quest that only asks for kills or gathering', () => {
    expect(nextTarget(def({ objectives: [{ type: 'kill', count: 5 }] }), active([2], [null]), from, env())).toBeNull();
    expect(nextTarget(def({ objectives: [{ type: 'gather', resource: 'wood', count: 5 }] }), active([0], [null]), from, env())).toBeNull();
  });

  it('points nowhere while a place is still not known (a place that only exists once built)', () => {
    expect(nextTarget(def({ objectives: [enter()] }), active([0], [null]), from, env())).toBeNull();
  });

  it('turns to the hand-in once everything is done: the nearest town the party knows for the Elder, a board or an inn', () => {
    for (const giver of ['elder', 'board', 'inn']) {
      const d = def({ giver, objectives: [enter()] });
      expect(nextTarget(d, active([1], ['cave']), from, env())).toEqual({ place: B, why: 'hand-in' });     // B (50 away) beats A (100)
      expect(nextTarget(d, active([1], ['cave']), { tx: 90, ty: 0 }, env())).toEqual({ place: A, why: 'hand-in' });
    }
  });

  it('sends a townsperson\'s job back to its own town, however near another is', () => {
    const d = def({ kind: 'job', giver: 'townsfolk', town: 'a', objectives: [enter()] });
    expect(nextTarget(d, active([1], ['cave']), { tx: -40, ty: 30 }, env())).toEqual({ place: A, why: 'hand-in' });
    expect(handInPlace(def({ giver: 'townsfolk' }), from, env())).toEqual(B);       // no town recorded: the nearest known one
  });

  it('counts a hand-over as hand-in work, not as an open objective', () => {
    const d = def({ giver: 'elder', objectives: [{ type: 'deliver', resource: 'wood', count: 10 }] });
    expect(nextTarget(d, active([0], [null]), from, env())).toEqual({ place: B, why: 'hand-in' });
  });

  it('finds the Elder: the nearest known town, and any town when none has been entered yet', () => {
    const d = def({ kind: 'main', giver: 'elder', objectives: [{ type: 'talk', npc: 'elder' }] });
    expect(nextTarget(d, active([0], [null]), from, env())).toEqual({ place: B, why: 'objective' });
    expect(nextTarget(d, active([0], [null]), from, env([], C))).toEqual({ place: C, why: 'objective' });
    expect(nextTarget(d, active([0], [null]), from, env([], null))).toBeNull();
  });

  it('falls back to a town the party has not seen when none is known and a quest is done', () => {
    expect(handInPlace(def({ giver: 'board' }), from, env([], C))).toEqual(C);
  });
});
