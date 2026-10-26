import { describe, expect, it } from 'vitest';
import { FlowField, RAY_BLOCKED, RAY_CLEAR, RAY_HAZARD, lineOfSight, rayCast } from '../src/core/world/nav';
import type { SolidQuery } from '../src/core/types';

const T = 48;
// a vertical wall at tile x = 10 spanning y in [-20, 20] with a gap at y in [14, 15]
const wallWorld: SolidQuery = {
  tileBlocked: (tx, ty) => tx === 10 && ty >= -20 && ty <= 20 && !(ty >= 14 && ty <= 15)
};
const open: SolidQuery = { tileBlocked: () => false };

describe('lineOfSight', () => {
  it('sees through open ground', () => {
    expect(lineOfSight(open, 0, 0, 900, 300)).toBe(true);
  });
  it('is blocked by a wall', () => {
    expect(lineOfSight(wallWorld, 5 * T, 0, 15 * T, 0)).toBe(false);
  });
  it('sees through the gap', () => {
    expect(lineOfSight(wallWorld, 5 * T, 14.5 * T, 15 * T, 14.5 * T)).toBe(true);
  });
  it('same tile is always visible', () => {
    expect(lineOfSight(wallWorld, 3, 3, 10, 10)).toBe(true);
  });
});

describe('FlowField', () => {
  it('routes around a wall through the gap', () => {
    const ff = new FlowField(wallWorld, 30);
    // target east of the wall
    ff.update(15 * T, 0, true);
    // walk an agent from the west side following the field until it arrives
    let x = 5 * T, y = 0;
    const dir = { x: 0, y: 0 };
    let arrived = false;
    for (let i = 0; i < 4000; i++) {
      if (!ff.direction(x, y, dir)) { arrived = Math.hypot(x - 15 * T, y) < 2 * T; break; }
      x += dir.x * 6; y += dir.y * 6;
      if (Math.hypot(x - 15 * T, y) < T) { arrived = true; break; }
    }
    expect(arrived).toBe(true);
  });

  it('reports no route from sealed pockets', () => {
    const sealed: SolidQuery = { tileBlocked: (tx, ty) => Math.max(Math.abs(tx - 5), Math.abs(ty)) === 3 };
    const ff = new FlowField(sealed, 20);
    ff.update(20 * T, 0, true);
    const dir = { x: 0, y: 0 };
    expect(ff.direction(5 * T, 0, dir)).toBe(false);
  });
});

// a strip of lava two tiles wide at tx 10..11, spanning ty in [-span, span]
const lavaWorld = (span: number): SolidQuery => ({
  tileBlocked: () => false,
  navCost: (tx, ty) => (tx >= 10 && tx <= 11 && Math.abs(ty) <= span ? 8 : 1)
});
const isLava = (x: number, y: number, span: number) => {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  return tx >= 10 && tx <= 11 && Math.abs(ty) <= span;
};
function walk(ff: FlowField, x: number, y: number, gx: number, gy: number, span: number) {
  const dir = { x: 0, y: 0 };
  let lava = 0;
  for (let i = 0; i < 4000; i++) {
    if (Math.hypot(x - gx, y - gy) < T) return { arrived: true, lava };
    if (!ff.direction(x, y, dir)) return { arrived: Math.hypot(x - gx, y - gy) < 2 * T, lava };
    x += dir.x * 6; y += dir.y * 6;
    if (isLava(x, y, span)) lava++;
  }
  return { arrived: false, lava };
}

describe('FlowField hazard costs', () => {
  it('walks around a lava strip when the detour is cheaper than wading through', () => {
    const ff = new FlowField(lavaWorld(8), 30);
    ff.update(15.5 * T, 0.5 * T, true);
    const r = walk(ff, 5.5 * T, 0.5 * T, 15.5 * T, 0.5 * T, 8);
    expect(r.arrived).toBe(true);
    expect(r.lava).toBe(0);
  });

  it('wades through when there is no way around', () => {
    const ff = new FlowField(lavaWorld(1000), 30);
    ff.update(15.5 * T, 0.5 * T, true);
    const r = walk(ff, 5.5 * T, 0.5 * T, 15.5 * T, 0.5 * T, 1000);
    expect(r.arrived).toBe(true);
    expect(r.lava).toBeGreaterThan(0);
  });

  it('costs on every tile scale the plain breadth-first distances exactly', () => {
    // scattered walls; the same field searched with cost 1 (breadth-first) and cost 3 (Dial's) everywhere
    const wall = (tx: number, ty: number) => ((tx * 73856093) ^ (ty * 19349663)) % 7 === 0 && (tx || ty);
    const plain = new FlowField({ tileBlocked: (tx, ty) => !!wall(tx, ty) }, 20);
    const heavy = new FlowField({ tileBlocked: () => false, navCost: (tx, ty) => (wall(tx, ty) ? 0 : 3) }, 20);
    plain.update(0, 0, true); heavy.update(0, 0, true);
    let reached = 0;
    for (let i = 0; i < plain.dist.length; i++) {
      if (plain.dist[i] === 65535) { expect(heavy.dist[i]).toBe(65535); continue; }
      expect(heavy.dist[i]).toBe(plain.dist[i] * 3);
      reached++;
    }
    expect(reached).toBeGreaterThan(1000);
  });

  it('plain ground through navCost gives the same field as tileBlocked', () => {
    const a = new FlowField(wallWorld, 25);
    const b = new FlowField({ tileBlocked: () => false, navCost: (tx, ty) => (wallWorld.tileBlocked(tx, ty) ? 0 : 1) }, 25);
    a.update(15 * T, 0, true); b.update(15 * T, 0, true);
    expect(Array.from(b.dist)).toEqual(Array.from(a.dist));
  });

  it('a raycast tells hazards from walls', () => {
    expect(rayCast(lavaWorld(8), 5 * T, 0, 15 * T, 0)).toBe(RAY_HAZARD);
    expect(rayCast(lavaWorld(8), 5 * T, 12 * T, 15 * T, 12 * T)).toBe(RAY_CLEAR);
    expect(lineOfSight(lavaWorld(8), 5 * T, 0, 15 * T, 0)).toBe(true);
    const walled: SolidQuery = { tileBlocked: () => false, navCost: (tx) => (tx === 9 ? 0 : tx === 10 ? 8 : 1) };
    expect(rayCast(walled, 5 * T, 0, 15 * T, 0)).toBe(RAY_BLOCKED);
  });

  it('finds the same distances as a reference Dijkstra on random cost grids', () => {
    for (let seed = 1; seed < 30; seed++) {
      const h = (x: number, y: number) => { let v = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0; v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
      const cost = (x: number, y: number) => { if (!x && !y) return 1; const r = h(x, y); return r < 0.25 ? 0 : r < 0.35 ? 8 : r < 0.4 ? 5 : r < 0.45 ? 2 : 1; };
      const R = 12, N = 25;
      const ff = new FlowField({ tileBlocked: () => false, navCost: cost }, R);
      ff.update(0, 0, true);
      // reference: O(n^2) dijkstra, same edge rules
      const dist = new Array(N * N).fill(Infinity), done = new Array(N * N).fill(false);
      const c = (i: number) => cost(i % N - R, ((i / N) | 0) - R);
      const blk = (i: number) => c(i) === 0 && i !== R * N + R;
      const cc = (i: number) => (c(i) === 0 ? 1 : c(i));
      dist[R * N + R] = 0;
      for (;;) {
        let u = -1; for (let i = 0; i < N * N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0) break; done[u] = true;
        const ux = u % N, uy = (u / N) | 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue; const nx = ux + ox, ny = uy + oy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const ni = ny * N + nx; if (blk(ni)) continue;
          let step = cc(u);
          if (ox && oy) { const a = uy * N + nx, b = ny * N + ux; if (blk(a) || blk(b)) continue; step = Math.max(step, cc(a), cc(b)); }
          if (dist[u] + step < dist[ni]) dist[ni] = dist[u] + step;
        }
      }
      for (let i = 0; i < N * N; i++) expect(ff.dist[i], `seed ${seed} cell ${i}`).toBe(dist[i] === Infinity ? 65535 : dist[i]);
    }
  });
});

describe('FlowField off the grid', () => {
  it('guides a monster standing on a hard tile back onto the field', () => {
    // a 2x2 block of hard tiles at (5..6, 0..1); the target is at (12, 0)
    const w: SolidQuery = { tileBlocked: (tx, ty) => tx >= 5 && tx <= 6 && ty >= 0 && ty <= 1 };
    const ff = new FlowField(w, 20);
    ff.update(12.5 * T, 0.5 * T, true);
    const dir = { x: 0, y: 0 };
    expect(ff.direction(6.5 * T, 0.5 * T, dir)).toBe(true);
    expect(dir.x).toBeGreaterThan(0.5);
  });
});
