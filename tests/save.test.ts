import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, fromBase64, toBase64 } from '../src/core/save/codec';
import { MIGRATIONS, migrate, SaveError } from '../src/core/save/migrations';
import { GENERATOR_VERSION, SAVE_VERSION, validateSave, type SaveData } from '../src/core/save/schema';
import { MemoryStore } from '../src/core/save/store';
import { FogOfWar } from '../src/core/world/fog';

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
        { id: 'aria', level: 7, experience: 33, nextLevel: 120, health: 80, mana: 40, pending: 1, picks: { might: 2 }, auto: ['a'], active: ['b', null, null], dead: false },
        { id: 'brann', level: 3, experience: 1, nextLevel: 60, health: 100, mana: 60, pending: 0, picks: {}, auto: [], active: [null, null, null], dead: true },
        { id: 'cyra', level: 1, experience: 0, nextLevel: 40, health: 100, mana: 60, pending: 0, picks: { reservoir: 1 }, auto: [], active: [null, null, null], dead: false }
      ]
    },
    inventory: {
      spells: [{ uid: 'a', tpl: 'bolt', level: 3, xp: 5, runes: ['swift', null] }, { uid: 'b', tpl: 'dash', level: 1, xp: 0, runes: [null] }],
      runes: ['piercing'], wallet: { gold: 5, wood: 1, stone: 2, iron: 0 }, lootFilter: 'off'
    },
    stats: { kills: 321, score: 4000, bossesDefeated: 1 },
    world: {
      clearedCamps: { '3,4,0': 120 }, defeatedLairs: { '1,1': 300 },
      places: { '5,5': { opened: [0, 2], cleared: true, altarUsed: false } },
      fog: fog.toJSON(), cities: [{ id: '5,5', name: 'Oakhaven', ex: 10, ey: 20 }], lastCity: '5,5'
    },
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
    MIGRATIONS[4] = (raw) => ({ ...raw, version: 5, party: { ...raw.party, extra: 5 } });
    MIGRATIONS[5] = (raw) => ({ ...raw, version: 6, stats: { ...raw.stats, kills: raw.stats.kills + 1000 } });
    try {
      const out: any = migrate(sampleSave(), 6);
      expect(out.version).toBe(6);
      expect(out.party.extra).toBe(5);
      expect(out.stats.kills).toBe(1321);
    } finally {
      delete MIGRATIONS[4];
      delete MIGRATIONS[5];
    }
  });

  it('migrates a v1 save: weapons become spells, passives become picks', () => {
    const v1: any = sampleSave();
    v1.version = 1;
    v1.hero = { level: 7, experience: 33, nextLevel: 120, health: 80, passives: { might: 2 }, weapons: [{ id: 'bolt', level: 3 }, { id: 'nova', level: 2 }] };
    const out = migrate(v1);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.party.heroes[0].picks).toEqual({ might: 2 });
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
    delete v3.party; delete v3.inventory; delete v3.world.lastCity;
    const out = migrate(v3);
    expect(out.version).toBe(SAVE_VERSION);
    expect((out as any).hero).toBeUndefined();
    expect(out.party.heroes.map((h) => h.id)).toEqual(['aria', 'brann', 'cyra']);
    expect(out.party.heroes[0]).toMatchObject({ level: 12, health: 55, pending: 2, picks: { might: 3 } });
    const uids = new Set(out.inventory.spells.map((s) => s.uid));
    for (const h of out.party.heroes) for (const u of [...h.auto, ...h.active]) if (u) expect(uids.has(u)).toBe(true);
    expect(out.inventory.wallet.gold).toBe(9);
    expect(out.inventory.runes).toEqual(['echo']);
    expect(out.world.lastCity).toBe('5,5');
    expect(validateSave(out)).toEqual([]);
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
