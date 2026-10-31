// Is a cave, ruin or dungeon fully done: every floor's monsters defeated and every chest opened? Pure.
// Floors are rebuilt from the seed, so floors never visited still count: nothing is complete until the player
// has been everywhere.
import { createInterior } from './interiors';
import type { Poi } from '../types';

/** What a floor holds, from its seed. */
export interface FloorManifest { chests: number; vault: boolean; spawns: number; boss: boolean }

/** The saved state of a place (as kept in `visited`): floor 0 is the place itself, deeper floors under `floors`. */
export interface FloorProgressState { opened: (number | string)[]; cleared: boolean }
export interface PlaceProgressState extends FloorProgressState {
  floors?: Record<string, FloorProgressState>;
  bossDead?: boolean;
  bossChestOpened?: boolean;
}

export interface Progress {
  floors: number; floorsCleared: number;
  chests: number; chestsOpened: number;
  hasBoss: boolean; bossDown: boolean;
  done: boolean;
}

/** Every floor of a cave, ruin or dungeon (towns have nothing to clear: null). */
export function placeManifest(poi: Poi): FloorManifest[] | null {
  if (poi.type === 'city') return null;
  const n = poi.dungeon ? poi.dungeon.floors : 1;
  const out: FloorManifest[] = [];
  for (let f = 0; f < n; f++) {
    const src = createInterior(poi, f);
    out.push({ chests: src.chests.length, vault: !!src.puzzle, spawns: src.spawns.length, boss: !!src.boss });
  }
  return out;
}

export function placeProgress(manifest: FloorManifest[], place: PlaceProgressState | null | undefined): Progress {
  let floorsCleared = 0, chests = 0, chestsOpened = 0, hasBoss = false;
  const bossDown = !!place?.bossDead;
  manifest.forEach((m, f) => {
    const st = f === 0 ? place : place?.floors?.[f];
    const opened = new Set(st?.opened ?? []);
    // a floor counts as cleared once all its monsters fell in one visit (the boss floor also needs the boss down)
    if ((m.spawns === 0 || !!st?.cleared) && (!m.boss || bossDown)) floorsCleared++;
    chests += m.chests;
    for (let i = 0; i < m.chests; i++) if (opened.has(i)) chestsOpened++;
    if (m.vault) { chests++; if (opened.has('vault')) chestsOpened++; }
    if (m.boss) { hasBoss = true; chests++; if (place?.bossChestOpened) chestsOpened++; }
  });
  return {
    floors: manifest.length, floorsCleared, chests, chestsOpened, hasBoss, bossDown,
    done: floorsCleared === manifest.length && chestsOpened === chests && (!hasBoss || bossDown)
  };
}

/** One line for the journal: "cleared" (everything done), or what is left ("boss defeated · floors 2/3 cleared · chests 5/7"). */
export function progressText(p: Progress): string {
  if (p.done) return 'cleared';
  const parts: string[] = [];
  if (p.hasBoss) parts.push(p.bossDown ? 'boss defeated' : 'the boss waits');
  if (p.floors > 1) parts.push(`floors ${p.floorsCleared}/${p.floors} cleared`);
  else parts.push(p.floorsCleared ? 'monsters defeated' : 'monsters remain');
  if (p.chests) parts.push(`chests ${p.chestsOpened}/${p.chests}`);
  return parts.join(' · ');
}
