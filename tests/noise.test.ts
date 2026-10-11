import { describe, expect, it } from 'vitest';
import { fbm, hash, makeRng, valueNoise } from '../src/core/world/noise';

describe('noise', () => {
  it('hash is deterministic and in [0,1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = hash(i * 7, -i * 3, 12345);
      expect(v).toBe(hash(i * 7, -i * 3, 12345));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds give different values', () => {
    let same = 0;
    for (let i = 0; i < 200; i++) if (hash(i, i, 1) === hash(i, i, 2)) same++;
    expect(same).toBeLessThan(3);
  });

  it('value noise and fbm stay in range and are continuous', () => {
    for (let i = 0; i < 300; i++) {
      const x = i * 0.37, y = i * 0.11;
      const n = fbm(x, y, 99, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x, y, 5) - valueNoise(x + 0.001, y, 5))).toBeLessThan(0.02);
    }
  });

  it('makeRng reproduces the same stream per seed', () => {
    const a = makeRng(42), b = makeRng(42), c = makeRng(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
});
