// Sound effects as data: every sound is a few synthesized layers (an oscillator or filtered noise with a pitch
// sweep and a short envelope). No audio files. The runtime (app/audio.ts) plays them through the mixer.

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export type Bus = 'sfx' | 'ui';

export interface Layer {
  wave: Wave;
  f: number;            // start frequency (Hz); for noise, the filter centre
  f2?: number;          // end frequency of the sweep
  t: number;            // length in seconds
  at?: number;          // start offset in seconds
  vol?: number;         // peak gain (before bus and master)
  attack?: number;      // seconds to reach the peak (default 4 ms)
  q?: number;           // filter resonance for noise layers
  hp?: boolean;         // noise through a high-pass instead of a band-pass
}

export interface SfxDef {
  layers: Layer[];
  bus?: Bus;            // default 'sfx'
  jitter?: number;      // random pitch spread, as a fraction (0.06 = ±6 %)
  gap?: number;         // minimum seconds between two plays of this sound
  max?: number;         // most voices of this sound at once
}

const L = (wave: Wave, f: number, t: number, o: Partial<Layer> = {}): Layer => ({ wave, f, t, ...o });

export const SFX: Record<string, SfxDef> = {
  // ------------------------------------------------------------ combat
  hit: { layers: [L('noise', 2400, 0.05, { vol: 0.09, q: 1.2 }), L('triangle', 320, 0.05, { f2: 180, vol: 0.06 })], jitter: 0.12, gap: 0.025, max: 5 },
  crit: { layers: [L('noise', 3200, 0.06, { vol: 0.11, q: 1.5 }), L('square', 880, 0.08, { f2: 1320, vol: 0.05 }), L('sine', 1760, 0.1, { at: 0.03, vol: 0.04 })], jitter: 0.08, gap: 0.04, max: 3 },
  kill: { layers: [L('noise', 900, 0.12, { vol: 0.08, q: 0.8 }), L('triangle', 420, 0.12, { f2: 90, vol: 0.07 })], jitter: 0.15, gap: 0.03, max: 4 },
  killBig: { layers: [L('noise', 500, 0.3, { vol: 0.14, q: 0.6 }), L('sawtooth', 160, 0.3, { f2: 40, vol: 0.09 })], jitter: 0.1, gap: 0.08, max: 2 },
  hurt: { layers: [L('sawtooth', 160, 0.16, { f2: 70, vol: 0.12 }), L('noise', 700, 0.08, { vol: 0.08 })], jitter: 0.05, gap: 0.12, max: 1 },
  heartbeat: { layers: [L('sine', 70, 0.12, { f2: 45, vol: 0.2, attack: 0.01 }), L('sine', 64, 0.12, { f2: 42, at: 0.2, vol: 0.14, attack: 0.01 })], gap: 0.6, max: 1 },
  warn: { layers: [L('square', 220, 0.12, { f2: 330, vol: 0.035 }), L('square', 220, 0.12, { f2: 330, at: 0.14, vol: 0.035 })], gap: 0.25, max: 2 },
  elite: { layers: [L('sawtooth', 110, 0.4, { f2: 220, vol: 0.06, attack: 0.08 }), L('square', 440, 0.18, { at: 0.2, f2: 660, vol: 0.04 })], gap: 0.5, max: 1 },
  roar: { layers: [L('sawtooth', 90, 0.9, { f2: 55, vol: 0.14, attack: 0.12 }), L('noise', 300, 0.9, { vol: 0.12, q: 0.5, attack: 0.1 }), L('square', 45, 0.9, { vol: 0.06, attack: 0.2 })], gap: 2, max: 1 },
  bossDown: { layers: [L('noise', 400, 0.8, { vol: 0.16, q: 0.5 }), L('sawtooth', 220, 0.8, { f2: 30, vol: 0.12 }), L('triangle', 523, 0.25, { at: 0.5, vol: 0.1 }), L('triangle', 659, 0.25, { at: 0.7, vol: 0.1 }), L('triangle', 784, 0.5, { at: 0.9, vol: 0.1 })], gap: 2, max: 1 },
  // ------------------------------------------------------------ spells
  bolt: { layers: [L('sine', 900, 0.09, { f2: 1500, vol: 0.05 }), L('noise', 5000, 0.05, { vol: 0.025, hp: true })], jitter: 0.1, gap: 0.04, max: 3 },
  blade: { layers: [L('noise', 4200, 0.06, { vol: 0.04, q: 3 }), L('triangle', 1200, 0.05, { f2: 700, vol: 0.025 })], jitter: 0.15, gap: 0.06, max: 2 },
  zap: { layers: [L('sawtooth', 1800, 0.12, { f2: 300, vol: 0.06 }), L('noise', 6000, 0.14, { vol: 0.07, hp: true }), L('square', 2400, 0.05, { at: 0.04, f2: 900, vol: 0.03 })], jitter: 0.1, gap: 0.06, max: 2 },
  nova: { layers: [L('noise', 2800, 0.45, { f2: 600, vol: 0.09, q: 0.9, attack: 0.02 }), L('sine', 1320, 0.35, { f2: 440, vol: 0.05 }), L('triangle', 1980, 0.2, { vol: 0.03 })], gap: 0.15, max: 2 },
  meteorFall: { layers: [L('noise', 1800, 0.4, { f2: 500, vol: 0.05, q: 1.2, attack: 0.25 })], jitter: 0.1, gap: 0.08, max: 2 },
  boom: { layers: [L('noise', 260, 0.45, { vol: 0.17, q: 0.6 }), L('sine', 110, 0.4, { f2: 35, vol: 0.16 })], jitter: 0.12, gap: 0.06, max: 3 },
  trail: { layers: [L('noise', 900, 0.25, { vol: 0.03, q: 0.7, attack: 0.05 })], jitter: 0.2, gap: 0.2, max: 2 },
  wisp: { layers: [L('sine', 660, 0.18, { f2: 990, vol: 0.04 }), L('sine', 1320, 0.12, { at: 0.06, vol: 0.02 })], jitter: 0.15, gap: 0.08, max: 3 },
  glaive: { layers: [L('noise', 3000, 0.25, { f2: 1200, vol: 0.05, q: 4 }), L('triangle', 520, 0.2, { f2: 780, vol: 0.03 })], jitter: 0.1, gap: 0.1, max: 2 },
  cloud: { layers: [L('noise', 600, 0.6, { vol: 0.05, q: 0.6, attack: 0.15 }), L('sine', 180, 0.5, { f2: 140, vol: 0.04, attack: 0.1 })], gap: 0.3, max: 2 },
  slam: { layers: [L('noise', 180, 0.5, { vol: 0.2, q: 0.5 }), L('sine', 80, 0.45, { f2: 30, vol: 0.2 }), L('triangle', 240, 0.12, { vol: 0.06 })], gap: 0.2, max: 1 },
  heal: { layers: [L('sine', 523, 0.3, { vol: 0.06, attack: 0.05 }), L('sine', 659, 0.3, { at: 0.1, vol: 0.06, attack: 0.05 }), L('sine', 784, 0.45, { at: 0.2, vol: 0.06, attack: 0.05 })], gap: 0.3, max: 1 },
  dash: { layers: [L('sawtooth', 520, 0.14, { f2: 180, vol: 0.1 }), L('noise', 2000, 0.12, { vol: 0.05, q: 0.8 })], gap: 0.05, max: 1 },
  blink: { layers: [L('sine', 300, 0.12, { f2: 1100, vol: 0.12 }), L('triangle', 1100, 0.1, { at: 0.1, f2: 200, vol: 0.07 })], gap: 0.05, max: 1 },
  barrier: { layers: [L('triangle', 220, 0.3, { f2: 440, vol: 0.11 }), L('sine', 660, 0.4, { at: 0.08, vol: 0.05, attack: 0.08 })], gap: 0.1, max: 1 },
  // ------------------------------------------------------------ pickups and loot
  gem: { layers: [L('sine', 1046, 0.07, { f2: 1568, vol: 0.05 })], gap: 0.03, max: 3 },
  coin: { layers: [L('square', 1568, 0.05, { vol: 0.035 }), L('square', 2093, 0.09, { at: 0.05, vol: 0.035 })], jitter: 0.03, gap: 0.05, max: 2 },
  pickup: { layers: [L('sine', 880, 0.08, { f2: 1320, vol: 0.08 })], gap: 0.04, max: 2 },
  loot: { layers: [L('triangle', 660, 0.08, { vol: 0.12 }), L('triangle', 990, 0.08, { at: 0.07, vol: 0.12 }), L('sine', 1320, 0.2, { at: 0.14, vol: 0.1 })], gap: 0.1, max: 1 },
  levelup: { layers: [L('triangle', 523, 0.1, { vol: 0.12 }), L('triangle', 659, 0.1, { at: 0.09, vol: 0.12 }), L('triangle', 784, 0.18, { at: 0.18, vol: 0.12 }), L('sine', 1046, 0.3, { at: 0.27, vol: 0.06 })], gap: 0.2, max: 1 },
  chest: { layers: [L('noise', 500, 0.12, { vol: 0.06, q: 2 }), L('triangle', 392, 0.1, { at: 0.08, vol: 0.09 }), L('triangle', 523, 0.1, { at: 0.16, vol: 0.09 }), L('triangle', 784, 0.3, { at: 0.24, vol: 0.09 })], gap: 0.2, max: 1 },
  chop: { layers: [L('square', 180, 0.07, { f2: 90, vol: 0.1 }), L('triangle', 700, 0.04, { f2: 300, vol: 0.05 })], jitter: 0.08, gap: 0.05, max: 2 },
  mine: { layers: [L('square', 900, 0.05, { f2: 400, vol: 0.07 }), L('triangle', 300, 0.06, { f2: 150, vol: 0.08 }), L('noise', 3000, 0.04, { vol: 0.04, hp: true })], jitter: 0.08, gap: 0.05, max: 2 },
  buy: { layers: [L('triangle', 600, 0.05, { vol: 0.1 }), L('triangle', 900, 0.09, { at: 0.05, vol: 0.1 }), L('square', 1800, 0.05, { at: 0.12, vol: 0.03 })], gap: 0.05, max: 1 },
  equip: { layers: [L('square', 440, 0.07, { f2: 660, vol: 0.06 }), L('noise', 3500, 0.03, { vol: 0.03, hp: true })], gap: 0.04, max: 1 },
  // ------------------------------------------------------------ world
  door: { layers: [L('noise', 220, 0.35, { vol: 0.08, q: 1.5, attack: 0.05 }), L('triangle', 110, 0.3, { f2: 80, vol: 0.07 })], gap: 0.4, max: 1 },
  stairs: { layers: [L('noise', 400, 0.08, { vol: 0.07 }), L('noise', 340, 0.08, { at: 0.12, vol: 0.07 }), L('noise', 290, 0.08, { at: 0.24, vol: 0.07 }), L('sine', 196, 0.4, { at: 0.3, vol: 0.05 })], gap: 0.5, max: 1 },
  seal: { layers: [L('noise', 1500, 0.3, { vol: 0.08, q: 2 }), L('square', 330, 0.2, { f2: 660, vol: 0.05 }), L('triangle', 990, 0.4, { at: 0.18, vol: 0.06 })], gap: 0.5, max: 1 },
  place: { layers: [L('noise', 300, 0.12, { vol: 0.08 }), L('triangle', 330, 0.1, { at: 0.05, vol: 0.06 })], gap: 0.1, max: 1 },
  build: { layers: [L('square', 240, 0.05, { f2: 160, vol: 0.06 }), L('noise', 1200, 0.05, { vol: 0.05 }), L('square', 260, 0.05, { at: 0.14, f2: 170, vol: 0.06 })], gap: 0.1, max: 1 },
  fanfare: { layers: [L('square', 392, 0.12, { vol: 0.07 }), L('square', 523, 0.12, { at: 0.12, vol: 0.07 }), L('square', 659, 0.12, { at: 0.24, vol: 0.07 }), L('square', 784, 0.4, { at: 0.36, vol: 0.07 }), L('triangle', 392, 0.6, { at: 0.36, vol: 0.06 })], gap: 0.5, max: 1 },
  warp: { layers: [L('sine', 200, 0.5, { f2: 1600, vol: 0.08, attack: 0.1 }), L('noise', 4000, 0.4, { vol: 0.04, hp: true, attack: 0.1 })], gap: 0.5, max: 1 },
  sail: { layers: [L('noise', 500, 0.6, { vol: 0.06, q: 0.5, attack: 0.2 }), L('sine', 160, 0.5, { f2: 120, vol: 0.04, attack: 0.2 })], gap: 0.5, max: 1 },
  splash: { layers: [L('noise', 1200, 0.2, { f2: 400, vol: 0.06, q: 0.7 })], jitter: 0.2, gap: 0.3, max: 1 },
  surface: { layers: [L('noise', 700, 0.18, { vol: 0.04, q: 0.8 })], gap: 0.4, max: 1 },
  switch: { layers: [L('triangle', 400, 0.08, { f2: 800, vol: 0.1 }), L('sine', 800, 0.08, { at: 0.07, f2: 600, vol: 0.08 })], gap: 0.1, max: 1 },
  quest: { layers: [L('triangle', 587, 0.1, { vol: 0.08 }), L('triangle', 880, 0.2, { at: 0.09, vol: 0.08 })], gap: 0.2, max: 1 },
  questDone: { layers: [L('triangle', 523, 0.1, { vol: 0.09 }), L('triangle', 659, 0.1, { at: 0.1, vol: 0.09 }), L('triangle', 784, 0.1, { at: 0.2, vol: 0.09 }), L('triangle', 1046, 0.4, { at: 0.3, vol: 0.09 }), L('sine', 523, 0.6, { at: 0.3, vol: 0.05 })], gap: 0.5, max: 1 },
  // ------------------------------------------------------------ interface
  blip: { layers: [L('square', 740, 0.03, { vol: 0.025 })], bus: 'ui', jitter: 0.06, gap: 0.03, max: 1 },
  uiMove: { layers: [L('triangle', 880, 0.03, { vol: 0.035 })], bus: 'ui', gap: 0.02, max: 1 },
  uiOk: { layers: [L('triangle', 660, 0.04, { vol: 0.05 }), L('triangle', 990, 0.06, { at: 0.04, vol: 0.05 })], bus: 'ui', gap: 0.03, max: 1 },
  uiBack: { layers: [L('triangle', 660, 0.04, { vol: 0.045 }), L('triangle', 440, 0.06, { at: 0.04, vol: 0.045 })], bus: 'ui', gap: 0.03, max: 1 },
  deny: { layers: [L('square', 160, 0.12, { f2: 110, vol: 0.08 })], bus: 'ui', gap: 0.1, max: 1 }
};

/**
 * The layers to play for one instance of a sound: the pitch is spread by `jitter` using `r` (0..1) and shifted
 * by `pitch` (a multiplier, e.g. a rising gem streak).
 */
export function voiceLayers(def: SfxDef, r: number, pitch = 1): Layer[] {
  const k = pitch * (1 + (r * 2 - 1) * (def.jitter ?? 0));
  return def.layers.map((l) => ({ ...l, f: l.f * k, f2: l.f2 !== undefined ? l.f2 * k : undefined }));
}

/** Length of a sound in seconds, used to release its voice. */
export const sfxLength = (def: SfxDef): number => Math.max(...def.layers.map((l) => (l.at ?? 0) + l.t));

/** Stereo position and loudness for a sound at a distance from the listener (pixels). Null when inaudible. */
export function spatial(dx: number, dy: number, range = 1500): { pan: number; gain: number } | null {
  const d = Math.hypot(dx, dy);
  if (d > range) return null;
  return { pan: Math.max(-0.85, Math.min(0.85, dx / 650)), gain: 1 / (1 + d / 600) };
}
