import { describe, expect, it } from 'vitest';
import { boundsOfChunks, clampCenter, markAt, pixelOf, tileAt, zoomAt, type MapCam, MAX_PINS, PIN_COLORS, cleanPins, markKey, markOrder, pinNear, stepMark, togglePin } from '../src/core/world/mapView';

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

describe('stepping through the marks', () => {
  const marks = [
    { tx: 10, ty: 0, label: 'Far' }, { tx: 2, ty: 0, label: 'Near' }, { tx: 0, ty: 5, label: 'Mid' }, { tx: -5, ty: 0, label: 'Also mid' }
  ];
  it('goes nearest first, then outward, ties by name', () => {
    expect(markOrder(marks, 0, 0).map((m) => m.label)).toEqual(['Near', 'Also mid', 'Mid', 'Far']);
  });
  it('steps on and back, wrapping round, and starts at either end', () => {
    const o = markOrder(marks, 0, 0);
    expect(stepMark(o, null, 1)!.label).toBe('Near');
    expect(stepMark(o, null, -1)!.label).toBe('Far');
    expect(stepMark(o, markKey(o[0]), 1)!.label).toBe('Also mid');
    expect(stepMark(o, markKey(o[3]), 1)!.label).toBe('Near');
    expect(stepMark(o, markKey(o[0]), -1)!.label).toBe('Far');
    expect(stepMark(o, 'gone', 1)!.label).toBe('Near');
    expect(stepMark([], null, 1)).toBeNull();
  });
});

describe('map pins', () => {
  it('a press drops a gold pin on the tile, the next ones recolour it, then it goes', () => {
    let r = togglePin([], 4.7, 9.2, 1);
    expect(r.did).toBe('added');
    expect(r.pins).toEqual([{ tx: 4, ty: 9, color: 'gold' }]);
    const seen = [r.pins[0].color];
    for (let i = 1; i < PIN_COLORS.length; i++) { r = togglePin(r.pins, 4.5, 9.5, 1); expect(r.did).toBe('recoloured'); seen.push(r.pins[0].color); }
    expect(seen).toEqual([...PIN_COLORS]);
    r = togglePin(r.pins, 4.4, 9.6, 1);
    expect(r.did).toBe('removed');
    expect(r.pins).toEqual([]);
  });
  it('only a pin within reach is the one pressed on; the nearest wins', () => {
    const pins = [{ tx: 0, ty: 0, color: 'gold' as const }, { tx: 2, ty: 0, color: 'gold' as const }];
    expect(pinNear(pins, 1.6, 0.5, 1)).toBe(1);
    expect(pinNear(pins, 6, 6, 1)).toBe(-1);
    expect(togglePin(pins, 6, 6, 1).did).toBe('added');
  });
  it('a full map takes no new pin', () => {
    const pins = Array.from({ length: MAX_PINS }, (_, i) => ({ tx: i * 5, ty: 0, color: 'gold' as const }));
    const r = togglePin(pins, 1000, 1000, 1);
    expect(r.did).toBe('full');
    expect(r.pins.length).toBe(MAX_PINS);
  });
  it('pins from a save are cleaned', () => {
    expect(cleanPins(undefined)).toEqual([]);
    expect(cleanPins([{ tx: 1.5, ty: 2, color: 'red' }, { tx: 1, ty: 2, color: 'blue' }, { tx: 'x', ty: 0 }, null, { tx: 3, ty: 3, color: 'mauve' }]))
      .toEqual([{ tx: 1, ty: 2, color: 'red' }, { tx: 3, ty: 3, color: 'gold' }]);
    expect(cleanPins(Array.from({ length: 50 }, (_, i) => ({ tx: i, ty: 0, color: 'gold' }))).length).toBe(MAX_PINS);
  });
});
