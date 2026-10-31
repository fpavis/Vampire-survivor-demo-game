import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, fromBase64, toBase64 } from '../src/core/save/codec';
import { MIGRATIONS, migrate, SaveError } from '../src/core/save/migrations';
import { GENERATOR_VERSION, SAVE_VERSION, validateSave, type SaveData } from '../src/core/save/schema';
import { MemoryStore } from '../src/core/save/store';
import { FogOfWar } from '../src/core/world/fog';
import { MAX_PINS, cleanPins } from '../src/core/world/mapView';

function sampleSave(over: Partial<SaveData> = {}): SaveData {
  const fog = new FogOfWar();
  fog.revealCircle(0, 0, 12);
  fog.revealCircle(-30, 45, 9);
  return {
    version: SAVE_VERSION, generatorVersion: GENERATOR_VERSION, seed: 123456, createdAt: 1, savedAt: 2, playSeconds: 345.5,
    player: { x: 100.5, y: -20 },
    party: {
      active: 0,
      heroes: [
        { id: 'aria', level: 7, experience: 33, nextLevel: 120, health: 80, mana: 40, pending: 1, picks: { might: 2 }, auto: ['a'], active: ['b', null, null], dead: false, presets: [{ auto: ['a'], active: [null, null, null] }, null, null], assist: null },
        { id: 'brann', level: 3, experience: 1, nextLevel: 60, health: 100, mana: 60, pending: 0, picks: {}, auto: [], active: [null, null, null], dead: true, presets: [null, null, null], assist: null },
        { id: 'cyra', level: 1, experience: 0, nextLevel: 40, health: 100, mana: 60, pending: 0, picks: { reservoir: 1 }, auto: [], active: [null, null, null], dead: false, presets: [null, null, null], assist: 'a' }
      ]
    },
    inventory: {
      spells: [{ uid: 'a', tpl: 'bolt', level: 3, xp: 5, runes: ['swift', null] }, { uid: 'b', tpl: 'dash', level: 1, xp: 0, runes: [null] }],
      runes: ['piercing'], wallet: { gold: 5, wood: 1, stone: 2, iron: 0 }, lootFilter: 'off'
    },
    stats: { kills: 321, score: 4000, bossesDefeated: 1, byType: { SLIME: 300, WOLF: 21 }, distance: 12345, goldEarned: 900, deaths: 2 },
    world: {
      clearedCamps: { '3,4,0': 120 }, defeatedLairs: { '1,1': 300 },
      places: { '5,5': { opened: [0, 2], cleared: true, altarUsed: false }, '-1,-4': { opened: [1], cleared: false, altarUsed: false, unsealed: true, floors: { '1': { opened: [], cleared: true, altarUsed: false, unsealed: true } }, bossDead: true, bossChestOpened: false } },
      fog: fog.toJSON(), cities: [{ id: '5,5', name: 'Oakhaven', ex: 10, ey: 20 }], lastCity: '5,5', claimed: { 's1,1': 400 }, triggered: { 's2,2': 80 }, gathered: ['oak:100,56'], shopSold: { '5,5:3': [1, 4] },
      towers: [{ id: 't60,70', kind: 'spire', tx: 60, ty: 70, dir: 0, len: 0, delivered: { gold: 10, wood: 3, stone: 2, iron: 0 }, built: false, spell: null }], boats: { 't9,9': { x: 5, y: 6 } }, caches: ['c1,1']
    },
    quests: {
      active: {
        m1_hollow: { progress: [1, 0], targets: ['-1,-4', '-1,-4'], startedAt: 100 },
        'b:5,5:3:0': { progress: [4], targets: [null], startedAt: 200, def: { id: 'b:5,5:3:0', title: 'Cull the Slimes', kind: 'bounty', giver: 'board', objectives: [{ type: 'kill', count: 12, enemy: 'SLIME' }], rewards: { gold: 60 }, summary: 's' } }
      },
      done: ['m0_omen'], flags: { begun: true, 'lord.field': true }, tracked: 'm1_hollow', bounties: { '5,5': { epoch: 3, taken: [0, 2] } }
    },
    codex: { monsters: ['SLIME', 'WOLF'], spells: ['bolt'], runes: ['swift'] },
    tips: ['welcome', 'gems'], regions: ['r0,0', 'r1,-1'],
    ...over
  };
}

describe('save codec', () => {
  it('round trips losslessly through compression', () => {
    const s = sampleSave();
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it('compresses fog data well', () => {
    const fog = new FogOfWar();
    for (let i = 0; i < 400; i++) fog.revealCircle(i * 3, (i % 20) * 5, 8);
    const s = sampleSave({ world: { ...sampleSave().world, fog: fog.toJSON() } });
    const bytes = encodeSave(s);
    expect(bytes.length).toBeLessThan(JSON.stringify(s).length);
    expect(decodeSave(bytes)).toEqual(s);
  });

  it('base64 export round trips', () => {
    const bytes = encodeSave(sampleSave());
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('accepts plain JSON bytes for hand-edited saves', () => {
    const json = new TextEncoder().encode(JSON.stringify(sampleSave()));
    expect(decodeSave(json).seed).toBe(123456);
  });
});

describe('save validation and migration', () => {
  it('a valid save has no problems', () => {
    expect(validateSave(sampleSave())).toEqual([]);
  });

  it('reports what is wrong', () => {
    const bad: any = sampleSave();
    delete bad.party;
    bad.player = null;
    const problems = validateSave(bad);
    expect(problems.join(' ')).toMatch(/party/);
    expect(problems.join(' ')).toMatch(/player/);
  });

  it('refuses saves from the future and from before versioning', () => {
    expect(() => migrate({ ...sampleSave(), version: SAVE_VERSION + 1 })).toThrow(SaveError);
    expect(() => migrate({ ...sampleSave(), version: 0 })).toThrow(SaveError);
    expect(() => migrate(null)).toThrow(SaveError);
  });

  it('refuses corrupted saves with details', () => {
    try { migrate({ version: SAVE_VERSION, seed: 'x' }); expect.unreachable(); }
    catch (e) { expect((e as SaveError).details.length).toBeGreaterThan(0); }
  });

  it('runs migration steps in order', () => {
    const V = SAVE_VERSION;
    MIGRATIONS[V] = (raw) => ({ ...raw, version: V + 1, party: { ...raw.party, extra: 5 } });
    MIGRATIONS[V + 1] = (raw) => ({ ...raw, version: V + 2, stats: { ...raw.stats, kills: raw.stats.kills + 1000 } });
    try {
      const out: any = migrate(sampleSave(), V + 2);
      expect(out.version).toBe(V + 2);
      expect(out.party.extra).toBe(5);
      expect(out.stats.kills).toBe(1321);
    } finally {
      delete MIGRATIONS[V];
      delete MIGRATIONS[V + 1];
    }
  });

  it('migrates a v1 save: weapons become spells, passives become picks', () => {
    const v1: any = sampleSave();
    v1.version = 1;
    v1.hero = { level: 7, experience: 33, nextLevel: 120, health: 80, passives: { might: 2 }, weapons: [{ id: 'bolt', level: 3 }, { id: 'nova', level: 2 }] };
    const out = migrate(v1);
    expect(out.version).toBe(SAVE_VERSION);
    // the old passives became picks (v2), then were refunded when the cards were rebalanced (v10)
    expect(out.party.heroes[0].picks).toEqual({});
    expect(out.party.heroes[0].pending).toBe(2);
    expect(out.inventory.spells.map((x) => [x.tpl, x.level]).slice(0, 3)).toEqual([['bolt', 3], ['nova', 2], ['dash', 1]]);
    expect(out.party.heroes[0].auto).toHaveLength(2);
    expect(validateSave(out)).toEqual([]);
    expect(out.inventory.wallet).toEqual({ gold: 0, wood: 0, stone: 0, iron: 0 });
  });

  it('migrates a v2 save: adds an empty wallet', () => {
    const v2: any = sampleSave();
    v2.version = 2;
    v2.hero = { level: 4, experience: 1, nextLevel: 90, health: 70, mana: 50, pendingPicks: 0, picks: {}, spells: [{ uid: 'a', tpl: 'bolt', level: 1, xp: 0, runes: [null, null] }], runes: [], auto: ['a'], active: [null, null, null] };
    delete v2.party; delete v2.inventory;
    const out = migrate(v2);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.inventory.lootFilter).toBe('off');
  });

  it('migrates a v3 save: one hero becomes a party of three with their own starter spells', () => {
    const v3: any = sampleSave();
    v3.version = 3;
    v3.hero = { level: 12, experience: 5, nextLevel: 200, health: 55, mana: 33, pendingPicks: 2, picks: { might: 3 }, spells: [{ uid: 'a', tpl: 'bolt', level: 4, xp: 0, runes: ['swift', null] }], runes: ['echo'], auto: ['a'], active: [null, null, null], wallet: { gold: 9, wood: 0, stone: 0, iron: 1 }, lootFilter: 'basic' };
    delete v3.party; delete v3.inventory; delete v3.world.lastCity; delete v3.world.claimed; delete v3.world.triggered; delete v3.world.gathered; delete v3.world.shopSold; delete v3.world.towers; delete v3.world.boats; delete v3.world.caches; delete v3.quests;
    const out = migrate(v3);
    expect(out.version).toBe(SAVE_VERSION);
    expect((out as any).hero).toBeUndefined();
    expect(out.party.heroes.map((h) => h.id)).toEqual(['aria', 'brann', 'cyra']);
    expect(out.party.heroes[0]).toMatchObject({ level: 12, health: 55, pending: 5, picks: {} });
    const uids = new Set(out.inventory.spells.map((s) => s.uid));
    for (const h of out.party.heroes) for (const u of [...h.auto, ...h.active]) if (u) expect(uids.has(u)).toBe(true);
    expect(out.inventory.wallet.gold).toBe(9);
    expect(out.inventory.runes).toEqual(['echo']);
    expect(out.world.lastCity).toBe('5,5');
    expect(out.world.claimed).toEqual({});
    expect(out.world.gathered).toEqual([]);
    expect(out.world.towers).toEqual([]);
    expect(out.world.boats).toEqual({});
    expect(out.quests).toEqual({ active: {}, done: [], flags: {}, tracked: null, bounties: {} });
    expect(validateSave(out)).toEqual([]);
  });

  it('migrates a v6 save: quests start empty, towers and places are untouched', () => {
    const v6: any = sampleSave();
    v6.version = 6;
    delete v6.quests;
    const out = migrate(v6);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.quests.done).toEqual([]);
    expect(out.world.towers).toHaveLength(1);
    expect(out.world.places['5,5'].cleared).toBe(true);
    expect(validateSave(out)).toEqual([]);
  });

  it('migrates a v7 save: no tips seen and no regions discovered yet', () => {
    const v7: any = sampleSave();
    v7.version = 7;
    delete v7.tips; delete v7.regions;
    expect(validateSave(v7)).toContain('tips missing');
    const out = migrate(v7);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.tips).toEqual([]);
    expect(out.regions).toEqual([]);
    expect(out.quests.tracked).toBe('m1_hollow');
    expect(validateSave(out)).toEqual([]);
  });

  it('migrates a v8 save: statistics start at zero, the kill count stays', () => {
    const v8: any = sampleSave();
    v8.version = 8;
    v8.stats = { kills: 50, score: 10, bossesDefeated: 0 };
    delete v8.codex;
    v8.party.heroes.forEach((h: any) => { delete h.presets; delete h.assist; });
    expect(validateSave(v8)).toContain('statistics missing');
    const out = migrate(v8);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.stats).toEqual({ kills: 50, score: 10, bossesDefeated: 0, byType: {}, distance: 0, goldEarned: 0, deaths: 0 });
    expect(out.codex.spells).toEqual(['bolt', 'dash']);
    expect(out.codex.runes).toEqual(['piercing']);
    expect(out.party.heroes.every((h) => h.presets.length === 3 && h.assist === null)).toBe(true);
    expect(validateSave(out)).toEqual([]);
  });

  it('migrates a v9 save: every pick is refunded as a pending upgrade, and a notice says so once', () => {
    const v9: any = sampleSave();
    v9.version = 9;
    v9.party.heroes[0].picks = { might: 5, haste: 3, armor: 2 };
    v9.party.heroes[0].pending = 1;
    const out = migrate(v9);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.party.heroes.map((h) => h.picks)).toEqual([{}, {}, {}]);
    expect(out.party.heroes.map((h) => h.pending)).toEqual([11, 0, 1]);
    expect(out.party.heroes.map((h) => h.level)).toEqual([7, 3, 1]);      // levels stay
    expect(out.notices).toHaveLength(1);
    expect(out.notices![0]).toContain('Aria 10');
    expect(out.notices![0]).toContain('Cyra 1');
    expect(out.notices![0]).not.toContain('Brann');
    expect(validateSave(out)).toEqual([]);
    // nothing to refund, nothing to say
    const none: any = sampleSave();
    none.version = 9;
    none.party.heroes.forEach((h: any) => { h.picks = {}; });
    expect(migrate(none).notices).toEqual([]);
  });

  it('keeps quest progress, generated bounties and dungeon state through a codec round trip', async () => {
    const s = sampleSave();
    const back: any = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.quests.active.m1_hollow.progress).toEqual([1, 0]);
    expect(back.quests.active['b:5,5:3:0'].def.title).toBe('Cull the Slimes');
    expect(back.quests.bounties['5,5'].taken).toEqual([0, 2]);
    expect(back.world.places['-1,-4'].floors['1'].cleared).toBe(true);
    expect(back.world.places['-1,-4'].bossDead).toBe(true);
  });
});

describe('MemoryStore', () => {
  it('saves, lists, loads and removes slots', async () => {
    const store = new MemoryStore();
    await store.save('a', sampleSave());
    await store.save('b', sampleSave({ playSeconds: 9 }));
    const list = await store.list();
    expect(list.map((x) => x.slot).sort()).toEqual(['a', 'b']);
    expect((await store.load('b'))!.playSeconds).toBe(9);
    await store.remove('a');
    expect(await store.load('a')).toBeNull();
  });
});

describe('FogOfWar', () => {
  it('reveals tiles and reports newly revealed counts', () => {
    const fog = new FogOfWar();
    expect(fog.isRevealed(5, 5)).toBe(false);
    expect(fog.reveal(5, 5)).toBe(true);
    expect(fog.reveal(5, 5)).toBe(false);
    expect(fog.isRevealed(5, 5)).toBe(true);
    expect(fog.isRevealed(6, 5)).toBe(false);
  });

  it('handles negative coordinates and chunk borders', () => {
    const fog = new FogOfWar();
    for (const [x, y] of [[-1, -1], [-12, -12], [-13, 0], [11, 11], [12, 12], [0, -1]]) {
      fog.reveal(x, y);
      expect(fog.isRevealed(x, y)).toBe(true);
    }
    expect(fog.isRevealed(-2, -1)).toBe(false);
  });

  it('a revealed disc has about pi r^2 tiles', () => {
    const fog = new FogOfWar();
    const n = fog.revealCircle(40, -40, 16);
    expect(n).toBeGreaterThan(Math.PI * 16 * 16 * 0.95);
    expect(n).toBeLessThan(Math.PI * 16 * 16 * 1.08);
    expect(fog.revealedTileCount()).toBe(n);
    expect(fog.revealCircle(40, -40, 16)).toBe(0);
  });

  it('survives a JSON round trip and marks chunks dirty on load', () => {
    const fog = new FogOfWar();
    fog.revealCircle(3, 3, 10);
    fog.revealCircle(-50, 20, 6);
    const copy = FogOfWar.fromJSON(JSON.parse(JSON.stringify(fog.toJSON())));
    expect(copy.revealedTileCount()).toBe(fog.revealedTileCount());
    for (let y = -30; y < 40; y++) for (let x = -70; x < 30; x++) expect(copy.isRevealed(x, y)).toBe(fog.isRevealed(x, y));
    expect(copy.dirty.size).toBeGreaterThan(0);
  });

  it('ignores corrupt chunk data instead of crashing', () => {
    const fog = FogOfWar.fromJSON({ '0,0': 'AAAA', 'bad': '!!!' } as any);
    expect(fog.revealedTileCount()).toBe(0);
  });
});

describe('map pins in a save', () => {
  const pins = [{ tx: 12, ty: -3, color: 'gold' }, { tx: -40, ty: 7, color: 'red' }, { tx: 0, ty: 0, color: 'blue' }];
  const withPins = (list: unknown) => sampleSave({ world: { ...sampleSave().world, pins: list as never } });

  it('a save from before pins is valid and has none', () => {
    const s = sampleSave();
    expect(s.world.pins).toBeUndefined();
    expect(validateSave(s)).toEqual([]);
    expect(cleanPins(s.world.pins)).toEqual([]);
  });

  it('pins go through the compressed codec and the text export unharmed', () => {
    const s = withPins(pins);
    expect(validateSave(s)).toEqual([]);
    expect(decodeSave(encodeSave(s)).world.pins).toEqual(pins);
    expect(decodeSave(fromBase64(toBase64(encodeSave(s)))).world.pins).toEqual(pins);
  });

  it('migration leaves them alone, and loading cleans anything odd that was written by hand', () => {
    expect(migrate(withPins(pins)).world.pins).toEqual(pins);
    const odd = [{ tx: 1.9, ty: 2, color: 'gold' }, { tx: 1, ty: 2, color: 'red' }, { tx: 5, ty: 5, color: 'pink' }, 'nope', null, { tx: 'x' }];
    expect(cleanPins(odd)).toEqual([{ tx: 1, ty: 2, color: 'gold' }, { tx: 5, ty: 5, color: 'gold' }]);
    expect(cleanPins(Array.from({ length: MAX_PINS + 20 }, (_, i) => ({ tx: i, ty: 0, color: 'blue' }))).length).toBe(MAX_PINS);
  });
});
