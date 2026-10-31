// What standing on each surface looks like: a tint over the scene and the hero, desaturation, an edge glow and a
// heat shimmer, so a terrain modifier is felt the moment the party steps onto it. Pure; the runtime eases between
// these and scales them by the player's flash setting (and drops the shimmer under reduced motion).
import type { SurfaceId } from './surfaces';

export interface SurfaceLook {
  tint: number;          // colour laid over the scene
  tintAlpha: number;     // how strongly (0..1)
  desat: number;         // 0 keeps the colours, 1 is grey
  edge: number | null;   // colour of a glow creeping in from the screen edges (frost, heat), or none
  edgeAlpha: number;
  shimmer: number;       // heat haze: 0 none, 1 strong
  hero: number | null;   // tint on the hero, or none
  note: string;          // what the surface chip says it does to you
}

export const NO_LOOK: SurfaceLook = { tint: 0xffffff, tintAlpha: 0, desat: 0, edge: null, edgeAlpha: 0, shimmer: 0, hero: null, note: '' };

export const SURFACE_LOOK: Partial<Record<SurfaceId, SurfaceLook>> = {
  lava: { tint: 0xff5a1f, tintAlpha: 0.16, desat: 0, edge: 0xff7a2a, edgeAlpha: 0.5, shimmer: 1, hero: 0xffb48a, note: 'Burning' },
  ice: { tint: 0x8fd0ff, tintAlpha: 0.12, desat: 0.1, edge: 0xdff4ff, edgeAlpha: 0.55, shimmer: 0, hero: 0xd8efff, note: 'Slippery: everyone moves faster' },
  quicksand: { tint: 0x9a9080, tintAlpha: 0.1, desat: 0.6, edge: null, edgeAlpha: 0, shimmer: 0, hero: 0xd8cdb4, note: 'Sinking: slowed' },
  swamp: { tint: 0x7a9a2a, tintAlpha: 0.1, desat: 0.15, edge: 0x9ad04a, edgeAlpha: 0.3, shimmer: 0, hero: 0xc8e0a0, note: 'Poisoned and slowed' },
  mud: { tint: 0x7a5a3a, tintAlpha: 0.06, desat: 0.1, edge: null, edgeAlpha: 0, shimmer: 0, hero: null, note: 'Slowed' },
  tidal: { tint: 0x6ad0e8, tintAlpha: 0.06, desat: 0, edge: null, edgeAlpha: 0, shimmer: 0, hero: null, note: 'Mana flows faster' },
  spring: { tint: 0x6ad8b0, tintAlpha: 0.06, desat: 0, edge: 0x9bffd0, edgeAlpha: 0.25, shimmer: 0, hero: null, note: 'Healing' },
  manawell: { tint: 0x5a7ae8, tintAlpha: 0.07, desat: 0, edge: 0x8aa8ff, edgeAlpha: 0.25, shimmer: 0, hero: null, note: 'Mana returns much faster' },
  glyph: { tint: 0xb06af0, tintAlpha: 0.07, desat: 0, edge: 0xd8a0ff, edgeAlpha: 0.25, shimmer: 0, hero: null, note: 'Spells recharge faster' }
  // roads are only faster: no effect on the screen
};

/** The look to show for a surface, scaled by the effect strength (the flash setting) and reduced motion. */
export function surfaceLook(id: SurfaceId | null | undefined, strength: number, reducedMotion: boolean): SurfaceLook {
  const base = (id && SURFACE_LOOK[id]) || NO_LOOK;
  const k = Math.max(0, Math.min(1, strength));
  // even at the weakest setting a modifier stays visible (40%): it tells the player something about the ground
  const s = base === NO_LOOK ? 0 : 0.4 + 0.6 * k;
  return {
    ...base,
    tintAlpha: base.tintAlpha * s,
    desat: base.desat * s,
    edgeAlpha: base.edgeAlpha * s,
    shimmer: reducedMotion ? 0 : base.shimmer * k
  };
}

/** Ease one look toward another (per frame, `t` 0..1): colours blend, strengths move together. */
export function blendLook(a: SurfaceLook, b: SurfaceLook, t: number): SurfaceLook {
  const mix = (x: number, y: number) => x + (y - x) * t;
  const mixC = (x: number, y: number) => {
    const r = mix((x >> 16) & 255, (y >> 16) & 255), g = mix((x >> 8) & 255, (y >> 8) & 255), bl = mix(x & 255, y & 255);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
  };
  return {
    tint: b.tintAlpha > 0 ? (a.tintAlpha > 0 ? mixC(a.tint, b.tint) : b.tint) : a.tint,
    tintAlpha: mix(a.tintAlpha, b.tintAlpha),
    desat: mix(a.desat, b.desat),
    edge: b.edge ?? a.edge,
    edgeAlpha: mix(a.edgeAlpha, b.edge === a.edge || !a.edge || !b.edge ? b.edgeAlpha : 0),
    shimmer: mix(a.shimmer, b.shimmer),
    hero: b.hero,
    note: b.note
  };
}
