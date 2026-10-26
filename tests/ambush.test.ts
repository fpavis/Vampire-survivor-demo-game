import { describe, expect, it } from 'vitest';
import { AMBUSH_GAP, AMBUSH_RING, ambushCount, ambushPlan, type Site } from '../src/core/world/sites';
import { makeRng } from '../src/core/world/noise';

const site = (waves: number): Site => ({ id: 's', kind: 'trigger', tx: 0, ty: 0, x: 1000, y: 2000, level: 10, group: 'field', radius: 52, waves });

describe('ambush plan', () => {
  it('springs half again as many monsters as before, 6 to 15', () => {
    expect(ambushCount(site(4))).toBe(6);
    expect(ambushCount(site(7))).toBe(11);
    expect(ambushCount(site(10))).toBe(15);
  });

  it('places every monster on a ring well away from the plate', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = site(4 + (seed % 7));
      for (const p of ambushPlan(s, ambushCount(s), makeRng(seed))) {
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        expect(d).toBeGreaterThanOrEqual(AMBUSH_RING.min - 0.01);
        expect(d).toBeLessThanOrEqual(AMBUSH_RING.max + 0.01);
      }
    }
  });

  it('always leaves an open side to break out through', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = site(4 + (seed % 7));
      const angles = ambushPlan(s, ambushCount(s), makeRng(seed)).map((p) => Math.atan2(p.y - s.y, p.x - s.x)).sort((a, b) => a - b);
      let gap = angles[0] + Math.PI * 2 - angles[angles.length - 1];
      for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
      expect(gap).toBeGreaterThanOrEqual(AMBUSH_GAP - 0.1);
    }
  });

  it('closes in group by group, two or three groups', () => {
    const small = ambushPlan(site(4), 6, makeRng(3)), big = ambushPlan(site(10), 15, makeRng(3));
    expect(new Set(small.map((p) => p.group)).size).toBe(2);
    expect(new Set(big.map((p) => p.group)).size).toBe(3);
    expect(Math.max(...big.map((p) => p.delay))).toBeGreaterThan(0);
    expect(Math.min(...big.map((p) => p.delay))).toBe(0);
  });
});
