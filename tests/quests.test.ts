import { describe, expect, it } from 'vitest';
import {
  abandonQuest, applyEvent, availableQuests, canStart, describeObjective, goalOf, isReady, newQuestState, prerequisitesMet, progressText,
  startQuest, turnIn, type PlaceTarget, type QuestDef, type QuestEvent, type QuestState
} from '../src/core/quest/quests';
import { BOUNTY_SLOTS, boardBounties, bountyId, epochOf } from '../src/core/quest/bounties';
import { findPlace } from '../src/core/quest/places';
import { bearing } from '../src/core/quest/text';
import { DialogueRunner, type DialogueContext, type DialogueScript, type Effect } from '../src/core/story/dialogue';
import { CHAPTERS, DEMON_LORDS, DIALOGUES, MAIN_BY_ID, MAIN_QUESTS, bossTitle, currentMainQuest, elderScript, lookupMain } from '../src/core/story/story';
import { OverworldSource } from '../src/core/world/terrain';
import { ENEMY_TYPES } from '../src/core/config';
import { ROSTERS } from '../src/core/world/biomes';

const ctx = { level: 5 };
const wallet = (over: Partial<Record<'gold' | 'wood' | 'stone' | 'iron', number>> = {}) => ({ gold: 0, wood: 0, stone: 0, iron: 0, ...over });
const names = { place: (t: PlaceTarget, r: string | null) => r ?? `a ${t.kind}` };

const kill = (n = 1, enemy = 'SLIME', boss = false): QuestEvent[] => Array.from({ length: n }, () => ({ type: 'kill', enemy, group: 'field', boss }));
const poi = (id: string, group = 'field', dungeon = true) => ({ id, type: 'cave', group, ...(dungeon ? { dungeon: { realm: 'land' } } : {}) });

const sample: QuestDef = {
  id: 't1', title: 'Test', summary: 'A test.', kind: 'bounty', giver: 'board',
  objectives: [{ type: 'kill', count: 3, enemy: 'SLIME' }, { type: 'gather', resource: 'wood', count: 5 }, { type: 'build', kind: 'beacon' }],
  rewards: { gold: 50, xp: 20, flags: ['t1.done'] }
};
const lookup = (id: string) => (id === 't1' ? sample : lookupMain(id));

describe('quest engine', () => {
  it('counts kills of the right kind and caps at the goal', () => {
    const s = newQuestState();
    expect(startQuest(s, sample, 0, ctx)).toBe(true);
    kill(2, 'WOLF').forEach((e) => applyEvent(s, lookup, e));
    expect(s.active.t1.progress[0]).toBe(0);                       // wolves do not count
    kill(5).forEach((e) => applyEvent(s, lookup, e));
    expect(s.active.t1.progress[0]).toBe(3);
  });

  it('reports what moved, and when a quest becomes ready', () => {
    const s = newQuestState();
    startQuest(s, sample, 0, ctx);
    kill(3).forEach((e) => applyEvent(s, lookup, e));
    applyEvent(s, lookup, { type: 'gather', resource: 'wood', count: 9 });
    expect(isReady(s, sample)).toBe(false);
    const up = applyEvent(s, lookup, { type: 'build', kind: 'beacon' });
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ quest: 't1', index: 2, objectiveDone: true, ready: true });
    expect(isReady(s, sample)).toBe(true);
  });

  it('one fact can move several quests at once', () => {
    const s = newQuestState();
    const a: QuestDef = { ...sample, id: 'a', objectives: [{ type: 'kill', count: 2 }] };
    const b: QuestDef = { ...sample, id: 'b', objectives: [{ type: 'kill', count: 4 }] };
    const look = (id: string) => (id === 'a' ? a : b);
    startQuest(s, a, 0, ctx); startQuest(s, b, 0, ctx);
    const up = applyEvent(s, look, kill(1)[0]);
    expect(up.map((u) => u.quest).sort()).toEqual(['a', 'b']);
  });

  it('place objectives match a resolved place exactly, or any matching place when unresolved', () => {
    const target: PlaceTarget = { kind: 'dungeon', group: 'forest', nth: 0 };
    const def: QuestDef = { ...sample, id: 'p', objectives: [{ type: 'clear', target }] };
    const look = () => def;
    const resolved = newQuestState();
    startQuest(resolved, def, 0, ctx, () => 'D1');
    applyEvent(resolved, look, { type: 'clear', poi: poi('D2', 'forest') });
    expect(resolved.active.p.progress[0]).toBe(0);
    applyEvent(resolved, look, { type: 'clear', poi: poi('D1', 'forest') });
    expect(resolved.active.p.progress[0]).toBe(1);

    const loose = newQuestState();
    startQuest(loose, def, 0, ctx);
    applyEvent(loose, look, { type: 'clear', poi: poi('X', 'desert') });
    expect(loose.active.p.progress[0]).toBe(0);
    applyEvent(loose, look, { type: 'clear', poi: poi('Y', 'forest') });
    expect(loose.active.p.progress[0]).toBe(1);
  });

  it('a plateau target does not match land dungeons', () => {
    const def: QuestDef = { ...sample, id: 'q', objectives: [{ type: 'clear', target: { kind: 'dungeon', realm: 'plateau' } }] };
    const s = newQuestState();
    startQuest(s, def, 0, ctx);
    applyEvent(s, () => def, { type: 'clear', poi: poi('land', 'mountain') });
    expect(s.active.q.progress[0]).toBe(0);
    applyEvent(s, () => def, { type: 'clear', poi: { id: 'plat:1', type: 'ruins', group: 'mountain', dungeon: { realm: 'plateau' } } });
    expect(s.active.q.progress[0]).toBe(1);
  });

  it('survive counts seconds in the right region only', () => {
    const def: QuestDef = { ...sample, id: 's', objectives: [{ type: 'survive', seconds: 60, group: 'desert' }] };
    const s = newQuestState();
    startQuest(s, def, 0, ctx);
    applyEvent(s, () => def, { type: 'survive', seconds: 30, group: 'field' });
    applyEvent(s, () => def, { type: 'survive', seconds: 45, group: 'desert' });
    expect(s.active.s.progress[0]).toBe(45);
  });

  it('prerequisites: quests, flags and level', () => {
    const s = newQuestState();
    const def: QuestDef = { ...sample, id: 'gate', prerequisites: { quests: ['t0'], flags: ['f'], minLevel: 6 } };
    expect(canStart(s, def, ctx)).toBe(false);
    s.done.push('t0');
    expect(prerequisitesMet(s, def, ctx)).toBe(false);
    s.flags.f = true;
    expect(prerequisitesMet(s, def, ctx)).toBe(false);
    expect(prerequisitesMet(s, def, { level: 6 })).toBe(true);
    expect(availableQuests(s, [def], 'board', { level: 6 })).toHaveLength(1);
    startQuest(s, def, 0, { level: 6 });
    expect(canStart(s, def, { level: 6 })).toBe(false);          // already active
  });

  it('turning in pays hand-overs from the wallet, sets flags, and finishes the quest', () => {
    const s = newQuestState();
    const def: QuestDef = { ...sample, id: 'd', objectives: [{ type: 'deliver', resource: 'wood', count: 10 }, { type: 'deliver', resource: 'stone', count: 4 }], rewards: { gold: 80, flags: ['paid'] } };
    const look = () => def;
    startQuest(s, def, 0, ctx);
    expect(isReady(s, def)).toBe(true);                         // hand-overs are settled at the board
    const poor = turnIn(s, look, 'd', wallet({ wood: 10, stone: 2 }));
    expect(poor.ok).toBe(false);
    expect(poor.reason).toMatch(/stone/);
    expect(s.active.d).toBeDefined();
    const rich = turnIn(s, look, 'd', wallet({ wood: 12, stone: 4 }));
    expect(rich.ok).toBe(true);
    expect(rich.consume).toEqual({ wood: 10, stone: 4 });
    expect(rich.rewards.gold).toBe(80);
    expect(s.done).toContain('d');
    expect(s.flags.paid).toBe(true);
    expect(s.active.d).toBeUndefined();
    expect(turnIn(s, look, 'd', wallet({ wood: 99, stone: 99 })).ok).toBe(false);
  });

  it('cannot turn in unfinished work', () => {
    const s = newQuestState();
    startQuest(s, sample, 0, ctx);
    expect(turnIn(s, lookup, 't1', wallet()).ok).toBe(false);
  });

  it('only bounties can be abandoned, and the tracker moves on', () => {
    const s = newQuestState();
    startQuest(s, sample, 0, ctx);
    startQuest(s, MAIN_QUESTS[0], 0, ctx);                       // a story quest cannot start before its prerequisites...
    s.flags.begun = true;
    startQuest(s, MAIN_QUESTS[0], 0, ctx);
    expect(s.tracked).toBe('t1');
    expect(abandonQuest(s, 'm0_omen')).toBe(false);
    expect(abandonQuest(s, 't1')).toBe(true);
    expect(s.tracked).toBe('m0_omen');
  });

  it('quest state survives a JSON round trip, generated quests included', () => {
    const s = newQuestState();
    startQuest(s, sample, 12, ctx);
    kill(2).forEach((e) => applyEvent(s, lookup, e));
    s.flags.x = 3;
    const back: QuestState = JSON.parse(JSON.stringify(s));
    expect(back.active.t1.def?.title).toBe('Test');
    expect(back.active.t1.progress[0]).toBe(2);
    kill(1).forEach((e) => applyEvent(back, () => undefined, e));    // a bounty needs no data table: it carries its own definition
    expect(back.active.t1.progress[0]).toBe(3);
  });

  it('describes objectives as sentences', () => {
    expect(describeObjective({ type: 'kill', count: 20, enemy: 'WOLF' }, names)).toBe('Defeat 20 Wolfs'.replace('Wolfs', ENEMY_TYPES.WOLF.name + 's'));
    expect(describeObjective({ type: 'kill', count: 1, enemy: 'WOLF' }, names)).toBe(`Defeat 1 ${ENEMY_TYPES.WOLF.name}`);
    expect(describeObjective({ type: 'gather', resource: 'stone', count: 9 }, names)).toBe('Collect 9 stone');
    expect(describeObjective({ type: 'clear', target: { kind: 'dungeon' } }, names, 'Gloom Depths')).toBe('Clear Gloom Depths');
    expect(describeObjective({ type: 'kill', count: 2, text: 'Custom' }, names)).toBe('Custom');
    expect(progressText({ type: 'kill', count: 20 }, 7)).toBe('7 / 20');
    expect(progressText({ type: 'kill', count: 20 }, 20)).toBe('');
    expect(goalOf({ type: 'survive', seconds: 90 })).toBe(90);
  });
});

describe('story data', () => {
  it('quest ids are unique and every reference resolves', () => {
    const ids = new Set<string>();
    for (const q of MAIN_QUESTS) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      for (const p of q.prerequisites?.quests ?? []) expect(MAIN_BY_ID[p]).toBeDefined();
      for (const d of Object.values(q.dialogue ?? {})) expect(DIALOGUES[d!]).toBeDefined();
      expect(q.objectives.length).toBeGreaterThan(0);
      expect(q.rewards.gold).toBeGreaterThan(0);
    }
    for (const c of CHAPTERS) expect(MAIN_BY_ID[c.quest]).toBeDefined();
    expect(DEMON_LORDS).toHaveLength(5);
  });

  it('every dialogue script is well formed', () => {
    for (const s of Object.values(DIALOGUES)) {
      expect(s.nodes[s.start]).toBeDefined();
      for (const n of Object.values(s.nodes)) {
        if (n.next) expect(s.nodes[n.next]).toBeDefined();
        for (const c of n.choices ?? []) if (c.next) expect(s.nodes[c.next]).toBeDefined();
        for (const e of [...(n.effects ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])]) {
          if ('start' in e && e.start !== 'current') expect(MAIN_BY_ID[e.start]).toBeDefined();
          if ('turnIn' in e && e.turnIn !== 'current') expect(MAIN_BY_ID[e.turnIn]).toBeDefined();
        }
      }
    }
  });

  it('the main chain is a single line: each quest needs the one before', () => {
    for (let i = 1; i < MAIN_QUESTS.length; i++) expect(MAIN_QUESTS[i].prerequisites?.quests).toContain(MAIN_QUESTS[i - 1].id);
  });

  it('every region has a land dungeon the chain can send you to', () => {
    const src = new OverworldSource(2024);
    for (const q of MAIN_QUESTS) {
      for (const o of q.objectives) {
        if (!('target' in o) || o.target.realm === 'plateau') continue;
        const p = findPlace(src, o.target);
        expect(p, `${q.id} ${JSON.stringify(o.target)}`).not.toBeNull();
        expect(p!.dungeon?.realm).toBe('land');
        if (o.target.group) expect(p!.group).toBe(o.target.group);
      }
    }
  });

  it('the whole chain plays through on events alone, in order, with the right elder script at each step', () => {
    const s = newQuestState();
    expect(elderScript(s, 1)).toBe('elder.intro');
    s.flags.begun = true;
    startQuest(s, MAIN_BY_ID.m0_omen, 0, ctx);
    const finish = (def: QuestDef) => {
      for (const o of def.objectives) {
        switch (o.type) {
          case 'kill': kill(o.count).forEach((e) => applyEvent(s, lookupMain, e)); break;
          case 'discover': applyEvent(s, lookupMain, { type: 'discover', poi: poi('X', o.target.group, true) }); break;
          case 'clear': applyEvent(s, lookupMain, { type: 'clear', poi: { id: o.target.realm === 'plateau' ? 'plat:1' : 'X', type: 'cave', group: o.target.group ?? 'mountain', dungeon: { realm: o.target.realm ?? 'land' } } }); break;
          case 'build': applyEvent(s, lookupMain, { type: 'build', kind: o.kind }); break;
          default: break;                                     // hand-overs are paid at turn-in
        }
      }
    };
    for (const def of MAIN_QUESTS) {
      if (!s.active[def.id]) {
        expect(elderScript(s, 99)).toBe(def.dialogue!.offer);
        expect(startQuest(s, def, 0, { level: 99 })).toBe(true);
      }
      expect(elderScript(s, 99)).toBe(def.dialogue!.hint);
      finish(def);
      expect(isReady(s, def)).toBe(true);
      const needsStuff = def.objectives.some((o) => o.type === 'deliver');
      expect(elderScript(s, 99, () => !needsStuff)).toBe(needsStuff ? def.dialogue!.hint : def.dialogue!.turnIn);
      const res = turnIn(s, lookupMain, def.id, wallet({ wood: 99, stone: 99 }));
      expect(res.ok, def.id).toBe(true);
    }
    expect(s.done).toHaveLength(MAIN_QUESTS.length);
    expect(s.flags['lords.all']).toBe(true);
    expect(s.flags.finale).toBe(true);
    expect(currentMainQuest(s, 99)).toBeNull();
    expect(elderScript(s, 99)).toBe('elder.epilogue');
  });

  it('a quest that needs a higher level stays locked behind the elder', () => {
    const s = newQuestState();
    s.flags.begun = true;
    s.done.push('m0_omen');
    const def = { ...MAIN_BY_ID.m1_hollow, prerequisites: { quests: ['m0_omen'], minLevel: 50 } };
    expect(canStart(s, def, ctx)).toBe(false);
  });

  it('boss names: lords in their lairs, the sovereign in the Skyvault once the lords are down', () => {
    const s = newQuestState();
    expect(bossTitle('field', 'land', true, s)).toBe('Morwen, the Hollow Queen');
    expect(bossTitle('field', 'land', false, s)).toBeNull();
    expect(bossTitle('mountain', 'plateau', false, s)).toBeNull();
    s.flags['lords.all'] = true;
    expect(bossTitle('mountain', 'plateau', false, s)).toBe('Azrathul, the Demon Sovereign');
  });
});

describe('dialogue runner', () => {
  const log: string[] = [];
  const make = (flags: Record<string, boolean> = {}): DialogueContext => ({
    check: (c) => ('flag' in c ? !!flags[c.flag] : 'noFlag' in c ? !flags[c.noFlag] : true),
    apply: (e: Effect) => { log.push(JSON.stringify(e)); if ('flag' in e) flags[e.flag] = true; },
    vars: (n) => ({ who: 'Ada' }[n] ?? `?${n}`)
  });
  const script: DialogueScript = {
    id: 's', start: 'a',
    nodes: {
      a: { speaker: 'X', text: 'Hello {who}.', effects: [{ flag: 'met' }], next: 'b' },
      b: { speaker: 'X', text: 'Pick.', choices: [{ text: 'Yes', next: 'c', effects: [{ start: 'q' }] }, { text: 'Secret', if: [{ flag: 'cheat' }], next: 'c' }, { text: 'No' }] },
      c: { speaker: 'X', text: 'Done {nope}.' }
    }
  };

  it('plays lines, runs effects when a node is reached and when a choice is taken', () => {
    log.length = 0;
    const r = new DialogueRunner(script, make());
    expect(r.view().text).toBe('Hello Ada.');
    expect(log).toEqual([JSON.stringify({ flag: 'met' })]);
    expect(r.advance()).toBe(true);
    expect(r.view().choices.map((c) => c.text)).toEqual(['Yes', 'No']);       // the secret one is hidden
    expect(r.advance()).toBe(true);                                           // an answer is required
    expect(r.node).toBe('b');
    expect(r.advance(0)).toBe(true);
    expect(log[1]).toBe(JSON.stringify({ start: 'q' }));
    expect(r.view().text).toBe('Done ?nope.');
    expect(r.view().last).toBe(true);
    expect(r.advance()).toBe(false);
    expect(r.done).toBe(true);
  });

  it('a choice without a next node ends the conversation, and hidden choices cannot be taken', () => {
    const r = new DialogueRunner(script, make());
    r.advance();
    expect(r.advance(1)).toBe(true);                // index 1 is the hidden "Secret": ignored
    expect(r.advance(2)).toBe(false);               // "No" ends it
    expect(r.done).toBe(true);
  });

  it('conditions see flags that effects set earlier in the conversation', () => {
    const flags: Record<string, boolean> = { cheat: true };
    const r = new DialogueRunner(script, make(flags));
    r.advance();
    expect(r.view().choices.map((c) => c.text)).toContain('Secret');
  });
});

describe('bounty boards', () => {
  const board = { id: '3,4', group: 'forest', level: 10, tx: 60, ty: -40 };

  it('post four bounties, always the same ones for the same rotation', () => {
    const a = boardBounties(2024, board, 3), b = boardBounties(2024, board, 3);
    expect(a).toHaveLength(BOUNTY_SLOTS);
    expect(a).toEqual(b);
    expect(a.map((q) => q.id)).toEqual([0, 1, 2, 3].map((i) => bountyId('3,4', 3, i)));
    for (const q of a) { expect(q.kind).toBe('bounty'); expect(q.giver).toBe('board'); expect(q.rewards.gold).toBeGreaterThan(0); expect(q.objectives.length).toBeGreaterThan(0); }
  });

  it('rotate: a later rotation posts different bounties', () => {
    const titles = (e: number) => boardBounties(2024, board, e).map((q) => q.title + JSON.stringify(q.objectives)).join('|');
    expect(titles(1)).not.toBe(titles(2));
    expect(epochOf(0)).toBe(0);
    expect(epochOf(2400)).toBe(2);
  });

  it('kill bounties target the region\'s own monsters, scaled to the level', () => {
    for (let epoch = 0; epoch < 25; epoch++) {
      const k = boardBounties(7, board, epoch)[0].objectives[0];
      expect(k.type).toBe('kill');
      if (k.type === 'kill') expect(ROSTERS.forest.map((r) => r.type)).toContain(k.enemy);
    }
    const low = boardBounties(7, { ...board, level: 1 }, 5), high = boardBounties(7, { ...board, level: 60 }, 5);
    expect(high[0].rewards.gold!).toBeGreaterThan(low[0].rewards.gold!);
  });

  it('cover the quest kinds: collecting, exploring and building or surviving', () => {
    const seen = new Set<string>();
    for (let epoch = 0; epoch < 40; epoch++) for (const q of boardBounties(7, board, epoch)) for (const o of q.objectives) seen.add(o.type);
    for (const t of ['kill', 'deliver', 'discover', 'clear', 'build', 'survive']) expect(seen.has(t)).toBe(true);
  });

  it('every generated bounty can be started, finished and turned in', () => {
    for (let epoch = 0; epoch < 12; epoch++) for (const def of boardBounties(11, board, epoch)) {
      const s = newQuestState();
      expect(startQuest(s, def, 0, ctx)).toBe(true);
      for (const o of def.objectives) {
        switch (o.type) {
          case 'kill': kill(o.count, o.enemy).forEach((e) => applyEvent(s, () => undefined, e)); break;
          case 'discover': applyEvent(s, () => undefined, { type: 'discover', poi: poi('Z', 'forest') }); break;
          case 'clear': applyEvent(s, () => undefined, { type: 'clear', poi: poi('Z', 'forest') }); break;
          case 'build': applyEvent(s, () => undefined, { type: 'build', kind: o.kind }); break;
          case 'survive': applyEvent(s, () => undefined, { type: 'survive', seconds: o.seconds, group: o.group ?? 'forest' }); break;
          default: break;
        }
      }
      expect(isReady(s, def), def.id).toBe(true);
      expect(turnIn(s, () => undefined, def.id, wallet({ wood: 99, stone: 99, iron: 99 })).ok, def.id).toBe(true);
    }
  });
});

describe('finding places', () => {
  const src = new OverworldSource(2024);

  it('the nearest dungeon of a region is the first one, farther ones come after', () => {
    const t = { kind: 'dungeon' as const, group: 'field', nth: 0 };
    const a = findPlace(src, t)!, b = findPlace(src, { ...t, nth: 1 })!, c = findPlace(src, { ...t, nth: 2 })!;
    const d = (p: typeof a) => Math.hypot(p.tx, p.ty);
    expect(d(a)).toBeLessThanOrEqual(d(b));
    expect(d(b)).toBeLessThanOrEqual(d(c));
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect(findPlace(src, t)).toBe(a);
  });

  it('can search around a town instead of the start', () => {
    const town = findPlace(src, { kind: 'town', nth: 3 })!;
    const near = findPlace(src, { kind: 'dungeon', near: { tx: town.tx, ty: town.ty } })!;
    const origin = findPlace(src, { kind: 'dungeon' })!;
    const dist = (p: typeof near) => Math.hypot(p.tx - town.tx, p.ty - town.ty);
    expect(dist(near)).toBeLessThanOrEqual(dist(origin));
  });

  it('plateau and sea dungeons are not part of the land search', () => {
    expect(findPlace(src, { kind: 'dungeon', realm: 'plateau' })).toBeNull();
    expect(findPlace(src, { kind: 'dungeon', realm: 'sea' })).toBeNull();
  });

  it('bearings read as a distance and a compass point', () => {
    expect(bearing({ tx: 0, ty: 0 }, { tx: 30, ty: 0 })).toBe('about 30 tiles east');
    expect(bearing({ tx: 0, ty: 0 }, { tx: 0, ty: -40 })).toBe('about 40 tiles north');
    expect(bearing({ tx: 0, ty: 0 }, { tx: -20, ty: 20 })).toBe('about 28 tiles southwest');
    expect(bearing({ tx: 0, ty: 0 }, { tx: 2, ty: 2 })).toBe('right here');
  });
});
