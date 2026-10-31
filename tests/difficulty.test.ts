import { describe, expect, it } from 'vitest';
import { baseLevel, enemyDamageScale, enemyHealthScale, threatBand, tierOf, zoneLevel } from '../src/core/world/difficulty';

describe('difficulty by distance', () => {
  it('is level 1 inside the safe radius', () => {
    for (const seed of [1, 2, 3]) for (let a = 0; a < 6.28; a += 0.4) {
      const r = 79;
      expect(zoneLevel(seed, Math.cos(a) * r, Math.sin(a) * r, 2)).toBe(1);
    }
  });

  it('matches the design table on average (levels 5 / 10 / 21 / 42 / 95)', () => {
    const avg = (d: number) => {
      let sum = 0, n = 0;
      for (let seed = 1; seed <= 6; seed++) for (let a = 0; a < 6.28; a += 0.2) { sum += zoneLevel(seed, Math.cos(a) * d, Math.sin(a) * d, 0); n++; }
      return sum / n;
    };
    expect(avg(400)).toBeGreaterThan(4);   expect(avg(400)).toBeLessThan(6.5);
    expect(avg(900)).toBeGreaterThan(8.5); expect(avg(900)).toBeLessThan(11.5);
    expect(avg(2200)).toBeGreaterThan(19); expect(avg(2200)).toBeLessThan(23.5);
    expect(avg(5000)).toBeGreaterThan(39); expect(avg(5000)).toBeLessThan(45.5);
    expect(avg(13000)).toBeGreaterThan(90); expect(avg(13000)).toBeLessThan(100);
  });

  it('base curve rises gradually and never decreases', () => {
    let prev = 0;
    for (let d = 0; d <= 20000; d += 50) { const l = baseLevel(d); expect(l).toBeGreaterThanOrEqual(prev); prev = l; }
    // slow incline: never more than +1 level per 20 tiles on average over the first 3000 tiles
    expect(baseLevel(3000) - baseLevel(2000)).toBeLessThan(1000 / 20);
  });

  it('is deterministic for a seed and varies regionally', () => {
    expect(zoneLevel(5, 700, 300, 1)).toBe(zoneLevel(5, 700, 300, 1));
    const levels = new Set<number>();
    for (let a = 0; a < 6.28; a += 0.3) levels.add(zoneLevel(9, Math.cos(a) * 1500, Math.sin(a) * 1500, 0));
    expect(levels.size).toBeGreaterThan(2);
  });

  it('tiers step every 12 levels', () => {
    expect(tierOf(1)).toBe(0); expect(tierOf(12)).toBe(0); expect(tierOf(13)).toBe(1); expect(tierOf(37)).toBe(3);
  });

  it('stat scaling grows with level and is 1 at level 1', () => {
    expect(enemyHealthScale(1)).toBe(1);
    expect(enemyDamageScale(1)).toBe(1);
    expect(enemyHealthScale(50)).toBeGreaterThan(enemyHealthScale(10));
    expect(enemyDamageScale(99)).toBeLessThan(25);
  });

  it('threat bands compare enemy and hero level', () => {
    expect(threatBand(1, 20)).toBe('low');
    expect(threatBand(20, 20)).toBe('even');
    expect(threatBand(26, 20)).toBe('high');
    expect(threatBand(40, 20)).toBe('deadly');
  });
});
