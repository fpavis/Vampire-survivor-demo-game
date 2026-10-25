import { describe, expect, it } from 'vitest';
import { OverworldSource } from '../src/core/world/terrain';
import { RoadNet, START_NODE } from '../src/core/world/roads';
import { REGION_CELL, START_REGION_NAME, regionAt, regionHeart, regionName } from '../src/core/world/regions';
import { isSolidBiome, isWaterBiome } from '../src/core/world/biomes';
import { SURFACE_NUM } from '../src/core/world/surfaces';

const SEEDS = [2024, 7, 99];

describe('regions', () => {
  it('are deterministic and named', () => {
    for (const seed of SEEDS) {
      const a = regionAt(seed, 300, -140), b = regionAt(seed, 300, -140);
      expect(a).toBe(b);
      const [cx, cy] = a.split(',').map(Number);
      expect(regionName(seed, cx, cy)).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('start in Hearthvale', () => {
    for (const seed of SEEDS) {
      expect(regionAt(seed, 0, 0)).toBe('0,0');
      expect(regionName(seed, 0, 0)).toBe(START_REGION_NAME);
    }
  });

  it('assign every tile to its nearest heart', () => {
    const seed = 2024;
    for (let i = 0; i < 200; i++) {
      const tx = Math.round(Math.sin(i * 12.9898) * 900), ty = Math.round(Math.cos(i * 78.233) * 900);
      const [cx, cy] = regionAt(seed, tx, ty).split(',').map(Number);
      const own = regionHeart(seed, cx, cy);
      const d = Math.hypot(own.tx - tx, own.ty - ty);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const h = regionHeart(seed, cx + dx, cy + dy);
        expect(Math.hypot(h.tx - tx, h.ty - ty)).toBeGreaterThanOrEqual(d - 1e-9);
      }
      expect(d).toBeLessThan(REGION_CELL * 1.6);
    }
  });

  it('describe themselves with a title and a capital town when one is near', () => {
    const src = new OverworldSource(2024);
    let capitals = 0;
    for (let cy = -2; cy <= 2; cy++) for (let cx = -2; cx <= 2; cx++) {
      const r = src.region(`${cx},${cy}`);
      expect(r.title).toContain(r.name);
      if (r.capital) { capitals++; expect(r.capital.type).toBe('city'); expect(src.regionId(r.capital.tx, r.capital.ty)).toBe(r.id); }
    }
    expect(capitals).toBeGreaterThan(5);
  });
});

describe('roads', () => {
  it('lead from the start to the nearest town over land only', () => {
    for (const seed of SEEDS) {
      const src = new OverworldSource(seed);
      const net = src.roads;
      const [town] = net.near(START_NODE);
      expect(town, `seed ${seed}`).toBeDefined();
      const path = net.route(START_NODE, town)!;
      expect(path, `seed ${seed}`).not.toBeNull();
      expect([path[0], path[1]]).toEqual([START_NODE.tx, START_NODE.ty]);
      expect([path[path.length - 2], path[path.length - 1]]).toEqual([town.tx, town.ty]);
      for (let k = 0; k < path.length; k += 2) {
        if (k > 0) expect(Math.max(Math.abs(path[k] - path[k - 2]), Math.abs(path[k + 1] - path[k - 1]))).toBe(1);
        const b = src.biomeAt(path[k], path[k + 1]);
        if (k > 0 && k < path.length - 2) expect(isSolidBiome(b) || isWaterBiome(b), `seed ${seed} at ${path[k]},${path[k + 1]}`).toBe(false);
      }
    }
  });

  it('link towns to their nearest neighbours, both ways', () => {
    const src = new OverworldSource(2024);
    const net = src.roads;
    const towns = net.townsIn(-300, -300, 300, 300);
    expect(towns.length).toBeGreaterThan(3);
    let routed = 0;
    for (const t of towns) {
      const near = net.near(t);
      expect(near.length).toBeLessThanOrEqual(2);
      for (const m of near) {
        expect(Math.hypot(m.tx - t.tx, m.ty - t.ty)).toBeLessThanOrEqual(100);
        if (net.route(t, m)) routed++;
        expect(net.route(t, m)).toEqual(net.route(m, t));
      }
    }
    expect(routed).toBeGreaterThan(0);
  });

  it('are the same in two worlds from the same seed, and become a road surface', () => {
    const a = new OverworldSource(99), b = new OverworldSource(99);
    const ra = new RoadNet(a), rb = new RoadNet(b);
    const [town] = ra.near(START_NODE);
    expect(ra.route(START_NODE, town)).toEqual(rb.route(START_NODE, rb.near(START_NODE)[0]));
    const path = ra.route(START_NODE, town)!;
    const mid = [path[Math.floor(path.length / 4) * 2], path[Math.floor(path.length / 4) * 2 + 1]];
    expect(a.roads.isRoad(mid[0], mid[1])).toBe(true);
    expect(a.surfaceNumAt(mid[0], mid[1], a.biomeAt(mid[0], mid[1]))).toBe(SURFACE_NUM.road);
  });

  it('keep trees and rocks off the road', () => {
    const src = new OverworldSource(2024);
    const [town] = src.roads.near(START_NODE);
    const path = src.roads.route(START_NODE, town)!;
    const CT = 12, T = 48;
    const k = Math.floor(path.length / 3 / 2) * 2;
    const cx = Math.floor(path[k] / CT), cy = Math.floor(path[k + 1] / CT);
    const chunk: any = { cx, cy, x0: cx * CT * T, y0: cy * CT * T, size: CT * T, decor: [], solids: [], pois: [], biomes: new Uint8Array(CT * CT) };
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) chunk.biomes[j * CT + i] = src.biomeAt(cx * CT + i, cy * CT + j);
    src.decorForChunk(chunk);
    for (const d of chunk.decor) {
      if (d.type === 'signpost') continue;
      expect(src.roads.isRoad(Math.floor(d.x / T), Math.floor(d.y / T)), `${d.type} at ${d.x},${d.y}`).toBe(false);
    }
  });
});
