// The pixel grain of the art style, pure. One art pixel is `grain` world pixels; on screen that is grain x zoom CSS
// pixels, rounded to a whole number of device pixels (at least two) so every cell is the same size and sharp.

/** Size of one art pixel on screen, in CSS pixels, for a grain in world pixels at a zoom and render resolution. */
export function pixelCell(grain: number, zoom: number, resolution: number): number {
  const device = Math.max(2, Math.round(grain * zoom * resolution));
  return device / resolution;
}

/** A screen position moved onto the cell grid (the camera snaps so the world does not shimmer as it scrolls). */
export const snapToCell = (v: number, cell: number) => (cell > 0 ? Math.round(v / cell) * cell : Math.round(v));
