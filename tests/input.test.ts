import { describe, expect, it } from 'vitest';
import {
  BTN, DEFAULT_BINDINGS, PadMapper, buttonLabel, deadzone, padGlyph, padKind, pickNeighbor, stickDir,
  type PadSnapshot, type Rect
} from '../src/core/input/gamepad';

const snap = (over: { axes?: number[]; down?: number[]; id?: string } = {}): PadSnapshot => ({
  id: over.id ?? 'Xbox 360 Controller (STANDARD GAMEPAD)',
  axes: over.axes ?? [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!over.down?.includes(i), value: over.down?.includes(i) ? 1 : 0 }))
});

describe('dead zone', () => {
  it('ignores drift and rescales the rest of the range', () => {
    expect(deadzone(0.1, 0.05, 0.2)).toEqual({ x: 0, y: 0 });
    const v = deadzone(1, 0, 0.2);
    expect(v.x).toBeCloseTo(1);
    const half = deadzone(0.6, 0, 0.2);
    expect(half.x).toBeCloseTo(0.5);
    const diag = deadzone(0.7, 0.7, 0.2);
    expect(Math.hypot(diag.x, diag.y)).toBeLessThanOrEqual(1.0001);
  });

  it('turns a stick push into one dominant direction', () => {
    expect(stickDir({ x: 0.9, y: 0.2 })).toBe('right');
    expect(stickDir({ x: -0.2, y: -0.9 })).toBe('up');
    expect(stickDir({ x: 0.3, y: 0.3 })).toBeNull();
  });
});

describe('pad mapper', () => {
  it('reports button edges once, and holds', () => {
    const m = new PadMapper();
    expect(m.update(snap(), 0).pressed.size).toBe(0);
    const a = m.update(snap({ down: [BTN.A] }), 16);
    expect(a.pressed.has('interact')).toBe(true);
    const held = m.update(snap({ down: [BTN.A] }), 32);
    expect(held.pressed.has('interact')).toBe(false);
    expect(held.held.has('interact')).toBe(true);
    const gone = m.update(snap(), 48);
    expect(gone.held.has('interact')).toBe(false);
    expect(m.update(snap({ down: [BTN.A] }), 64).pressed.has('interact')).toBe(true);
  });

  it('maps the face buttons and triggers to skills, shoulders to heroes', () => {
    const m = new PadMapper();
    const f = m.update(snap({ down: [BTN.X, BTN.Y, BTN.RT, BTN.LB, BTN.RB, BTN.BACK, BTN.START, BTN.B] }), 0);
    for (const a of ['skill1', 'skill2', 'skill3', 'prevHero', 'nextHero', 'map', 'menu', 'cancel'] as const) expect(f.pressed.has(a)).toBe(true);
  });

  it('treats an analog trigger as pressed past half way', () => {
    const m = new PadMapper();
    const s = snap();
    (s.buttons as any)[BTN.RT] = { pressed: false, value: 0.7 };
    expect(m.update(s, 0).pressed.has('skill3')).toBe(true);
    (s.buttons as any)[BTN.RT] = { pressed: false, value: 0.2 };
    expect(m.update(s, 16).held.has('skill3')).toBe(false);
  });

  it('auto-repeats a held d-pad direction after a delay, then at a steady rate', () => {
    const m = new PadMapper({ repeatDelay: 400, repeatRate: 100 });
    const hits: number[] = [];
    for (let t = 0; t <= 1000; t += 16) if (m.update(snap({ down: [BTN.DOWN] }), t).pressed.has('down')) hits.push(t);
    expect(hits[0]).toBe(0);
    expect(hits[1]).toBeGreaterThanOrEqual(400);
    expect(hits[1]).toBeLessThan(430);
    expect(hits[2] - hits[1]).toBeGreaterThanOrEqual(100);
    expect(hits[2] - hits[1]).toBeLessThan(130);
    // releasing and pressing again fires at once
    m.update(snap(), 1100);
    expect(m.update(snap({ down: [BTN.DOWN] }), 1116).pressed.has('down')).toBe(true);
  });

  it('exposes the left stick as movement and as navigation events', () => {
    const m = new PadMapper();
    const f = m.update(snap({ axes: [0, 0.9, 0, 0] }), 0);
    expect(f.move.y).toBeGreaterThan(0.8);
    expect(f.stick).toBe('down');
    expect(f.active).toBe(true);
    expect(m.update(snap({ axes: [0, 0.9, 0, 0] }), 16).stick).toBeNull();
    const r = m.update(snap({ axes: [0, 0, 0.8, 0] }), 32);
    expect(r.aim.x).toBeGreaterThan(0.7);
    expect(r.move).toEqual({ x: 0, y: 0 });
  });

  it('is idle when nothing is touched, and resets when the pad goes away', () => {
    const m = new PadMapper();
    expect(m.update(snap({ axes: [0.05, -0.08, 0, 0] }), 0).active).toBe(false);
    m.update(snap({ down: [BTN.A] }), 16);
    m.update(null, 32);
    expect(m.update(snap({ down: [BTN.A] }), 48).pressed.has('interact')).toBe(true);
  });

  it('honours the dead zone setting', () => {
    const m = new PadMapper({ deadzone: 0.5 });
    expect(m.update(snap({ axes: [0.4, 0, 0, 0] }), 0).move.x).toBe(0);
    expect(m.update(snap({ axes: [0.9, 0, 0, 0] }), 16).move.x).toBeGreaterThan(0.5);
  });
});

describe('controller labels', () => {
  it('recognises controller families from their ids', () => {
    expect(padKind('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padKind('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe('playstation');
    expect(padKind('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('switch');
    expect(padKind('Some Pad')).toBe('generic');
  });

  it('labels the same button by what is printed on it', () => {
    expect(padGlyph('xbox', 'interact')).toBe('A');
    expect(padGlyph('playstation', 'interact')).toBe('✕');
    expect(padGlyph('playstation', 'skill1')).toBe('□');
    expect(padGlyph('switch', 'interact')).toBe('B');
    expect(buttonLabel('xbox', 99)).toBe('Btn 99');
    expect(DEFAULT_BINDINGS.interact).toEqual([BTN.A]);
  });
});

describe('spatial navigation', () => {
  // a 3 x 2 grid of 100 x 40 buttons, 20 apart
  const grid: Rect[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) grid.push({ x: c * 120, y: r * 60, w: 100, h: 40 });

  it('moves along rows and columns', () => {
    expect(pickNeighbor(grid[0], grid, 'right', 0)).toBe(1);
    expect(pickNeighbor(grid[1], grid, 'right', 1)).toBe(2);
    expect(pickNeighbor(grid[1], grid, 'down', 1)).toBe(4);
    expect(pickNeighbor(grid[4], grid, 'up', 4)).toBe(1);
    expect(pickNeighbor(grid[4], grid, 'left', 4)).toBe(3);
  });

  it('stays put at an edge', () => {
    expect(pickNeighbor(grid[0], grid, 'left', 0)).toBe(-1);
    expect(pickNeighbor(grid[0], grid, 'up', 0)).toBe(-1);
    expect(pickNeighbor(grid[5], grid, 'right', 5)).toBe(-1);
    expect(pickNeighbor(grid[5], grid, 'down', 5)).toBe(-1);
  });

  it('picks the top-left element when nothing is focused', () => {
    expect(pickNeighbor(null, [...grid].reverse(), 'down')).toBe(5);   // the reversed list ends with grid[0]
    expect(pickNeighbor(null, [], 'down')).toBe(-1);
  });

  it('prefers a straight line over a nearer element off to the side', () => {
    const items: Rect[] = [
      { x: 0, y: 0, w: 100, h: 40 },
      { x: 130, y: 60, w: 100, h: 40 },     // nearer diagonally, but not below
      { x: 0, y: 140, w: 100, h: 40 }       // straight below, farther
    ];
    expect(pickNeighbor(items[0], items, 'down', 0)).toBe(2);
  });

  it('handles a tall list with two columns (loadout style)', () => {
    const left: Rect[] = [0, 1, 2, 3].map((i) => ({ x: 0, y: i * 50, w: 300, h: 40 }));
    const right: Rect[] = [0, 1].map((i) => ({ x: 340, y: i * 120, w: 60, h: 60 }));
    const all = [...left, ...right];
    expect(pickNeighbor(left[1], all, 'right', 1)).toBe(4);     // right column, nearest by height
    expect(pickNeighbor(right[1], all, 'left', 5)).toBe(3);     // overlaps rows 2 and 3 of the list, row 3 is closer
    expect(pickNeighbor(left[3], all, 'down', 3)).toBe(-1);
  });
});
