import { describe, expect, it } from 'vitest';
import { ROCK_INSET, cornerRadius, rockShape, rockTouches } from '../src/core/render/rockShape';

const T = 48, SEED = 77;
/** A rock map from rows of '#' (rock) and '.' (floor); outside it is floor. */
const map = (rows: string[]) => (tx: number, ty: number) => rows[ty]?.[tx] === '#';
const pts = (a: number[]) => { const out: [number, number][] = []; for (let i = 0; i < a.length; i += 2) out.push([a[i], a[i + 1]]); return out; };

describe('rock outlines', () => {
  it('a tile with rock all round is whole', () => {
    const wall = map(['###', '###', '###']);
    const s = rockShape(1, 1, wall, SEED, T);
    expect(s.whole).toBe(true);
    expect(s.top).toEqual([T, T, 2 * T, T, 2 * T, 2 * T, T, 2 * T]);
    expect(s.south).toBeNull();
  });

  it('stays inside its tile, and open edges sit no deeper than the inset', () => {
    const wall = map(['....', '.##.', '.##.', '....']);
    for (const [tx, ty] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
      const s = rockShape(tx, ty, wall, SEED, T);
      for (const [x, y] of pts(s.top)) {
        expect(x).toBeGreaterThanOrEqual(tx * T - 1e-6);
        expect(x).toBeLessThanOrEqual((tx + 1) * T + 1e-6);
        expect(y).toBeGreaterThanOrEqual(ty * T - 1e-6);
        expect(y).toBeLessThanOrEqual((ty + 1) * T + 1e-6);
      }
    }
    // the north edge of the top-left tile, away from its corner: within the inset
    const s = rockShape(1, 1, wall, SEED, T);
    const north = pts(s.top).filter(([x, y]) => x > T + T * 0.5 && y < T + T * 0.3);
    expect(north.length).toBeGreaterThan(0);
    for (const [, y] of north) expect(y - T).toBeLessThanOrEqual(ROCK_INSET + 1e-6);
  });

  it('rounds outer corners: no point sits on the corner itself', () => {
    const wall = map(['...', '.#.', '...']);          // a lone rock: four rounded corners
    const s = rockShape(1, 1, wall, SEED, T);
    for (const [cx, cy] of [[T, T], [2 * T, T], [2 * T, 2 * T], [T, 2 * T]]) {
      const nearest = Math.min(...pts(s.top).map(([x, y]) => Math.hypot(x - cx, y - cy)));
      expect(nearest).toBeGreaterThan(T * 0.1);
    }
    expect(cornerRadius(T, T, SEED, T)).toBeGreaterThanOrEqual(T * 0.36);
    expect(cornerRadius(T, T, SEED, T)).toBeLessThanOrEqual(T * 0.44);
  });

  it('neighbours along a straight cliff meet at the same point', () => {
    const wall = map(['.....', '#####', '#####']);
    for (let tx = 0; tx < 4; tx++) {
      const a = pts(rockShape(tx, 1, wall, SEED, T).top), b = pts(rockShape(tx + 1, 1, wall, SEED, T).top);
      const x = (tx + 1) * T;
      const ya = a.filter(([px]) => Math.abs(px - x) < 1e-6).map(([, y]) => y).sort((p, q) => p - q)[0];
      const yb = b.filter(([px]) => Math.abs(px - x) < 1e-6).map(([, y]) => y).sort((p, q) => p - q)[0];
      expect(Math.abs(ya - yb)).toBeLessThan(1e-6);
    }
  });

  it('inner corners stay square: the wobble fades to nothing there', () => {
    // rock to the west and north-west, floor to the north: the corner at (T, T) is inner
    const wall = map(['#..', '##.', '##.']);
    const s = pts(rockShape(1, 1, wall, SEED, T).top);
    expect(s.some(([x, y]) => Math.abs(x - T) < 1e-6 && Math.abs(y - T) < 1e-6)).toBe(true);
  });

  it('gives the line a cliff face hangs from only when the south is open, west to east', () => {
    const wall = map(['###', '###', '...']);
    const s = rockShape(1, 1, wall, SEED, T);
    expect(s.south).not.toBeNull();
    const line = pts(s.south!);
    for (let i = 1; i < line.length; i++) expect(line[i][0]).toBeGreaterThanOrEqual(line[i - 1][0] - 1e-6);
    expect(rockShape(1, 0, wall, SEED, T).south).toBeNull();
  });

  it('collision follows the rounded corners and the straight edges', () => {
    const wall = map(['...', '.#.', '...']);
    // right at the corner, just outside the arc: free (the square tile would have blocked it)
    const R = cornerRadius(T, T, SEED, T);
    const cx = T + R, cy = T + R, d = R + 6 + 2, a = Math.PI * 1.25;
    expect(rockTouches(1, 1, wall, SEED, T, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6)).toBe(false);
    // the middle of the north edge: blocked as before
    expect(rockTouches(1, 1, wall, SEED, T, T * 1.5, T - 4, 6)).toBe(true);
    // a corner between two rocks is not rounded
    const two = map(['....', '.##.', '....']);
    expect(rockTouches(1, 1, two, SEED, T, 2 * T + 1, T - 3, 6)).toBe(true);
  });
});
