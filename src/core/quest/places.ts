// Finding the places quests talk about, from the seeded world alone (no loaded chunks needed).
import { POI_CELL } from '../world/terrain';
import type { Poi } from '../types';
import type { PlaceTarget } from './quests';

export interface PoiSource { poiForCell(cx: number, cy: number): Poi | null }

const MAX_RINGS = 70;

export const matchesTarget = (t: PlaceTarget, p: Poi): boolean => {
  if (t.kind === 'dungeon' && !p.dungeon) return false;
  if (t.kind === 'town' && p.type !== 'city') return false;
  if ((t.kind === 'cave' || t.kind === 'ruins') && p.type !== t.kind) return false;
  if (t.group && p.group !== t.group) return false;
  return true;
};

/** The nth nearest land place matching the target (plateau and sea dungeons exist only once the world makes them). */
export function findPlace(source: PoiSource, t: PlaceTarget): Poi | null {
  if (t.realm && t.realm !== 'land') return null;
  const nth = t.nth ?? 0;
  const near = t.near ?? { tx: 0, ty: 0 };
  const c0x = Math.floor(near.tx / POI_CELL), c0y = Math.floor(near.ty / POI_CELL);
  const found: { p: Poi; d: number }[] = [];
  for (let r = 0; r <= MAX_RINGS; r++) {
    for (let cy = c0y - r; cy <= c0y + r; cy++) for (let cx = c0x - r; cx <= c0x + r; cx++) {
      if (Math.max(Math.abs(cx - c0x), Math.abs(cy - c0y)) !== r) continue;
      const p = source.poiForCell(cx, cy);
      if (p && matchesTarget(t, p) && !(t.kind === 'dungeon' && p.dungeon?.realm !== 'land')) found.push({ p, d: Math.hypot(p.tx - near.tx, p.ty - near.ty) });
    }
    if (found.length > nth) {
      found.sort((a, b) => a.d - b.d);
      // nothing in a farther ring can be nearer than what is already known to be the nth
      if (r * POI_CELL > found[nth].d + POI_CELL) return found[nth].p;
    }
  }
  found.sort((a, b) => a.d - b.d);
  return found[nth]?.p ?? null;
}
