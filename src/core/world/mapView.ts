// The world map panel's camera: zoom steps, zooming about the cursor, panning limits, screen <-> tile. Pure.

/** Pixels per tile at each zoom step: the overworld zooms far out, a dungeon floor stays close. */
export const MAP_ZOOMS = { overworld: [1, 2, 3, 4, 6, 8], interior: [4, 6, 8, 12] } as const;
export const DEFAULT_ZOOM = { overworld: 3, interior: 1 } as const;   // indices into MAP_ZOOMS

export interface MapCam { cx: number; cy: number; ppt: number }       // centre in tiles, pixels per tile
export interface TileBounds { x0: number; y0: number; x1: number; y1: number }

/** The tile under a pixel of a w x h map canvas. */
export const tileAt = (cam: MapCam, px: number, py: number, w: number, h: number) =>
  ({ tx: cam.cx + (px - w / 2) / cam.ppt, ty: cam.cy + (py - h / 2) / cam.ppt });

/** The pixel of a tile on a w x h map canvas. */
export const pixelOf = (cam: MapCam, tx: number, ty: number, w: number, h: number) =>
  ({ x: w / 2 + (tx - cam.cx) * cam.ppt, y: h / 2 + (ty - cam.cy) * cam.ppt });

/** Change the zoom keeping the tile under (px, py) where it is on screen (the wheel zooms about the cursor). */
export function zoomAt(cam: MapCam, ppt: number, px: number, py: number, w: number, h: number): MapCam {
  const t = tileAt(cam, px, py, w, h);
  return { ppt, cx: t.tx - (px - w / 2) / ppt, cy: t.ty - (py - h / 2) / ppt };
}

/** Keep the centre over explored land (plus a margin) so the map can never be dragged into empty darkness. */
export function clampCenter(cam: MapCam, b: TileBounds | null, margin = 40): MapCam {
  if (!b) return cam;
  return {
    ...cam,
    cx: Math.max(b.x0 - margin, Math.min(b.x1 + margin, cam.cx)),
    cy: Math.max(b.y0 - margin, Math.min(b.y1 + margin, cam.cy))
  };
}

/** The explored area from fog chunk keys ("cx,cy"), in tiles. */
export function boundsOfChunks(keys: Iterable<string>, chunkTiles: number): TileBounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of keys) {
    const [cx, cy] = k.split(',').map(Number);
    x0 = Math.min(x0, cx * chunkTiles); y0 = Math.min(y0, cy * chunkTiles);
    x1 = Math.max(x1, (cx + 1) * chunkTiles); y1 = Math.max(y1, (cy + 1) * chunkTiles);
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

export interface MapMark { tx: number; ty: number; label: string; detail?: string }

/** The labelled marker nearest a pixel, within `radius` pixels, or null (the map's hover and pick). */
export function markAt<M extends MapMark>(marks: M[], cam: MapCam, px: number, py: number, w: number, h: number, radius = 16): M | null {
  let best: M | null = null, bd = radius * radius;
  for (const m of marks) {
    const p = pixelOf(cam, m.tx, m.ty, w, h);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d <= bd) { bd = d; best = m; }
  }
  return best;
}

/** A mark's identity while stepping through them (two marks never share a place and a name). */
export const markKey = (m: MapMark) => `${m.tx},${m.ty},${m.label}`;

/** The marks in stepping order: nearest the anchor first, then outward; ties by name, so the order is stable. */
export function markOrder<M extends MapMark>(marks: M[], ax: number, ay: number): M[] {
  return marks
    .map((m) => ({ m, d: (m.tx - ax) ** 2 + (m.ty - ay) ** 2 }))
    .sort((a, b) => a.d - b.d || a.m.label.localeCompare(b.m.label) || a.m.tx - b.m.tx || a.m.ty - b.m.ty)
    .map((x) => x.m);
}

/** The mark after the current one (+1 outward, -1 back in), wrapping round; with none current, the first or the last. */
export function stepMark<M extends MapMark>(order: M[], current: string | null, dir: 1 | -1): M | null {
  if (!order.length) return null;
  const i = current === null ? -1 : order.findIndex((m) => markKey(m) === current);
  if (i < 0) return dir > 0 ? order[0] : order[order.length - 1];
  return order[(i + dir + order.length) % order.length];
}

/** Pins the player puts on the overworld map: three colours, and a few dozen at most. */
export const PIN_COLORS = ['gold', 'red', 'blue'] as const;
export type PinColor = typeof PIN_COLORS[number];
export const PIN_HEX: Record<PinColor, string> = { gold: '#ffd24a', red: '#ff5a5a', blue: '#5ab8ff' };
export const MAX_PINS = 30;
export interface MapPin { tx: number; ty: number; color: PinColor }

/** The pin nearest (x, y) within `radius` tiles (measured to the middle of its tile), or -1. */
export function pinNear(pins: readonly MapPin[], x: number, y: number, radius: number): number {
  let best = -1, bd = radius * radius;
  pins.forEach((p, i) => {
    const d = (p.tx + 0.5 - x) ** 2 + (p.ty + 0.5 - y) ** 2;
    if (d <= bd) { bd = d; best = i; }
  });
  return best;
}

/**
 * The pin button at (x, y): a new gold pin on that tile, or, on a pin, its next colour; after the last colour
 * the pin goes. A full map takes no new pin.
 */
export function togglePin(pins: readonly MapPin[], x: number, y: number, radius: number, max = MAX_PINS):
  { pins: MapPin[]; did: 'added' | 'recoloured' | 'removed' | 'full'; pin: MapPin | null } {
  const i = pinNear(pins, x, y, radius);
  if (i >= 0) {
    const p = pins[i], k = PIN_COLORS.indexOf(p.color);
    if (k >= PIN_COLORS.length - 1) return { pins: pins.filter((_, j) => j !== i), did: 'removed', pin: p };
    const next = { ...p, color: PIN_COLORS[k + 1] };
    return { pins: pins.map((q, j) => (j === i ? next : q)), did: 'recoloured', pin: next };
  }
  if (pins.length >= max) return { pins: [...pins], did: 'full', pin: null };
  const pin: MapPin = { tx: Math.floor(x), ty: Math.floor(y), color: PIN_COLORS[0] };
  return { pins: [...pins, pin], did: 'added', pin };
}

/** Pins from a save, cleaned: whole tiles, known colours, no two on one tile, at most MAX_PINS. */
export function cleanPins(raw: unknown): MapPin[] {
  if (!Array.isArray(raw)) return [];
  const out: MapPin[] = [], seen = new Set<string>();
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { tx, ty, color } = p as Record<string, unknown>;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    const pin: MapPin = { tx: Math.floor(tx as number), ty: Math.floor(ty as number), color: (PIN_COLORS as readonly string[]).includes(color as string) ? (color as PinColor) : 'gold' };
    const k = `${pin.tx},${pin.ty}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(pin);
    if (out.length >= MAX_PINS) break;
  }
  return out;
}
