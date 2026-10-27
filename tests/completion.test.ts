import { describe, expect, it } from 'vitest';
import { placeManifest, placeProgress, progressText, type PlaceProgressState, type Progress } from '../src/core/world/completion';
import type { Poi } from '../src/core/types';

const poi = (i: number, type: 'cave' | 'ruins' | 'city', floors = 0): Poi => ({
  id: `p${i}`, type, group: 'field', tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0,
  seed: (i * 2654435761) >>> 0, name: 'Test', ...(floors ? { dungeon: { realm: 'land', floors, boss: 'BOAR_KING' } } : {})
} as unknown as Poi);

// a state where every floor is cleared and every chest is open
function allDone(p: Poi): PlaceProgressState {
  const m = placeManifest(p)!;
  const floorState = (f: number) => ({ opened: [...Array(m[f].chests).keys(), ...(m[f].vault ? ['vault'] : [])] as (number | string)[], cleared: true });
  const st: PlaceProgressState = { ...floorState(0), floors: {}, bossDead: true, bossChestOpened: true };
  for (let f = 1; f < m.length; f++) st.floors![f] = floorState(f);
  return st;
}

describe('place completion', () => {
  it('towns have nothing to clear', () => {
    expect(placeManifest(poi(1, 'city'))).toBeNull();
  });

  it('a dungeon is done only when every floor is cleared, every chest opened and the boss is down', () => {
    // find a dungeon with a vault somewhere, so the vault chest is part of the count
    let p = poi(1, 'cave', 3);
    for (let i = 1; i < 60 && !placeManifest(p)!.some((m) => m.vault); i++) p = poi(i, i % 2 ? 'cave' : 'ruins', 3);
    const m = placeManifest(p)!;
    expect(m).toHaveLength(3);
    expect(m.filter((f) => f.boss)).toHaveLength(1);
    expect(m.some((f) => f.vault)).toBe(true);

    expect(placeProgress(m, null).done).toBe(false);
    expect(placeProgress(m, null).chestsOpened).toBe(0);

    const st = allDone(p);
    const full = placeProgress(m, st);
    expect(full.done).toBe(true);
    expect(full.floorsCleared).toBe(3);
    expect(full.chestsOpened).toBe(full.chests);

    // one floor never visited
    const missing = JSON.parse(JSON.stringify(st)); delete missing.floors['2'];
    expect(placeProgress(m, missing).done).toBe(false);
    // the vault left shut
    const vaultShut = JSON.parse(JSON.stringify(st));
    const vf = m.findIndex((f) => f.vault);
    const vs = vf === 0 ? vaultShut : vaultShut.floors[vf];
    vs.opened = vs.opened.filter((x: unknown) => x !== 'vault');
    expect(placeProgress(m, vaultShut).done).toBe(false);
    // the boss chest left closed
    expect(placeProgress(m, { ...st, bossChestOpened: false }).done).toBe(false);
    // the boss alive (its floor cannot count as cleared)
    expect(placeProgress(m, { ...st, bossDead: false }).done).toBe(false);
  });

  it('a plain cave needs its monsters cleared and its chests opened', () => {
    const p = poi(5, 'cave');
    const m = placeManifest(p)!;
    expect(m).toHaveLength(1);
    expect(m[0].boss).toBe(false);
    const st = allDone(p);
    expect(placeProgress(m, st).done).toBe(true);
    expect(placeProgress(m, { ...st, cleared: false }).done).toBe(m[0].spawns === 0);
    if (m[0].chests) expect(placeProgress(m, { ...st, opened: [] }).done).toBe(false);
  });

  it('reads as one line in the journal', () => {
    const base: Progress = { floors: 3, floorsCleared: 1, chests: 7, chestsOpened: 5, hasBoss: true, bossDown: true, done: false };
    expect(progressText(base)).toBe('boss defeated · floors 1/3 cleared · chests 5/7');
    expect(progressText({ ...base, bossDown: false })).toBe('the boss waits · floors 1/3 cleared · chests 5/7');
    expect(progressText({ ...base, floors: 1, floorsCleared: 0, hasBoss: false, chests: 0 })).toBe('monsters remain');
    expect(progressText({ ...base, floors: 1, floorsCleared: 1, hasBoss: false, chests: 2, chestsOpened: 1 })).toBe('monsters defeated · chests 1/2');
    expect(progressText({ ...base, done: true })).toBe('cleared');
  });
});
