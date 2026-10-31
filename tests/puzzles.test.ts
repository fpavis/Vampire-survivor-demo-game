import { describe, expect, it } from 'vitest';
import { createInterior } from '../src/core/world/interiors';
import { SLOW_HERO_TILES_PER_SEC, VAULT_CHANCE, plateTour, verifyPuzzle, type Puzzle } from '../src/core/world/puzzles';
import { WORLD_CONFIG } from '../src/core/config';
import type { Poi } from '../src/core/types';

const T = WORLD_CONFIG.tile;
const poi = (i: number, type: 'cave' | 'ruins'): Poi => ({
  id: `p${i}`, type, group: ['field', 'forest', 'desert', 'shore', 'mountain'][i % 5], tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0,
  seed: (i * 2654435761) >>> 0, name: 'Test', dungeon: { realm: 'land', floors: 3, boss: 'BOAR_KING' }
} as unknown as Poi);

// 200 dungeon floors: caves and ruins, every floor depth
const floors = Array.from({ length: 200 }, (_, i) => createInterior(poi(i, i % 2 ? 'ruins' : 'cave'), i % 3));
const withPuzzle = floors.filter((f) => f.puzzle);

describe('dungeon vaults', () => {
  it('appear on a good share of floors, with every kind of puzzle', () => {
    expect(withPuzzle.length).toBeGreaterThan(200 * VAULT_CHANCE * 0.6);
    const kinds = new Set(withPuzzle.map((f) => f.puzzle!.kind));
    expect([...kinds].sort()).toEqual(['key', 'levers', 'plates']);
  });

  it('are always solvable: the proof holds on every floor that has one', () => {
    for (const f of withPuzzle) {
      const proof = verifyPuzzle(f, f.puzzle!);
      expect(proof.ok, `${f.kind} seed ${f.seed}: ${proof.reason}`).toBe(true);
    }
  });

  it('never stand in the way: the stairs or the boss are reachable with the gate shut', () => {
    for (const f of withPuzzle) {
      const pz = f.puzzle!;
      const st = { tx: Math.floor(f.start.x / T), ty: Math.floor(f.start.y / T) };
      const shut = f.distanceMap(st.tx, st.ty, new Set(pz.gate.tiles));
      const way = f.stairsDown ?? f.boss;
      expect(way).toBeTruthy();
      expect(shut[Math.floor(way!.y / T) * f.w + Math.floor(way!.x / T)]).toBeGreaterThanOrEqual(0);
      expect(shut[pz.chest.ty * f.w + pz.chest.tx]).toBe(-1);
    }
  });

  it('give the plates time enough to run between them, with slack', () => {
    const plates = withPuzzle.map((f) => [f, f.puzzle!] as const).filter(([, p]) => p.kind === 'plates');
    expect(plates.length).toBeGreaterThan(3);
    for (const [f, p] of plates) {
      const tour = plateTour(f, p.plates!, p.gate.tiles);
      expect(tour).toBe(p.tour);
      expect(p.window!).toBeGreaterThanOrEqual(tour / SLOW_HERO_TILES_PER_SEC + 4);
      expect(p.plates).toHaveLength(3);
    }
  });

  it('spread levers apart and keep keys far from their gate', () => {
    for (const f of withPuzzle) {
      const p: Puzzle = f.puzzle!;
      if (p.kind === 'levers') {
        expect(p.levers!.length).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < p.levers!.length; i++) for (let j = i + 1; j < p.levers!.length; j++)
          expect(Math.hypot(p.levers![i].tx - p.levers![j].tx, p.levers![i].ty - p.levers![j].ty)).toBeGreaterThanOrEqual(8);
      }
      if (p.kind === 'key') expect(Math.hypot(p.key!.x - p.gate.x, p.key!.y - p.gate.y) / T).toBeGreaterThan(6);
    }
  });

  it('are the same every time for the same floor, and do not move the rest of the floor', () => {
    const a = createInterior(poi(7, 'cave'), 1), b = createInterior(poi(7, 'cave'), 1);
    expect(JSON.stringify(a.puzzle)).toBe(JSON.stringify(b.puzzle));
    expect(a.chests).toEqual(b.chests);
  });

  it('are only found in dungeons', () => {
    const plain = { ...poi(3, 'cave'), dungeon: undefined } as unknown as Poi;
    for (let i = 0; i < 20; i++) expect(createInterior({ ...plain, seed: i * 977 } as Poi, 0).puzzle).toBeNull();
  });
});
