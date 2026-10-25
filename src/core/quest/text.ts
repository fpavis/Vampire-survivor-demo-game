// Names the quest text uses for regions and compass bearings.
export const GROUP_NAMES: Record<string, string> = {
  field: 'Verdant Fields', forest: 'Whispering Woods', desert: 'Scorched Dunes', shore: 'Salt Shore', mountain: 'Stonecrest Mountains'
};

const POINTS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];

/** "about 83 tiles northeast" from a tile to another. */
export function bearing(from: { tx: number; ty: number }, to: { tx: number; ty: number }): string {
  const dx = to.tx - from.tx, dy = to.ty - from.ty;
  const dist = Math.round(Math.hypot(dx, dy));
  if (dist < 6) return 'right here';
  const ang = Math.atan2(dy, dx);                       // 0 = east, clockwise (y points south)
  const p = POINTS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  return `about ${dist} tiles ${p}`;
}
