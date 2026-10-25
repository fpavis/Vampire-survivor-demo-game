import { describe, expect, it } from 'vitest';
import { OverworldSource } from '../src/core/world/terrain';
import { createInterior } from '../src/core/world/interiors';
import { BIOME, WARLORDS } from '../src/core/world/biomes';
import {
  BOSS_LEVEL_BONUS, FLOOR_LEVEL_STEP, bossChestTier, bossLevel, dungeonForLand, dungeonName, floorLevel, floorSeed, isSeaDungeonCell,
  plateauPoi, seaDungeonPoi, type DungeonInfo
} from '../src/core/world/dungeons';
import { newTower, plateauCentre } from '../src/core/world/towers';
import type { Poi, PoiType } from '../src/core/types';

const T = 48;
const src = new OverworldSource(2024);

const fake = (type: PoiType, seed: number, info: DungeonInfo, group = 'field'): Poi => ({
  id: `${type}${seed}`, type, group, tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0, seed, name: 'Test', dungeon: info
});

describe('dungeons on land', () => {
  it('are a deterministic share of the caves and ruins, never towns', () => {
    expect(dungeonForLand(1, 3, 4, 'city', 'field', 5)).toBeNull();
    let dungeons = 0, places = 0;
    for (let cy = -20; cy <= 20; cy++) for (let cx = -20; cx <= 20; cx++) {
      const p = src.poiForCell(cx, cy);
      if (!p || p.type === 'city') continue;
      places++;
      expect(src.poiForCell(cx, cy)).toBe(p);
      if (p.dungeon) {
        dungeons++;
        expect(p.dungeon.realm).toBe('land');
        expect(p.dungeon.floors).toBeGreaterThanOrEqual(2);
        expect(p.dungeon.floors).toBeLessThanOrEqual(5);
        expect(p.dungeon.boss).toBe(WARLORDS[p.group] ?? WARLORDS.field);
      }
    }
    expect(places).toBeGreaterThan(40);
    expect(dungeons / places).toBeGreaterThan(0.3);
    expect(dungeons / places).toBeLessThan(0.7);
  });

  it('dungeons run deeper in harsher zones', () => {
    let shallow = 0, deep = 0;
    for (let i = 0; i < 400; i++) {
      const a = dungeonForLand(7, i, i * 3, 'cave', 'field', 1);
      const b = dungeonForLand(7, i, i * 3, 'cave', 'field', 95);
      if (a) shallow += a.floors;
      if (b) deep += b.floors;
    }
    expect(deep).toBeGreaterThan(shallow);
  });

  it('a dungeon has its own grander name', () => {
    const n = dungeonName(2024, 3, 4, 'ruins');
    expect(n).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(dungeonName(2024, 3, 4, 'ruins')).toBe(n);
  });

  it('every floor is a bit harder, and the boss is harder still', () => {
    expect(floorLevel(10, 0)).toBe(10);
    expect(floorLevel(10, 2)).toBe(10 + 2 * FLOOR_LEVEL_STEP);
    expect(bossLevel(10, 3)).toBe(floorLevel(10, 2) + BOSS_LEVEL_BONUS);
    expect(bossChestTier(3)).toBeLessThan(bossChestTier(4));
  });
});

describe('dungeon floors', () => {
  for (const type of ['cave', 'ruins'] as PoiType[]) {
    it(`${type}: stairs, boss and chests are reachable on every floor`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const info: DungeonInfo = { realm: 'land', floors: 2 + (seed % 3), boss: 'STONE_TITAN' };
        const poi = fake(type, seed * 104729, info, seed % 2 ? 'forest' : 'mountain');
        for (let floor = 0; floor < info.floors; floor++) {
          const f = createInterior(poi, floor);
          const last = floor === info.floors - 1;
          const sx = Math.floor(f.start.x / T), sy = Math.floor(f.start.y / T);
          const dist = f.distanceMap(sx, sy);
          const reach = (p: { x: number; y: number }) => dist[Math.floor(p.y / T) * f.w + Math.floor(p.x / T)] >= 0;
          expect(f.floor).toBe(floor);
          expect(f.floors).toBe(info.floors);
          expect(f.isFloor(sx, sy)).toBe(true);
          expect(reach(f.exit)).toBe(true);
          for (const c of f.chests) expect(reach(c)).toBe(true);
          for (const s of f.spawns) expect(f.isFloor(Math.floor(s.x / T), Math.floor(s.y / T))).toBe(true);
          if (last) { expect(f.boss).not.toBeNull(); expect(f.stairsDown).toBeNull(); expect(reach(f.boss!)).toBe(true); }
          else { expect(f.stairsDown).not.toBeNull(); expect(f.boss).toBeNull(); expect(reach(f.stairsDown!)).toBe(true); }
          expect(f.stairsUp !== null).toBe(floor > 0);
          expect(f.guardians).toBeGreaterThanOrEqual(2);
          // nothing lurks on top of the way down or in the boss's clearing
          const feature = f.stairsDown ?? f.boss!;
          for (const s of f.spawns) expect(Math.hypot(s.x - feature.x, s.y - feature.y)).toBeGreaterThan(3 * T);
          // the way back up is where you arrive
          if (floor > 0) expect(Math.hypot(f.stairsUp!.x - f.exit.x, f.stairsUp!.y - f.exit.y)).toBeLessThan(2 * T);
        }
      }
    });
  }

  it('floors are deterministic and differ from each other', () => {
    const info: DungeonInfo = { realm: 'land', floors: 3, boss: 'BOAR_KING' };
    const poi = fake('cave', 31337, info);
    const a0 = createInterior(poi, 0), b0 = createInterior(poi, 0), a1 = createInterior(poi, 1);
    expect(Array.from(a0.tiles)).toEqual(Array.from(b0.tiles));
    expect(Array.from(a0.tiles)).not.toEqual(Array.from(a1.tiles));
    expect(floorSeed(5, 0)).toBe(5);
    expect(floorSeed(5, 1)).not.toBe(floorSeed(5, 2));
  });

  it('ordinary places are unchanged: one floor, no stairs, no boss', () => {
    const f = createInterior({ id: 'x', type: 'cave', group: 'field', tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0, seed: 5, name: 'Plain' });
    expect(f.dungeon).toBeNull();
    expect(f.floors).toBe(1);
    expect(f.stairsDown).toBeNull();
    expect(f.stairsUp).toBeNull();
    expect(f.boss).toBeNull();
  });
});

describe('plateau and sea dungeons', () => {
  it('a climbing tower plateau hides a Skyvault at its heart', () => {
    const rec = { ...newTower('climb', 10, 20, { dir: 2, len: 12 }), built: true };
    const poi = plateauPoi(rec, 2024)!;
    const c = plateauCentre(rec)!;
    expect(poi.id).toBe(`plat:${rec.id}`);
    expect(poi.tx).toBe(c.tx);
    expect(poi.ty).toBe(c.ty);
    expect(poi.dungeon!.realm).toBe('plateau');
    expect(poi.dungeon!.boss).toBe(WARLORDS.mountain);
    expect(poi.ey).toBeGreaterThan(poi.y);
    expect(poi.name).toMatch(/^Skyvault /);
    expect(plateauPoi(rec, 2024)).toEqual(poi);
    expect(plateauPoi(newTower('beacon', 1, 1), 2024)).toBeNull();
  });

  it('some islands hold a drowned shrine instead of treasure', () => {
    let shrines = 0, islands = 0;
    const biome = (x: number, y: number) => src.biomeAt(x, y);
    for (let cy = -14; cy <= 14; cy++) for (let cx = -14; cx <= 14; cx++) {
      const p = seaDungeonPoi(2024, cx, cy, biome);
      if (p) {
        shrines++;
        expect(isSeaDungeonCell(2024, cx, cy)).toBe(true);
        expect(p.dungeon!.realm).toBe('sea');
        expect(p.id).toBe(`sea:${cx},${cy}`);
        expect(p.name).toMatch(/^Drowned /);
        expect(seaDungeonPoi(2024, cx, cy, biome)).toEqual(p);
      }
      islands++;
    }
    expect(islands).toBeGreaterThan(0);
    expect(shrines).toBeGreaterThan(0);
  });

  it('the dungeon floors of a plateau or a shrine are ruins', () => {
    const rec = { ...newTower('climb', 10, 20, { dir: 2, len: 12 }), built: true };
    const poi = plateauPoi(rec, 2024)!;
    const f = createInterior(poi, 0);
    expect(f.kind).toBe('ruins');
    expect(f.floors).toBe(3);
    expect(BIOME.RUIN_FLOOR).toBeGreaterThan(0);
  });
});
