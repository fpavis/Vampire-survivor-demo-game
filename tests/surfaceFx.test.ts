import { describe, expect, it } from 'vitest';
import { NO_LOOK, SURFACE_LOOK, blendLook, surfaceLook } from '../src/core/world/surfaceFx';
import { SURFACE_IDS } from '../src/core/world/surfaces';

describe('terrain modifier feedback', () => {
  it('every surface that changes something has a look and a note; roads stay plain', () => {
    for (const id of SURFACE_IDS) {
      if (id === 'road') { expect(SURFACE_LOOK[id]).toBeUndefined(); continue; }
      const l = SURFACE_LOOK[id]!;
      expect(l.tintAlpha, id).toBeGreaterThan(0);
      expect(l.note.length, id).toBeGreaterThan(3);
    }
  });

  it('lava burns red with a heat haze, ice turns blue with frost, quicksand drains the colour', () => {
    const lava = surfaceLook('lava', 1, false), ice = surfaceLook('ice', 1, false), sand = surfaceLook('quicksand', 1, false);
    expect((lava.tint >> 16) & 255).toBeGreaterThan(200);
    expect(lava.shimmer).toBe(1);
    expect(ice.tint & 255).toBeGreaterThan(200);
    expect(ice.edge).not.toBeNull();
    expect(sand.desat).toBeGreaterThan(0.5);
  });

  it('follows the flash setting but never vanishes, and has no shimmer under reduced motion', () => {
    const full = surfaceLook('lava', 1, false), low = surfaceLook('lava', 0, false), still = surfaceLook('lava', 1, true);
    expect(low.tintAlpha).toBeCloseTo(full.tintAlpha * 0.4);
    expect(low.tintAlpha).toBeGreaterThan(0);
    expect(low.shimmer).toBe(0);
    expect(still.shimmer).toBe(0);
    expect(still.tintAlpha).toBe(full.tintAlpha);
    expect(surfaceLook(null, 1, false)).toEqual(NO_LOOK);
  });

  it('eases from one look to the next', () => {
    const a = surfaceLook('lava', 1, false), b = NO_LOOK;
    const half = blendLook(a, b, 0.5);
    expect(half.tintAlpha).toBeCloseTo(a.tintAlpha / 2);
    expect(blendLook(a, b, 1).tintAlpha).toBe(0);
  });
});
