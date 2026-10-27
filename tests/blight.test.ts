import { describe, expect, it } from 'vitest';
import { blightColor, corruptionAt, isCorrupt } from '../src/core/world/corruption';
import { OverworldSource } from '../src/core/world/terrain';
import { Population } from '../src/core/world/population';
import { ambientFor } from '../src/core/audio/ambience';
import { isWaterBiome } from '../src/core/world/biomes';
import { WORLD_CONFIG } from '../src/core/config';

const CT = WORLD_CONFIG.chunkTiles, T = WORLD_CONFIG.tile;
const SEED = 2024;
const src = new OverworldSource(SEED);

// chunks of land that are corrupted all through, and clean ones at a similar distance from the start
function chunks(want: boolean, n: number) {
  const out: [number, number][] = [];
  for (let r = 14; r < 90 && out.length < n; r++) for (let a = 0; a < 96 && out.length < n; a++) {
    const cx = Math.round(Math.cos(a / 96 * 6.283) * r), cy = Math.round(Math.sin(a / 96 * 6.283) * r);
    const mid = src.corruptionAt(cx * CT + CT / 2, cy * CT + CT / 2);
    const corners = [[0, 0], [CT - 1, 0], [0, CT - 1], [CT - 1, CT - 1]].map(([i, j]) => src.corruptionAt(cx * CT + i, cy * CT + j));
    const full = mid > 0.95 && corners.every((c) => c > 0.9), clean = mid === 0 && corners.every((c) => c === 0);
    if (want ? full : clean && Math.hypot(cx, cy) > 14) out.push([cx, cy]);
  }
  return out;
}
const blighted = chunks(true, 40), clean = chunks(false, 200);

function decorOf(cx: number, cy: number) {
  const chunk: any = { cx, cy, x0: cx * CT * T, y0: cy * CT * T, size: CT * T, biomes: new Uint8Array(CT * CT), decor: [], solids: [], pois: [] };
  for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) chunk.biomes[j * CT + i] = src.biomeAt(cx * CT + i, cy * CT + j);
  src.decorForChunk(chunk);
  return { decor: chunk.decor as { type: string }[], land: [...chunk.biomes].filter((b) => !isWaterBiome(b)).length };
}

describe('the corrupted lands at play', () => {
  it('there are whole chunks of blight to test with', () => {
    expect(blighted.length).toBeGreaterThanOrEqual(20);
  });

  it('the source caches the same values the pure rule gives', () => {
    for (const [cx, cy] of blighted.slice(0, 5)) for (let k = 0; k < CT; k += 5) {
      expect(src.corruptionAt(cx * CT + k, cy * CT + k)).toBeCloseTo(corruptionAt(SEED, cx * CT + k, cy * CT + k), 6);
    }
  });

  it('turn the ground drained, darker and violet, and leave clean ground alone', () => {
    expect(blightColor(0x4aa84a, 0)).toBe(0x4aa84a);
    const c = blightColor(0x4aa84a, 1);
    const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    expect(g).toBeLessThan(0xa8);                       // darker
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(0xa8 - 0x4a);   // less saturated
    expect(b).toBeGreaterThan(0x4a);                    // leaning violet
  });

  it('are barren: no flowers or bushes, only dead trees, and the blight grows its own spires and crystals', () => {
    const GROWTH = ['flowerbed', 'bush', 'tallgrass', 'wheat', 'fern', 'glowshroom', 'bigmushroom', 'dunebush', 'cactus'];
    const TREES = ['appletree', 'birch', 'oak', 'pine', 'snowpine', 'palm'];
    let growth = 0, trees = 0, blight = 0, land = 0;
    for (const [cx, cy] of blighted) {
      const d = decorOf(cx, cy);
      land += d.land;
      growth += d.decor.filter((x) => GROWTH.includes(x.type)).length;
      trees += d.decor.filter((x) => TREES.includes(x.type)).length;
      blight += d.decor.filter((x) => x.type === 'blightspire' || x.type === 'corruptcrystal').length;
    }
    let cleanGrowth = 0, cleanLand = 0;
    for (const [cx, cy] of clean.slice(0, blighted.length)) { const d = decorOf(cx, cy); cleanLand += d.land; cleanGrowth += d.decor.filter((x) => GROWTH.includes(x.type)).length; }
    expect(trees).toBe(0);
    expect(growth / land).toBeLessThan(0.3 * (cleanGrowth / cleanLand));
    expect(blight).toBeGreaterThan(blighted.length);    // more than one a chunk
  });

  it('breed far more monster camps (at the same levels)', () => {
    const pop = new Population(src);
    const rate = (list: [number, number][]) => list.reduce((n, [cx, cy]) => n + pop.campsForChunk(cx, cy).filter((c) => !c.lair).length, 0) / list.length;
    expect(rate(blighted)).toBeGreaterThan(1.8 * rate(clean));
  });

  it('have their own ambience bed outdoors (a place still wins)', () => {
    expect(ambientFor({ group: 'field', corrupt: true })).toBe('corrupt');
    expect(ambientFor({ group: 'field', corrupt: true, place: 'cave' })).toBe('cave');
    expect(ambientFor({ group: 'forest' })).toBe('forest');
    expect(isCorrupt(1)).toBe(true);
  });
});
