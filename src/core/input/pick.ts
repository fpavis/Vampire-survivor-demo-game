// Experimental mouse interaction: which thing within reach a click landed on. Pure.
// Clicks arrive as points on the ground plane. Objects stand up out of it, so the top of a tree or a door is
// drawn above its base and maps to a ground point north of it: each candidate is hit-tested as a box rising from
// its base, `w` wide and `h` world units tall (screen height divided by the ground tilt).

export interface ClickCandidate<T> {
  t: T;
  x: number; y: number;    // the base, where the object meets the ground
  w?: number;              // box width (world units)
  h?: number;              // box height up the screen, in world units
}

const BELOW = 28;          // a click a little below the base still counts

/** The candidate under the click, or null: the one whose middle is closest when several boxes overlap. */
export function pickClicked<T>(cands: ClickCandidate<T>[], wx: number, wy: number): T | null {
  let best: ClickCandidate<T> | null = null, bd = Infinity;
  for (const c of cands) {
    const w = c.w ?? 64, h = c.h ?? 80;
    const dx = wx - c.x, up = c.y - wy;
    if (Math.abs(dx) > w / 2 || up < -BELOW || up > h) continue;
    const d = Math.hypot(dx, up - h * 0.35);
    if (d < bd) { bd = d; best = c; }
  }
  return best ? best.t : null;
}
