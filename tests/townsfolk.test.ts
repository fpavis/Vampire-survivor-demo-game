import { describe, expect, it } from 'vitest';
import {
  REP_TIERS, addRep, applyEvent, describeObjective, isReady, newQuestState, repOf, repTier, startQuest, townOfQuest, turnIn, withRep,
  type PlaceTarget, type QuestState
} from '../src/core/quest/quests';
import { bountyId } from '../src/core/quest/bounties';
import { innRumour, jobId, jobSlot, jobThanks, relicIcon, rumourFee, rumourId, townJob } from '../src/core/quest/townsfolk';
import { findPlace } from '../src/core/quest/places';
import { OverworldSource } from '../src/core/world/terrain';

const ctx = { level: 5 };
const wallet = { gold: 0, wood: 0, stone: 0, iron: 0 };
const none = () => undefined;
const names = { place: (t: PlaceTarget, r: string | null) => r ?? `a ${t.kind}` };
const town = { id: '3,4', group: 'forest', level: 10, tx: 60, ty: -40 };

describe('townsfolk jobs', () => {
  it('one job per town and rotation, always the same, and a new one later', () => {
    const a = townJob(2024, town, 3), b = townJob(2024, town, 3);
    expect(a).toEqual(b);
    expect(a.id).toBe(jobId('3,4', 3));
    expect(a.kind).toBe('job');
    expect(a.giver).toBe('townsfolk');
    expect(a.town).toBe('3,4');
    const all = Array.from({ length: 12 }, (_, e) => JSON.stringify(townJob(2024, town, e).objectives));
    expect(new Set(all).size).toBeGreaterThan(2);
  });

  it('asks for a fetch, an escort or a cull, all of them over many rotations', () => {
    const seen = new Set<string>();
    for (let e = 0; e < 60; e++) for (const o of townJob(7, town, e).objectives) seen.add(o.type);
    expect([...seen].sort()).toEqual(['escort', 'fetch', 'kill']);
  });

  it('fetch jobs send you to the nearest cave or ruins, escorts to the next town; the text names it', () => {
    for (let e = 0; e < 40; e++) {
      const def = townJob(7, town, e), o = def.objectives[0];
      if (o.type === 'fetch') { expect(['cave', 'ruins']).toContain(o.target.kind); expect(o.target.nth).toBe(0); expect(def.summary).toContain('{place}'); }
      if (o.type === 'escort') { expect(o.target).toEqual({ kind: 'town', nth: 1, near: { tx: 60, ty: -40 } }); expect(def.summary).toContain('{place}'); }
      if (o.type === 'kill') expect(o.group).toBe('forest');
    }
  });

  it('pays more in higher lands', () => {
    for (let e = 0; e < 10; e++) {
      const lo = townJob(9, { ...town, level: 1 }, e), hi = townJob(9, { ...town, level: 50 }, e);
      expect(hi.rewards.gold!).toBeGreaterThan(lo.rewards.gold!);
      expect(hi.rewards.xp!).toBeGreaterThan(lo.rewards.xp!);
    }
  });

  it('a villager of the town asks, or nobody when there are none', () => {
    for (let e = 0; e < 20; e++) { const s = jobSlot(5, town, e, 6); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(6); }
    expect(jobSlot(5, town, 0, 0)).toBe(-1);
  });

  it('a fetch job is done by picking the thing up; an escort by arriving with the traveller', () => {
    let fetch, escort;
    for (let e = 0; e < 60 && (!fetch || !escort); e++) {
      const d = townJob(7, town, e);
      if (d.objectives[0].type === 'fetch') fetch ??= d;
      if (d.objectives[0].type === 'escort') escort ??= d;
    }
    const s = newQuestState();
    expect(startQuest(s, fetch!, 0, ctx, () => 'cave-1')).toBe(true);
    const o = fetch!.objectives[0];
    if (o.type !== 'fetch') throw new Error('not a fetch');
    applyEvent(s, none, { type: 'fetch', item: 'something else' });
    expect(isReady(s, fetch!)).toBe(false);
    applyEvent(s, none, { type: 'fetch', item: o.item });
    expect(isReady(s, fetch!)).toBe(true);
    expect(relicIcon(o.item)).not.toBe('scroll');
    expect(jobThanks(fetch!)).toContain(o.item);

    expect(startQuest(s, escort!, 0, ctx, () => 'town-2')).toBe(true);
    const eo = escort!.objectives[0];
    if (eo.type !== 'escort') throw new Error('not an escort');
    applyEvent(s, none, { type: 'arrive', npc: eo.npc, poi: { id: 'town-9', type: 'city', group: 'field' } });   // the wrong town
    applyEvent(s, none, { type: 'arrive', npc: 'someone else', poi: { id: 'town-2', type: 'city', group: 'field' } });
    expect(isReady(s, escort!)).toBe(false);
    applyEvent(s, none, { type: 'arrive', npc: eo.npc, poi: { id: 'town-2', type: 'city', group: 'field' } });
    expect(isReady(s, escort!)).toBe(true);
    expect(turnIn(s, none, escort!.id, wallet).ok).toBe(true);
  });

  it('jobs keep their own definition through a save, and can be dropped', () => {
    const s = newQuestState();
    const def = { ...townJob(7, town, 1), npc: 2 };
    startQuest(s, def, 0, ctx, () => 'place-1');
    const back: QuestState = JSON.parse(JSON.stringify(s));
    expect(back.active[def.id].def).toEqual(def);
  });

  it('read as sentences', () => {
    expect(describeObjective({ type: 'fetch', item: 'a silver locket', target: { kind: 'cave' } }, names, 'Bat Hollow')).toBe('Recover a silver locket from Bat Hollow');
    expect(describeObjective({ type: 'escort', npc: 'Old Wren', target: { kind: 'town' } }, names, 'Ashford')).toBe('Escort Old Wren to Ashford');
  });

  it('generated around a real town, every place a job names exists', () => {
    const src = new OverworldSource(2024);
    const t = findPlace(src, { kind: 'town', nth: 2 })!;
    for (let e = 0; e < 20; e++) {
      const def = townJob(2024, { id: t.id, group: t.group, level: 8, tx: t.tx, ty: t.ty }, e);
      const o = def.objectives[0];
      if ('target' in o) { const p = findPlace(src, o.target); expect(p, def.title).not.toBeNull(); if (o.type === 'escort') expect(p!.id).not.toBe(t.id); }
    }
  });
});

describe('inn rumours', () => {
  it('ask to clear the place named, paid at any inn, more for a dungeon', () => {
    const cave = innRumour(town, 2, { id: 'c1', name: 'Bat Hollow', kind: 'cave' });
    const dun = innRumour(town, 2, { id: 'd1', name: 'Gloom Depths', kind: 'dungeon' });
    expect(cave.id).toBe(rumourId('3,4', 2));
    expect(cave.giver).toBe('inn');
    expect(cave.objectives[0]).toMatchObject({ type: 'clear', target: { kind: 'cave' }, text: 'Clear Bat Hollow' });
    expect(dun.rewards.gold!).toBeGreaterThan(cave.rewards.gold!);
    expect(dun.rewards.loot).toBe(1);
    const s = newQuestState();
    startQuest(s, cave, 0, ctx, () => 'c1');
    applyEvent(s, none, { type: 'clear', poi: { id: 'c2', type: 'cave', group: 'forest' } });      // another cave does not count
    expect(isReady(s, cave)).toBe(false);
    applyEvent(s, none, { type: 'clear', poi: { id: 'c1', type: 'cave', group: 'forest' } });
    expect(isReady(s, cave)).toBe(true);
  });

  it('marking the place costs a little more in higher lands', () => {
    expect(rumourFee(1)).toBeGreaterThan(0);
    expect(rumourFee(40)).toBeGreaterThan(rumourFee(1));
    expect(rumourFee(7) % 5).toBe(0);
  });
});

describe('reputation', () => {
  it('climbs through four tiers by bounties and jobs done', () => {
    expect(REP_TIERS.map((t) => t.name)).toEqual(['Stranger', 'Known', 'Trusted', 'Hero']);
    expect(repTier(0).name).toBe('Stranger');
    expect(repTier(2).name).toBe('Stranger');
    expect(repTier(3).name).toBe('Known');
    expect(repTier(8).name).toBe('Trusted');
    expect(repTier(15).name).toBe('Hero');
    expect(repTier(99).name).toBe('Hero');
    expect(repTier(4).next?.name).toBe('Trusted');
    expect(repTier(15).next).toBeNull();
  });

  it('perks grow with the tier: bounty gold, market prices, a free bed', () => {
    const tiers = [0, 3, 8, 15].map(repTier);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].bonus).toBeGreaterThan(tiers[i - 1].bonus);
      expect(tiers[i].discount).toBeGreaterThanOrEqual(tiers[i - 1].discount);
    }
    expect(tiers.map((t) => t.freeInn)).toEqual([false, false, false, true]);
    expect(withRep({ gold: 100, xp: 10 }, repTier(8))).toEqual({ gold: 120, xp: 10 });
    expect(withRep({ xp: 10 }, repTier(15))).toEqual({ xp: 10 });
    expect(withRep({ gold: 100 }, repTier(0))).toEqual({ gold: 100 });
  });

  it('is kept per town, and found from the quest that earned it', () => {
    const s = newQuestState();
    addRep(s, 'a'); addRep(s, 'a'); addRep(s, 'b', 3);
    expect(repOf(s, 'a')).toBe(2);
    expect(repOf(s, 'b')).toBe(3);
    expect(repOf(s, 'c')).toBe(0);
    expect(townOfQuest(bountyId('12,-3', 4, 1))).toBe('12,-3');
    expect(townOfQuest('j:x', townJob(1, town, 0))).toBe('3,4');
    expect(townOfQuest('m0_omen')).toBeNull();
  });

  it('old saves without it start at nothing, and it survives a round trip', () => {
    const old = { active: {}, done: [], flags: {}, tracked: null, bounties: {} } as QuestState;
    expect(repOf(old, 'a')).toBe(0);
    addRep(old, 'a');
    const back: QuestState = JSON.parse(JSON.stringify(old));
    expect(repOf(back, 'a')).toBe(1);
  });
});
