import { describe, expect, it } from 'vitest';
import { boundsOfChunks, clampCenter, markAt, pixelOf, tileAt, zoomAt, type MapCam } from '../src/core/world/mapView';

const cam: MapCam = { cx: 100, cy: -40, ppt: 4 };

describe('world map camera', () => {
  it('converts between pixels and tiles', () => {
    expect(tileAt(cam, 400, 300, 800, 600)).toEqual({ tx: 100, ty: -40 });
    const p = pixelOf(cam, 110, -30, 800, 600);
    expect(p).toEqual({ x: 440, y: 340 });
    expect(tileAt(cam, p.x, p.y, 800, 600)).toEqual({ tx: 110, ty: -30 });
  });

  it('zooms about the cursor: the tile under it stays put', () => {
    const before = tileAt(cam, 650, 120, 800, 600);
    const z = zoomAt(cam, 8, 650, 120, 800, 600);
    expect(z.ppt).toBe(8);
    const after = tileAt(z, 650, 120, 800, 600);
    expect(after.tx).toBeCloseTo(before.tx);
    expect(after.ty).toBeCloseTo(before.ty);
  });

  it('keeps the centre over explored land', () => {
    const b = boundsOfChunks(['0,0', '2,-1', '-1,3'], 12)!;
    expect(b).toEqual({ x0: -12, y0: -12, x1: 36, y1: 48 });
    expect(clampCenter({ cx: 500, cy: -500, ppt: 2 }, b, 10)).toEqual({ cx: 46, cy: -22, ppt: 2 });
    expect(clampCenter({ cx: 5, cy: 5, ppt: 2 }, b, 10)).toEqual({ cx: 5, cy: 5, ppt: 2 });
    expect(boundsOfChunks([], 12)).toBeNull();
  });

  it('finds the marker under the pointer', () => {
    const marks = [{ tx: 100, ty: -40, label: 'here' }, { tx: 103, ty: -40, label: 'east' }];
    expect(markAt(marks, cam, 401, 301, 800, 600)?.label).toBe('here');
    expect(markAt(marks, cam, 411, 300, 800, 600)?.label).toBe('east');
    expect(markAt(marks, cam, 400, 380, 800, 600)).toBeNull();
  });
});
