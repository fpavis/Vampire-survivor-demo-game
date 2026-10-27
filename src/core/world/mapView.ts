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
