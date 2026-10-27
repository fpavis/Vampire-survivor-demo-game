import { describe, expect, it } from 'vitest';
import { EVENT_DEFS, EVENT_KINDS, eventAllowed, eventSpawns, nextEventDelay, pickEvent, type EventContext } from '../src/core/world/worldEvents';
import { makeRng } from '../src/core/world/noise';

describe('overworld events', () => {
  it('come every few minutes, three times as often in corrupted lands', () => {
    const r = makeRng(1);
    for (let i = 0; i < 200; i++) {
      const d = nextEventDelay(r, false);
      expect(d).toBeGreaterThanOrEqual(150); expect(d).toBeLessThanOrEqual(270);
      const c = nextEventDelay(r, true);
      expect(c).toBeGreaterThanOrEqual(60); expect(c).toBeLessThanOrEqual(90);
    }
  });

  it('pick every kind now and then', () => {
    const r = makeRng(2), seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(pickEvent(r));
    expect([...seen].sort()).toEqual([...EVENT_KINDS].sort());
  });

  it('appear off screen on a ring around the hero, in narrow groups, with the stated elites', () => {
    for (const kind of EVENT_KINDS) for (let seed = 1; seed < 30; seed++) {
      const s = eventSpawns(kind, makeRng(seed), 650, 900);
      const def = EVENT_DEFS[kind];
      expect(s.length).toBeGreaterThanOrEqual(def.count[0]);
      expect(s.length).toBeLessThanOrEqual(def.count[1]);
      expect(s.filter((m) => m.elite)).toHaveLength(Math.min(def.elites, s.length));
      for (const m of s) {
        const d = Math.hypot(m.dx, m.dy);
        expect(d).toBeGreaterThanOrEqual(650 - 1e-6); expect(d).toBeLessThanOrEqual(900 + 1e-6);
      }
      // a group never surrounds the hero: its members lie within a narrow fan
      for (let w = 0; w < def.waves; w++) {
        const angles = s.filter((m) => m.wave === w).map((m) => Math.atan2(m.dy, m.dx));
        const rel = angles.map((a) => Math.atan2(Math.sin(a - angles[0]), Math.cos(a - angles[0])));
        expect(Math.max(...rel) - Math.min(...rel)).toBeLessThanOrEqual(def.spread + 1e-6);
      }
    }
  });

  it('never start on a party that is sailing, near a town or the start, fighting, or early in the run', () => {
    const ok: EventContext = { overworldSeconds: 400, sailing: false, tilesFromStart: 200, tilesFromTown: 60, engaged: 2, bossNear: false, safe: false };
    expect(eventAllowed(ok)).toBe(true);
    expect(eventAllowed({ ...ok, overworldSeconds: 100 })).toBe(false);
    expect(eventAllowed({ ...ok, sailing: true })).toBe(false);
    expect(eventAllowed({ ...ok, tilesFromStart: 30 })).toBe(false);
    expect(eventAllowed({ ...ok, tilesFromTown: 10 })).toBe(false);
    expect(eventAllowed({ ...ok, engaged: 12 })).toBe(false);
    expect(eventAllowed({ ...ok, bossNear: true })).toBe(false);
    expect(eventAllowed({ ...ok, safe: true })).toBe(false);
  });
});
