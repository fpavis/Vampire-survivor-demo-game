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
    hero: { level: 7, experience: 33, nextLevel: 120, health: 80, passives: { might: 2 }, weapons: [{ id: 'bolt', level: 3 }, { id: 'nova', level: 1 }] },
    stats: { kills: 321, score: 4000, bossesDefeated: 1 },
    world: {
      clearedCamps: { '3,4,0': 120 }, defeatedLairs: { '1,1': 300 },
      places: { '5,5': { opened: [0, 2], cleared: true, altarUsed: false } },
      fog: fog.toJSON(), cities: [{ id: '5,5', name: 'Oakhaven', ex: 10, ey: 20 }]
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
    delete bad.hero;
    bad.player = null;
    const problems = validateSave(bad);
    expect(problems.join(' ')).toMatch(/hero/);
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
    MIGRATIONS[1] = (raw) => ({ ...raw, version: 2, hero: { ...raw.hero, extra: 5 } });
    MIGRATIONS[2] = (raw) => ({ ...raw, version: 3, stats: { ...raw.stats, kills: raw.stats.kills + 1000 } });
    try {
      const out: any = migrate(sampleSave(), 3);
      expect(out.version).toBe(3);
      expect(out.hero.extra).toBe(5);
      expect(out.stats.kills).toBe(1321);
    } finally {
      delete MIGRATIONS[1];
      delete MIGRATIONS[2];
    }
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
