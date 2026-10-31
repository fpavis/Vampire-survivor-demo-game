// Player settings (game, video, HUD and controls), as data with defaults and validation. Accessibility options
// (text size, colours, reduced motion, tips) live in app/access.ts; audio volumes in app/audio.ts.

export type Quality = 'low' | 'medium' | 'high';
export type DamageNumbers = 'all' | 'crits' | 'off';
export type HealthBars = 'hurt' | 'always' | 'off';
export type MinimapSize = 'small' | 'medium' | 'large';
export type ArtStyle = 'pixel' | 'smooth';
export type PostFx = 'none' | 'pixelate' | 'crt' | 'grain';
export type ColorGrade = 'none' | 'warm' | 'cool' | 'noir' | 'sepia';

export interface Settings {
  // game
  autoPick: boolean;
  confirmSalvage: boolean;
  pauseOnBlur: boolean;
  // video
  quality: Quality;
  renderScale: number;          // 0.5 .. 1 of the display resolution
  dynRes: boolean;              // lower the resolution a little while frames run long (core/settings/autotune)
  fpsCap: 0 | 30 | 60;          // 0: as fast as the display allows
  cameraZoom: number;           // ZOOM_MIN .. ZOOM_MAX in steps of ZOOM_STEP: the mouse wheel, the keys and the pad change it
  shake: number;                // 0 .. 1
  flash: number;                // 0 .. 1
  damageNumbers: DamageNumbers;
  artStyle: ArtStyle;           // pixel: every asset drawn at the terrain's grain; smooth: as drawn
  pixelSize: 2 | 3 | 4;         // world pixels per art pixel in the pixel style
  postFx: PostFx;               // a screen filter over the scene (never over the HUD)
  colorGrade: ColorGrade;
  // HUD
  hudScale: number;             // 0.8 .. 1.3
  minimap: MinimapSize;
  minimapOpacity: number;       // 0.4 .. 1
  healthBars: HealthBars;
  tracker: boolean;
  storyScenes: 'full' | 'cards';  // a lord's words and the Elder's interludes as scenes, or as a card over play
  // controls
  clickToMove: boolean;
  aimAtCursor: boolean;
  mouseInteract: boolean;       // experimental: clicking something within reach uses it, like pressing E
}

/** The camera: how much of the world a screen shows. 0.8 is as far as the old "Far", and no farther so the chunk budget holds. */
export const ZOOM_MIN = 0.8, ZOOM_MAX = 1.6, ZOOM_STEP = 0.1;
const LEGACY_ZOOMS = [0.8, 1, 1.2];            // the old setting was an index: Far, Normal, Close
export const roundZoom = (z: number): number => Number((Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) / ZOOM_STEP) * ZOOM_STEP).toFixed(2));
/** The zoom `notches` steps in (positive) or out (negative) from `z`. */
export const stepZoom = (z: number, notches: number): number => roundZoom(z + notches * ZOOM_STEP);

export const DEFAULT_SETTINGS: Settings = {
  autoPick: false, confirmSalvage: false, pauseOnBlur: true,
  quality: 'high', renderScale: 1, dynRes: true, fpsCap: 0, cameraZoom: 1, shake: 1, flash: 1, damageNumbers: 'all',
  artStyle: 'pixel', pixelSize: 2, postFx: 'none', colorGrade: 'none',
  hudScale: 1, minimap: 'medium', minimapOpacity: 1, healthBars: 'hurt', tracker: true, storyScenes: 'full',
  clickToMove: false, aimAtCursor: false, mouseInteract: false
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const num = (v: unknown, d: number, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : d);
const pick = <T extends string | number>(v: unknown, options: readonly T[], d: T): T => (options.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** A zoom saved by an older game: an index (0, 1 or 2) into Far, Normal and Close. */
const legacyZoom = (v: unknown, d: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LEGACY_ZOOMS.length ? LEGACY_ZOOMS[v] : d);

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
    dynRes: bool(r.dynRes, d.dynRes),
    fpsCap: pick(r.fpsCap, [0, 30, 60] as const, d.fpsCap),
    cameraZoom: roundZoom(typeof r.cameraZoom === 'number' ? num(r.cameraZoom, d.cameraZoom, ZOOM_MIN, ZOOM_MAX) : legacyZoom(r.zoom, d.cameraZoom)),
    shake: num(r.shake, d.shake, 0, 1),
    flash: num(r.flash, d.flash, 0, 1),
    damageNumbers: pick(r.damageNumbers, ['all', 'crits', 'off'] as const, d.damageNumbers),
    artStyle: pick(r.artStyle, ['pixel', 'smooth'] as const, d.artStyle),
    pixelSize: pick(r.pixelSize, [2, 3, 4] as const, d.pixelSize),
    postFx: pick(r.postFx, ['none', 'pixelate', 'crt', 'grain'] as const, d.postFx),
    colorGrade: pick(r.colorGrade, ['none', 'warm', 'cool', 'noir', 'sepia'] as const, d.colorGrade),
    hudScale: num(r.hudScale, d.hudScale, 0.8, 1.3),
    minimap: pick(r.minimap, ['small', 'medium', 'large'] as const, d.minimap),
    minimapOpacity: num(r.minimapOpacity, d.minimapOpacity, 0.4, 1),
    healthBars: pick(r.healthBars, ['hurt', 'always', 'off'] as const, d.healthBars),
    tracker: bool(r.tracker, d.tracker),
    storyScenes: pick(r.storyScenes, ['full', 'cards'] as const, d.storyScenes),
    clickToMove: bool(r.clickToMove, d.clickToMove),
    aimAtCursor: bool(r.aimAtCursor, d.aimAtCursor),
    mouseInteract: bool(r.mouseInteract, d.mouseInteract)
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

