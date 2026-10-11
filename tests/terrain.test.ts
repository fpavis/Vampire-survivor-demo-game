import { describe, expect, it } from 'vitest';
import { OverworldSource, POI_CELL } from '../src/core/world/terrain';
import { BIOME, isSolidBiome, isWaterBiome } from '../src/core/world/biomes';
import { WORLD_CONFIG } from '../src/core/config';

function sample(seed: number, n = 40): number[] {
  const src = new OverworldSource(seed);
  const out: number[] = [];
  for (let y = -n; y < n; y += 3) for (let x = -n; x < n; x += 3) out.push(src.biomeAt(x * 7, y * 7));
  return out;
}

describe('overworld terrain', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(sample(1234)).toEqual(sample(1234));
    expect(sample(1234)).not.toEqual(sample(4321));
  });

  it('start clearing is always walkable land', () => {
    for (const seed of [1, 2, 3, 777, 99999, 424242]) {
      const src = new OverworldSource(seed);
      const r = WORLD_CONFIG.spawnClearing;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (Math.hypot(x, y) > r) continue;
        const b = src.biomeAt(x, y);
        expect(isSolidBiome(b) || isWaterBiome(b)).toBe(false);
      }
    }
  });

  it('produces every biome somewhere', () => {
    const seen = new Set<number>();
    const src = new OverworldSource(2024);
    for (let y = -300; y < 300; y += 3) for (let x = -300; x < 300; x += 3) seen.add(src.biomeAt(x, y));
    for (const b of [BIOME.DEEP, BIOME.SHALLOW, BIOME.SAND, BIOME.DRY, BIOME.GRASS, BIOME.FOREST, BIOME.HILL, BIOME.MOUNTAIN, BIOME.PEAK]) {
      expect(seen.has(b)).toBe(true);
    }
  });

  it('places points of interest deterministically, away from the start, on land', () => {
    const a = new OverworldSource(555), b = new OverworldSource(555);
    let count = 0;
    for (let cy = -10; cy <= 10; cy++) for (let cx = -10; cx <= 10; cx++) {
      const pa = a.poiForCell(cx, cy), pb = b.poiForCell(cx, cy);
      expect(pa).toEqual(pb);
      if (!pa) continue;
      count++;
      expect(Math.hypot(pa.tx, pa.ty)).toBeGreaterThan(14);
      const biome = a.biomeAt(pa.tx, pa.ty);
      expect(isSolidBiome(biome) || isWaterBiome(biome)).toBe(false);
      expect(pa.tx).toBeGreaterThanOrEqual(cx * POI_CELL);
      expect(pa.tx).toBeLessThan((cx + 1) * POI_CELL);
    }
    expect(count).toBeGreaterThan(20);
  });
});
