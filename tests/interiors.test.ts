import { describe, expect, it } from 'vitest';
import { createInterior } from '../src/core/world/interiors';
import type { Poi, PoiType } from '../src/core/types';

const T = 48;
const poi = (type: PoiType, seed: number, group = 'field'): Poi => ({
  id: `${type}${seed}`, type, group, tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0, seed, name: 'Test'
});

describe('interior generators', () => {
  for (const type of ['cave', 'ruins', 'city'] as PoiType[]) {
    it(`${type}: everything important is reachable from the entrance`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const src = createInterior(poi(type, seed * 7919, seed % 2 ? 'desert' : 'mountain'));
        const sx = Math.floor(src.start.x / T), sy = Math.floor(src.start.y / T);
        const dist = src.distanceMap(sx, sy);
        const reach = (x: number, y: number) => dist[Math.floor(y / T) * src.w + Math.floor(x / T)] >= 0;
        expect(src.isFloor(sx, sy)).toBe(true);
        expect(reach(src.exit.x, src.exit.y)).toBe(true);
        for (const c of src.chests) expect(reach(c.x, c.y)).toBe(true);
        for (const s of src.spawns) expect(src.isFloor(Math.floor(s.x / T), Math.floor(s.y / T))).toBe(true);
        for (const n of src.npcs) expect(src.isFloor(Math.floor(n.x / T), Math.floor(n.y / T))).toBe(true);
      }
    });

    it(`${type}: same seed gives the same layout`, () => {
      const a = createInterior(poi(type, 31337)), b = createInterior(poi(type, 31337));
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect(a.chests).toEqual(b.chests);
      expect(a.spawns).toEqual(b.spawns);
    });
  }

  it('caves and ruins contain treasure and monsters, cities are safe', () => {
    expect(createInterior(poi('cave', 5)).chests.length).toBeGreaterThan(0);
    expect(createInterior(poi('ruins', 5)).chests.length).toBeGreaterThan(0);
    const city = createInterior(poi('city', 5));
    expect(city.spawns.length).toBe(0);
    expect(city.fountain).not.toBeNull();
    expect(city.altar).not.toBeNull();
  });
});
