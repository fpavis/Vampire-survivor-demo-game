import { describe, expect, it } from 'vitest';
import { CORRUPT_START, corruptionAt, isCorrupt, areaMayBeCorrupt } from '../src/core/world/corruption';
import { OverworldSource } from '../src/core/world/terrain';
import { isWaterBiome } from '../src/core/world/biomes';

// a coarse sample of land out to 1600 tiles, every 16 tiles (one sample stands for 256 tiles)
const STEP = 16, R = 1600;
function sample(seed: number) {
  const src = new OverworldSource(seed);
  const cells = new Map<string, boolean>();
  let land = 0, corrupt = 0;
  for (let y = -R; y <= R; y += STEP) for (let x = -R; x <= R; x += STEP) {
    if (Math.hypot(x, y) < CORRUPT_START.outer || isWaterBiome(src.biomeAt(x, y))) continue;
    land++;
    const c = isCorrupt(corruptionAt(seed, x, y));
    if (c) corrupt++;
    cells.set(`${x / STEP},${y / STEP}`, c);
  }
  return { land, corrupt, cells };
}

describe('corrupted lands', () => {
  it('cover an uncommon share of the land: roughly 5 to 12 percent', () => {
    for (const seed of [2024, 7, 99]) {
      const s = sample(seed);
      const share = s.corrupt / s.land;
      expect(share, `seed ${seed}`).toBeGreaterThan(0.05);
      expect(share, `seed ${seed}`).toBeLessThan(0.12);
    }
  });

  it('come in large patches that feel like a discovery, not scattered specks', () => {
    const { cells } = sample(2024);
    const seen = new Set<string>();
    const sizes: number[] = [];
    for (const [k, c] of cells) {
      if (!c || seen.has(k)) continue;
      let n = 0;
      const q = [k];
      seen.add(k);
      while (q.length) {
        const [x, y] = q.pop()!.split(',').map(Number);
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${x + dx},${y + dy}`;
          if (cells.get(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
        }
      }
      sizes.push(n);
    }
    const total = sizes.reduce((a, b) => a + b, 0);
    const big = sizes.filter((n) => n >= 8).reduce((a, b) => a + b, 0);
    // most blighted land lies in patches of 2000 tiles or more (8 samples of 256 tiles)
    expect(big / total).toBeGreaterThan(0.8);
    expect(Math.max(...sizes) * STEP * STEP).toBeGreaterThan(20000);
  });

  it('never touches the starting lands', () => {
    for (let y = -CORRUPT_START.inner; y <= CORRUPT_START.inner; y += 6) for (let x = -CORRUPT_START.inner; x <= CORRUPT_START.inner; x += 6) {
      if (Math.hypot(x, y) < CORRUPT_START.inner) expect(corruptionAt(2024, x, y)).toBe(0);
    }
  });

  it('is the same every time and fades in at its edges', () => {
    let edge = 0;
    for (let x = 200; x < 3000; x += 3) {
      const c = corruptionAt(2024, x, 911);
      expect(corruptionAt(2024, x, 911)).toBe(c);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      if (c > 0.05 && c < 0.95) edge++;
    }
    expect(edge).toBeGreaterThan(0);
  });

  it('the quick chunk test never misses a blighted tile', () => {
    const seed = 77, CT = 16;
    let skipped = 0;
    for (let cy = -60; cy < 60; cy += 3) for (let cx = -60; cx < 60; cx += 3) {
      if (areaMayBeCorrupt(seed, cx * CT, cy * CT, CT)) continue;
      skipped++;
      for (let j = 0; j < CT; j += 2) for (let i = 0; i < CT; i += 2) expect(corruptionAt(seed, cx * CT + i, cy * CT + j)).toBe(0);
    }
    expect(skipped).toBeGreaterThan(1000);   // and it does skip most of the world
  });
});
