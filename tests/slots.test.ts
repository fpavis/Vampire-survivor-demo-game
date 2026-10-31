import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/core/save/store';
import { SAVE_VERSION, GENERATOR_VERSION, type SaveData } from '../src/core/save/schema';
import { backupKey, deleteSlot, exportSave, formatPlayTime, importSave, listSlots, newestSlot, rotateBackups, shouldRotate, writeSlot, BACKUP_INTERVAL_MS } from '../src/core/save/slots';
import { encodeSave } from '../src/core/save/codec';

function save(savedAt: number, kills = 0): SaveData {
  return {
    version: SAVE_VERSION, generatorVersion: GENERATOR_VERSION, seed: 7, createdAt: 1, savedAt, playSeconds: savedAt / 1000,
    player: { x: 0, y: 0 },
    party: { active: 0, heroes: [{ id: 'aria', level: 1, experience: 0, nextLevel: 40, health: 100, mana: 60, pending: 0, picks: {}, auto: [], active: [null, null, null], dead: false, presets: [null, null, null], assist: null }] },
    inventory: { spells: [], runes: [], wallet: { gold: 0, wood: 0, stone: 0, iron: 0 }, lootFilter: 'off' },
    stats: { kills, score: 0, bossesDefeated: 0, byType: {}, distance: 0, goldEarned: 0, deaths: 0 },
    world: { clearedCamps: {}, defeatedLairs: {}, places: {}, fog: {}, cities: [], lastCity: null, claimed: {}, triggered: {}, gathered: [], shopSold: {}, towers: [], boats: {}, caches: [] },
    quests: { active: {}, done: [], flags: {}, tracked: null, bounties: {} },
    codex: { monsters: [], spells: [], runes: [] },
    tips: [], regions: []
  } as SaveData;
}

describe('save slots', () => {
  it('rolls up to three backups, newest first, never more', async () => {
    const store = new MemoryStore();
    for (let i = 1; i <= 5; i++) await writeSlot(store, 'slot1', save(i * 1000, i), true);
    const [, s1] = await listSlots(store);
    expect((s1.data as SaveData).stats.kills).toBe(5);
    expect(s1.backups.map((b) => b.savedAt)).toEqual([4000, 3000, 2000]);
  });

  it('only refreshes backups on manual saves or after the interval', () => {
    expect(shouldRotate(null, 0, false)).toBe(true);
    expect(shouldRotate(1000, 1000 + BACKUP_INTERVAL_MS - 1, false)).toBe(false);
    expect(shouldRotate(1000, 1000 + BACKUP_INTERVAL_MS, false)).toBe(true);
    expect(shouldRotate(1000, 1001, true)).toBe(true);
  });

  it('reports a corrupt slot and keeps its backups readable', async () => {
    const store = new MemoryStore();
    await writeSlot(store, 'autosave', save(1000), false);
    await rotateBackups(store, 'autosave');
    (store as any).slots.set('autosave', new Uint8Array([1, 2, 3, 4]));
    const [auto] = await listSlots(store);
    expect(auto.data).toBe('corrupt');
    expect(auto.backups).toHaveLength(1);
    expect((await store.load(auto.backups[0].key))!.savedAt).toBe(1000);
    // a broken save is never pushed into the backups
    await rotateBackups(store, 'autosave');
    expect((await store.load(backupKey('autosave', 1)))!.savedAt).toBe(1000);
  });

  it('picks the newest readable save for Continue', async () => {
    const store = new MemoryStore();
    await writeSlot(store, 'slot2', save(5000), false);
    await writeSlot(store, 'autosave', save(3000), false);
    expect(newestSlot(await listSlots(store))!.id).toBe('slot2');
  });

  it('deletes a slot with its backups', async () => {
    const store = new MemoryStore();
    await writeSlot(store, 'slot3', save(1000), true);
    await writeSlot(store, 'slot3', save(2000), true);
    await deleteSlot(store, 'slot3');
    const s = (await listSlots(store))[3];
    expect(s.data).toBeNull();
    expect(s.backups).toEqual([]);
  });

  it('exports a save as text and imports it back; refuses other text', () => {
    const text = exportSave(save(4242, 12));
    expect(text.startsWith('SURVIVAL-SAVE:1:')).toBe(true);
    expect(importSave(`  ${text}\n`).stats.kills).toBe(12);
    expect(() => importSave('hello')).toThrow(/not a saved game/);
    expect(() => importSave('SURVIVAL-SAVE:1:AAAA')).toThrow(/could not be read/);
    expect(encodeSave(save(1)).length).toBeGreaterThan(0);
  });

  it('formats play time', () => {
    expect(formatPlayTime(30)).toBe('under a minute');
    expect(formatPlayTime(12 * 60 + 5)).toBe('12 min');
    expect(formatPlayTime(3 * 3600 + 12 * 60)).toBe('3 h 12 min');
  });
});
