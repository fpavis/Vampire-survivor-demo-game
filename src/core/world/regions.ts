// Named regions: jittered Voronoi cells over the overworld. Each has a seeded name, a style word from the
// landscape at its heart ("the Weald of Morvale"), a level and, when one is near, a capital town.
// Pure and deterministic; nothing here is saved except which regions the player has seen.
import { hash } from './noise';

export const REGION_CELL = 112;               // tiles per region cell
export const START_REGION_NAME = 'Hearthvale';

const PRE = ['Eld', 'Thal', 'Mor', 'Ash', 'Bren', 'Cal', 'Dun', 'Er', 'Fen', 'Gal', 'Hal', 'Ith', 'Kar', 'Lor', 'Mar', 'Nor',
  'Ost', 'Ral', 'Sil', 'Tor', 'Ul', 'Val', 'Wyn', 'Yr', 'Bel', 'Cor', 'Dra', 'Gor'];
const MID = ['', '', 'a', 'e', 'i', 'o', 'an', 'ar', 'en', 'is'];
const SUF = ['moor', 'vale', 'mark', 'hold', 'reach', 'fell', 'wyn', 'gard', 'dell', 'shire', 'crest', 'heim', 'dor', 'wick', 'mere', 'ford'];
const STYLE: Record<string, string[]> = {
  field: ['Vales', 'Meadows', 'Downs'],
  forest: ['Wilds', 'Weald', 'Greenwood'],
  desert: ['Wastes', 'Sands', 'Barrens'],
  shore: ['Coast', 'Strand', 'Isles'],
  mountain: ['Highlands', 'Peaks', 'Crags']
};

export interface RegionInfo {
  id: string;            // "cx,cy" of its cell
  tx: number; ty: number;  // its heart (tile)
  name: string;          // "Morvale"
  title: string;         // "the Weald of Morvale"
}

/** The heart of region cell (cx, cy), jittered inside the cell. The start region's heart is the origin. */
export function regionHeart(seed: number, cx: number, cy: number): { tx: number; ty: number } {
  if (cx === 0 && cy === 0) return { tx: 0, ty: 0 };
  return {
    tx: Math.round((cx + 0.2 + 0.6 * hash(cx, cy, seed + 7100)) * REGION_CELL - REGION_CELL / 2),
    ty: Math.round((cy + 0.2 + 0.6 * hash(cx, cy, seed + 7101)) * REGION_CELL - REGION_CELL / 2)
  };
}

/** Id of the region a tile belongs to: the nearest heart among the neighbouring cells. */
export function regionAt(seed: number, tx: number, ty: number): string {
  const cx = Math.floor((tx + REGION_CELL / 2) / REGION_CELL), cy = Math.floor((ty + REGION_CELL / 2) / REGION_CELL);
  let best = '', bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const h = regionHeart(seed, cx + dx, cy + dy);
    const d = (h.tx - tx) ** 2 + (h.ty - ty) ** 2;
    if (d < bd) { bd = d; best = `${cx + dx},${cy + dy}`; }
  }
  return best;
}

export function regionName(seed: number, cx: number, cy: number): string {
  if (cx === 0 && cy === 0) return START_REGION_NAME;
  const pick = <T>(a: T[], n: number) => a[Math.floor(hash(cx, cy, seed + n) * a.length)];
  const name = pick(PRE, 7110) + pick(MID, 7111) + pick(SUF, 7112);
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Full description of a region; `groupAt` gives the biome group at a tile (from the terrain source). */
export function regionInfo(seed: number, id: string, groupAt: (tx: number, ty: number) => string): RegionInfo {
  const [cx, cy] = id.split(',').map(Number);
  const h = regionHeart(seed, cx, cy);
  const name = regionName(seed, cx, cy);
  const styles = STYLE[groupAt(h.tx, h.ty)] ?? STYLE.field;
  const style = styles[Math.floor(hash(cx, cy, seed + 7113) * styles.length)];
  return { id, tx: h.tx, ty: h.ty, name, title: `the ${style} of ${name}` };
}
