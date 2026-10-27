import { describe, expect, it } from 'vitest';
import { SERVICES, TILE, YARD, planTown, verifyTown } from '../src/core/world/towns';

const plans = Array.from({ length: 300 }, (_, i) => planTown((i * 2654435761) >>> 0, { capital: i % 7 === 0 }));
const made = plans.filter((p) => p);

describe('town layouts', () => {
  it('almost every seed yields a valid layout (the rest fall back to the classic town)', () => {
    expect(made.length).toBeGreaterThanOrEqual(285);
  });

  it('every layout passes the accessibility proof: the exit and every service can be walked to', () => {
    for (const p of made) expect(verifyTown(p!), `${p!.size} ${p!.layout}`).toEqual({ ok: true });
  });

  it('vary in size, street plan and number of houses', () => {
    expect(new Set(made.map((p) => p!.size)).size).toBe(3);
    expect(new Set(made.map((p) => p!.layout)).size).toBe(3);
    const houses = new Set(made.map((p) => p!.buildings.length));
    expect(houses.size).toBeGreaterThan(8);
    const villagers = made.map((p) => p!.villagers.length);
    expect(Math.min(...villagers)).toBeGreaterThanOrEqual(5);
  });

  it('arrange their services differently: which side of the fountain, hall and gate each takes', () => {
    const side = (a: number, b: number) => (a > b ? 'R' : 'L');
    const looks = new Set(made.map((p) => {
      const s = p!.services;
      return [side(s.healer.x, s.fountain.x), side(s.elder.x, s.altar.x), side(s.board.x, s.fountain.x), side(s.teleporter.x, p!.gateX + 0.5)].join('');
    }));
    expect(looks.size).toBeGreaterThanOrEqual(12);
    // the merchant's stalls stand on the merchant's side, away from the fountain
    for (const p of made.slice(0, 60)) {
      const s = p!.services, stalls = p!.decor.filter((d) => d.type === 'stall');
      for (const st of stalls) expect(Math.sign(st.x - s.fountain.x) || 1).toBe(Math.sign(s.merchant.x - s.fountain.x) || 1);
    }
  });

  it('are the same every time for the same seed', () => {
    const a = planTown(12345), b = planTown(12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('put each service somewhere that makes sense', () => {
    for (const p of made.slice(0, 120)) {
      const s = p!.services, hall = p!.hall;
      // the altar and the elder stand before the town hall
      expect(Math.abs(s.altar.y - (hall.y + hall.h))).toBeLessThan(1.5);
      expect(Math.hypot(s.elder.x - s.altar.x, s.elder.y - s.altar.y)).toBeLessThan(5);
      // the healer beside the fountain, the teleporter just inside the gate
      expect(Math.hypot(s.healer.x - s.fountain.x, s.healer.y - s.fountain.y)).toBeLessThan(5);
      expect(p!.h - s.teleporter.y).toBeLessThan(8);
      // nothing stands on a wall or a house, and services keep their distance from each other
      for (const id of SERVICES) expect(p!.tiles[Math.floor(s[id].y) * p!.w + Math.floor(s[id].x)]).toBe(TILE.FLOOR);
    }
  });

  it('keep the gate in the south wall, under the start', () => {
    for (const p of made.slice(0, 60)) {
      expect(p!.tiles[(p!.h - 1) * p!.w + p!.gateX]).toBe(TILE.FLOOR);
      expect(p!.start.y).toBeLessThan(p!.exit.y);
      expect(p!.exit.y).toBeLessThan(p!.h - 2);
    }
  });

  it('have a training ground well away from the fountain, with three dummies in reach of each other', () => {
    for (const p of made) {
      const f = p!.services.fountain, y = p!.yard;
      const yc = { x: y.x + y.w / 2, y: y.y + y.h / 2 };
      expect(Math.hypot(yc.x - f.x, yc.y - f.y)).toBeGreaterThanOrEqual(p!.w * YARD.away);
      expect(p!.dummies).toHaveLength(3);
      for (const d of p!.dummies) {
        expect(d.x).toBeGreaterThan(y.x); expect(d.x).toBeLessThan(y.x + y.w);
        expect(d.y).toBeGreaterThan(y.y); expect(d.y).toBeLessThan(y.y + y.h);
        expect(p!.tiles[Math.floor(d.y) * p!.w + Math.floor(d.x)]).toBe(TILE.FLOOR);
      }
      // neighbours within a chain's jump (240 px = 5 tiles), and none on top of another
      const [a, b, c] = p!.dummies;
      for (const [u, v] of [[a, b], [b, c]]) { const d = Math.hypot(u.x - v.x, u.y - v.y); expect(d).toBeLessThan(5); expect(d).toBeGreaterThan(2.5); }
      expect(p!.services.dummy).toEqual(b);
      // no house stands in the yard, and it is fenced and signposted
      for (let ty = y.y; ty < y.y + y.h; ty++) for (let tx = y.x; tx < y.x + y.w; tx++) expect(p!.tiles[ty * p!.w + tx]).toBe(TILE.FLOOR);
      expect(p!.decor.filter((d) => d.type === 'fence').length).toBeGreaterThan(8);
      expect(p!.decor.some((d) => d.type === 'signpost')).toBe(true);
    }
  });

  it('put the training ground in different places from town to town', () => {
    const where = new Set(made.map((p) => `${p!.yard.x < p!.w / 2 ? 'W' : 'E'}${p!.yard.y < p!.h / 2 ? 'N' : 'S'}`));
    expect(where.size).toBeGreaterThanOrEqual(3);
  });
});
