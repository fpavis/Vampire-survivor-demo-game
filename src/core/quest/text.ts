// Names the quest text uses for regions and compass bearings.
export const GROUP_NAMES: Record<string, string> = {
  field: 'Verdant Fields', forest: 'Whispering Woods', desert: 'Scorched Dunes', shore: 'Salt Shore', mountain: 'Stonecrest Mountains'
};

const POINTS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];

/** The compass point a displacement lies in: "northeast". */
export function compass(dx: number, dy: number): string {
  const ang = Math.atan2(dy, dx);                       // 0 = east, clockwise (y points south)
  return POINTS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

/** "about 83 tiles northeast" from a tile to another. */
export function bearing(from: { tx: number; ty: number }, to: { tx: number; ty: number }): string {
  const dx = to.tx - from.tx, dy = to.ty - from.ty;
  const dist = Math.round(Math.hypot(dx, dy));
  if (dist < 6) return 'right here';
  return `about ${dist} tiles ${compass(dx, dy)}`;
}

const SAME_IN_PLURAL = new Set(['Jellyfish', 'Djinn']);
/** The plural of a monster's name: Wolf is Wolves, Mummy is Mummies, Thorn Witch is Thorn Witches. */
export function pluralName(name: string): string {
  const cut = name.lastIndexOf(' ') + 1, head = name.slice(0, cut), word = name.slice(cut);
  if (SAME_IN_PLURAL.has(word)) return name;
  if (/[^aeiou]y$/i.test(word)) return head + word.slice(0, -1) + 'ies';
  if (/[^f]f$/i.test(word)) return head + word.slice(0, -1) + 'ves';
  if (/(s|x|ch|sh)$/i.test(word)) return head + word + 'es';
  return head + word + 's';
}
