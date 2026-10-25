// Player settings (game, video, HUD and controls), as data with defaults and validation. Accessibility options
// (text size, colours, reduced motion, tips) live in app/access.ts; audio volumes in app/audio.ts.

export type Quality = 'low' | 'medium' | 'high';
export type DamageNumbers = 'all' | 'crits' | 'off';
export type HealthBars = 'hurt' | 'always' | 'off';
export type MinimapSize = 'small' | 'medium' | 'large';

export interface Settings {
  // game
  autoPick: boolean;
  confirmSalvage: boolean;
  pauseOnBlur: boolean;
  // video
  quality: Quality;
  renderScale: number;          // 0.5 .. 1 of the display resolution
  fpsCap: 0 | 30 | 60;          // 0: as fast as the display allows
  zoom: number;                 // camera zoom index into ZOOMS
  shake: number;                // 0 .. 1
  flash: number;                // 0 .. 1
  damageNumbers: DamageNumbers;
  // HUD
  hudScale: number;             // 0.8 .. 1.3
  minimap: MinimapSize;
  minimapOpacity: number;       // 0.4 .. 1
  healthBars: HealthBars;
  tracker: boolean;
  // controls
  clickToMove: boolean;
  aimAtCursor: boolean;
}

export const ZOOMS = [0.8, 1, 1.2];

export const DEFAULT_SETTINGS: Settings = {
  autoPick: false, confirmSalvage: false, pauseOnBlur: true,
  quality: 'high', renderScale: 1, fpsCap: 0, zoom: 1, shake: 1, flash: 1, damageNumbers: 'all',
  hudScale: 1, minimap: 'medium', minimapOpacity: 1, healthBars: 'hurt', tracker: true,
  clickToMove: false, aimAtCursor: false
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const num = (v: unknown, d: number, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : d);
const pick = <T extends string | number>(v: unknown, options: readonly T[], d: T): T => (options.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** Settings from stored data: unknown keys dropped, bad values replaced by defaults, numbers clamped. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    autoPick: bool(r.autoPick, d.autoPick),
    confirmSalvage: bool(r.confirmSalvage, d.confirmSalvage),
    pauseOnBlur: bool(r.pauseOnBlur, d.pauseOnBlur),
    quality: pick(r.quality, ['low', 'medium', 'high'] as const, d.quality),
    renderScale: num(r.renderScale, d.renderScale, 0.5, 1),
    fpsCap: pick(r.fpsCap, [0, 30, 60] as const, d.fpsCap),
    zoom: Math.round(num(r.zoom, d.zoom, 0, ZOOMS.length - 1)),
    shake: num(r.shake, d.shake, 0, 1),
    flash: num(r.flash, d.flash, 0, 1),
    damageNumbers: pick(r.damageNumbers, ['all', 'crits', 'off'] as const, d.damageNumbers),
    hudScale: num(r.hudScale, d.hudScale, 0.8, 1.3),
    minimap: pick(r.minimap, ['small', 'medium', 'large'] as const, d.minimap),
    minimapOpacity: num(r.minimapOpacity, d.minimapOpacity, 0.4, 1),
    healthBars: pick(r.healthBars, ['hurt', 'always', 'off'] as const, d.healthBars),
    tracker: bool(r.tracker, d.tracker),
    clickToMove: bool(r.clickToMove, d.clickToMove),
    aimAtCursor: bool(r.aimAtCursor, d.aimAtCursor)
  };
}

/** What a quality level turns on: particle budget, ambient effects, light map resolution. */
export interface QualityKnobs { particles: number; ambience: boolean; lightRes: number; glows: boolean }
export const QUALITY: Record<Quality, QualityKnobs> = {
  low: { particles: 150, ambience: false, lightRes: 0.25, glows: false },
  medium: { particles: 300, ambience: true, lightRes: 0.35, glows: true },
  high: { particles: 450, ambience: true, lightRes: 0.5, glows: true }
};

export const MINIMAP_SCALE: Record<MinimapSize, number> = { small: 0.75, medium: 1, large: 1.3 };

/** Whether a damage number is shown under the chosen setting. */
export const showDamageNumber = (mode: DamageNumbers, crit: boolean) => mode === 'all' || (mode === 'crits' && crit);

/** Whether a monster's health bar is shown: `hurt` hides full bars, `always` shows every bar, `off` none. */
export const showHealthBar = (mode: HealthBars, hurt: boolean) => mode === 'always' || (mode === 'hurt' && hurt);

/** A short first-run benchmark result (average frame time in ms) suggests a quality level. */
export function suggestQuality(frameMs: number): Quality {
  return frameMs > 24 ? 'low' : frameMs > 14 ? 'medium' : 'high';
}
