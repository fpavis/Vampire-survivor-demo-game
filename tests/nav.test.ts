import { describe, expect, it } from 'vitest';
import { FlowField, lineOfSight } from '../src/core/world/nav';
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
