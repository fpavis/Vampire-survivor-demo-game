// Claimable hold-out zones and on-step ambush plates. Pure and seeded; the player's progress lives in save deltas.
import { WORLD_CONFIG } from '../config';
import { hash } from './noise';
import { BIOME, groupOf, isSolidBiome, isWaterBiome } from './biomes';
import { GROUP_LEVEL_OFFSET, zoneLevel } from './difficulty';
import type { OverworldSource } from './terrain';

const T = WORLD_CONFIG.tile;
export const SITE_CELL = 28;                 // tiles per site cell
export const CLAIM_SECONDS = 36;             // time inside the zone to claim it
export const CLAIM_RADIUS = 5.2 * T;
export const TRIGGER_RADIUS = 1.1 * T;
export const CLAIMED_REGEN = 2.5;            // hp/s inside a claimed zone
export const CLAIMED_SAFE_RADIUS = 9 * T;    // no hostile spawns this close to a claimed flag

export type SiteKind = 'claim' | 'trigger';
export interface Site {
  id: string;
  kind: SiteKind;
  tx: number; ty: number;
  x: number; y: number;
  level: number;
  group: string;
  radius: number;
  waves: number;                              // hold-out waves (claim) or enemies in the ambush (trigger)
}

export class Sites {
  private cache = new Map<string, Site | null>();
  constructor(private source: OverworldSource, private seed: number = source.seed) {}

  forCell(cx: number, cy: number): Site | null {
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const s = this.make(cx, cy);
    this.cache.set(key, s);
    return s;
  }

  /** every site whose cell overlaps the square around (tx, ty) */
  near(tx: number, ty: number, radiusTiles: number): Site[] {
    const out: Site[] = [];
    const c0x = Math.floor((tx - radiusTiles) / SITE_CELL), c1x = Math.floor((tx + radiusTiles) / SITE_CELL);
    const c0y = Math.floor((ty - radiusTiles) / SITE_CELL), c1y = Math.floor((ty + radiusTiles) / SITE_CELL);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) { const s = this.forCell(cx, cy); if (s) out.push(s); }
    return out;
  }

  private make(cx: number, cy: number): Site | null {
    const seed = this.seed;
    if (hash(cx, cy, seed + 6000) > 0.42) return null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const tx = cx * SITE_CELL + 5 + Math.floor(hash(cx, cy, seed + 6010 + attempt) * (SITE_CELL - 10));
      const ty = cy * SITE_CELL + 5 + Math.floor(hash(cx, cy, seed + 6020 + attempt) * (SITE_CELL - 10));
      if (Math.hypot(tx, ty) < 22) continue;
      let ok = true;
      for (let j = -5; j <= 5 && ok; j++) for (let i = -5; i <= 5; i++) {
        if (i * i + j * j > 28) continue;
        const b = this.source.biomeAt(tx + i, ty + j);
        if (isSolidBiome(b) || isWaterBiome(b) || b === BIOME.PEAK) { ok = false; break; }
      }
      if (!ok) continue;
      // keep clear of places of interest
      if (this.source.poisNear(tx, ty, 10).length) continue;
      const group = groupOf(this.source.biomeAt(tx, ty));
      const level = zoneLevel(seed, tx, ty, GROUP_LEVEL_OFFSET[group] ?? 0);
      const kind: SiteKind = hash(cx, cy, seed + 6030) < 0.6 ? 'claim' : 'trigger';
      const x = (tx + 0.5) * T, y = (ty + 0.5) * T;
      return {
        id: `s${cx},${cy}`, kind, tx, ty, x, y, level, group,
        radius: kind === 'claim' ? CLAIM_RADIUS : TRIGGER_RADIUS,
        waves: kind === 'claim' ? 3 : 4 + Math.min(6, Math.floor(level / 6))
      };
    }
    return null;
  }
}

// ----------------------------------------------------------------- hold-out state machine
export interface ClaimState { progress: number; wavesSent: number; done: boolean }
export const newClaim = (): ClaimState => ({ progress: 0, wavesSent: 0, done: false });

export interface ClaimStep { spawnWave: boolean; completed: boolean }

/**
 * Advances a hold-out. Progress (0..1) fills while the hero is inside and drains slowly outside.
 * One wave is requested each time progress passes a threshold; the final one completes the claim.
 */
export function stepClaim(st: ClaimState, inside: boolean, dtSeconds: number, waves: number): ClaimStep {
  const out: ClaimStep = { spawnWave: false, completed: false };
  if (st.done) return out;
  st.progress += inside ? dtSeconds / CLAIM_SECONDS : -dtSeconds / (CLAIM_SECONDS * 2.5);
  if (st.progress < 0) st.progress = 0;
  const due = Math.min(waves, Math.floor(st.progress * (waves + 1)));
  if (due > st.wavesSent) { st.wavesSent++; out.spawnWave = true; }
  if (st.progress >= 1) { st.progress = 1; st.done = true; out.completed = true; }
  return out;
}

// ------------------------------------------------------------------ ambush
/** How far from the plate an ambush appears: out of reach at first, so it threatens instead of surrounding. */
export const AMBUSH_RING = { min: 380, max: 480 };
export const AMBUSH_ARC = (65 * Math.PI) / 180;        // each group fans out over this much of the ring
export const AMBUSH_GAP = (120 * Math.PI) / 180;       // one side always stays open: a way out
export const AMBUSH_STAGGER = 30;                      // frames between groups closing in

/** Monsters in an ambush: half again the plate's own number (6 to 15). */
export const ambushCount = (site: Site): number => Math.max(6, Math.min(15, Math.round(site.waves * 1.5)));

export interface AmbushSpawn { x: number; y: number; group: number; delay: number }

/**
 * Where an ambush's monsters appear and when each group closes in: two or three arcs on a ring around the plate,
 * all inside a 240-degree sector, so a 120-degree gap is always left open.
 */
export function ambushPlan(site: Site, count: number, rand: () => number): AmbushSpawn[] {
  const groups = count >= 9 ? 3 : 2;
  const bearing = rand() * Math.PI * 2;                // the centre of the closed side
  const span = Math.PI * 2 - AMBUSH_GAP;               // 240 degrees
  const step = (span - AMBUSH_ARC) / (groups - 1);
  const out: AmbushSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const g = i % groups;
    const inGroup = Math.floor(i / groups), perGroup = Math.ceil((count - g) / groups);
    const centre = bearing - span / 2 + AMBUSH_ARC / 2 + g * step;
    const a = centre + ((inGroup + 0.5) / perGroup - 0.5) * AMBUSH_ARC + (rand() - 0.5) * 0.08;
    const r = AMBUSH_RING.min + rand() * (AMBUSH_RING.max - AMBUSH_RING.min);
    out.push({ x: site.x + Math.cos(a) * r, y: site.y + Math.sin(a) * r, group: g, delay: g * AMBUSH_STAGGER });
  }
  return out;
}

export const insideSite = (s: Site, x: number, y: number) => (x - s.x) ** 2 + (y - s.y) ** 2 <= s.radius * s.radius;
