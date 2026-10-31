// Ambient beds and footsteps as data: which bed of sound plays where, what it is made of, and which footstep the
// ground under the hero makes. The runtime (app/audio.ts) synthesizes them; nothing here touches Web Audio.
import { BIOME } from '../world/biomes';

export type BedId = 'field' | 'forest' | 'desert' | 'shore' | 'mountain' | 'cave' | 'town' | 'dungeon' | 'sea' | 'corrupt' | 'silence';

/** A looping band of filtered noise; `swell` slowly modulates its loudness (wind gusts, waves). */
export interface NoiseBand { f: number; q: number; type: 'bandpass' | 'lowpass' | 'highpass'; vol: number; swell?: { rate: number; depth: number } }
/** A sound that comes now and then: a bird call, an owl, a drip, a gull. Frequencies in Hz, times in seconds. */
export interface BedEvent { wave: 'sine' | 'triangle' | 'square'; f: number; f2: number; t: number; vol: number; notes: number; gap: number; every: [number, number] }
export interface BedDef { bands: NoiseBand[]; events: BedEvent[] }

const bird = (f: number, every: [number, number], vol = 0.035): BedEvent => ({ wave: 'sine', f, f2: f * 1.5, t: 0.07, vol, notes: 3, gap: 0.09, every });

export const BEDS: Record<BedId, BedDef> = {
  field: { bands: [{ f: 900, q: 0.4, type: 'lowpass', vol: 0.05, swell: { rate: 0.12, depth: 0.5 } }], events: [bird(2600, [2.5, 6]), bird(3400, [4, 9], 0.025)] },
  forest: {
    bands: [{ f: 1600, q: 0.6, type: 'bandpass', vol: 0.045, swell: { rate: 0.09, depth: 0.6 } }],
    events: [bird(2200, [3, 7]), { wave: 'sine', f: 420, f2: 380, t: 0.28, vol: 0.04, notes: 2, gap: 0.36, every: [9, 18] }]       // an owl
  },
  desert: { bands: [{ f: 600, q: 0.7, type: 'bandpass', vol: 0.07, swell: { rate: 0.07, depth: 0.85 } }, { f: 3200, q: 0.5, type: 'highpass', vol: 0.012 }], events: [] },
  shore: {
    bands: [{ f: 500, q: 0.5, type: 'lowpass', vol: 0.09, swell: { rate: 0.11, depth: 0.9 } }],
    events: [{ wave: 'triangle', f: 1500, f2: 1100, t: 0.16, vol: 0.03, notes: 2, gap: 0.18, every: [6, 13] }]                     // gulls
  },
  mountain: { bands: [{ f: 450, q: 0.9, type: 'bandpass', vol: 0.08, swell: { rate: 0.05, depth: 0.8 } }, { f: 1400, q: 1.6, type: 'bandpass', vol: 0.015, swell: { rate: 0.13, depth: 0.7 } }], events: [] },
  cave: {
    bands: [{ f: 160, q: 0.6, type: 'lowpass', vol: 0.05 }],
    events: [{ wave: 'sine', f: 1800, f2: 900, t: 0.05, vol: 0.04, notes: 1, gap: 0, every: [1.5, 4.5] }]                           // drips
  },
  dungeon: {
    bands: [{ f: 110, q: 0.6, type: 'lowpass', vol: 0.06, swell: { rate: 0.04, depth: 0.4 } }],
    events: [{ wave: 'sine', f: 1300, f2: 700, t: 0.06, vol: 0.03, notes: 1, gap: 0, every: [3, 7] }]
  },
  town: { bands: [{ f: 700, q: 0.5, type: 'bandpass', vol: 0.035, swell: { rate: 0.2, depth: 0.4 } }], events: [bird(3000, [5, 11], 0.02)] },
  sea: { bands: [{ f: 380, q: 0.5, type: 'lowpass', vol: 0.1, swell: { rate: 0.08, depth: 0.9 } }, { f: 2400, q: 0.4, type: 'highpass', vol: 0.012 }], events: [] },
  // the blight: a low, uneasy drone, a thin whine above it, and now and then something groaning far off
  corrupt: {
    bands: [{ f: 85, q: 0.8, type: 'lowpass', vol: 0.075, swell: { rate: 0.05, depth: 0.7 } }, { f: 1900, q: 3, type: 'bandpass', vol: 0.006, swell: { rate: 0.17, depth: 0.9 } }],
    events: [{ wave: 'triangle', f: 150, f2: 105, t: 1.1, vol: 0.03, notes: 1, gap: 0, every: [7, 15] }]
  },
  silence: { bands: [], events: [] }
};

/** The bed for where the hero is: a place (town, cave, dungeon) wins over the region; sailing is the open sea. */
export function ambientFor(s: { group?: string | null; place?: string | null; dungeon?: boolean; sailing?: boolean; title?: boolean; corrupt?: boolean }): BedId {
  if (s.title) return 'silence';
  if (s.sailing) return 'sea';
  if (s.place) return s.dungeon ? 'dungeon' : s.place === 'city' ? 'town' : 'cave';
  if (s.corrupt) return 'corrupt';
  switch (s.group) {
    case 'forest': case 'desert': case 'shore': case 'mountain': return s.group;
    default: return 'field';
  }
}

export type Step = 'grass' | 'sand' | 'stone' | 'snow' | 'water' | 'wood' | 'mud';

/** The footstep the ground makes: a surface (mud, ice, a road...) wins over the biome under it. */
export function footstepFor(biome: number, surface?: string | null): Step {
  switch (surface) {
    case 'mud': case 'swamp': case 'quicksand': return 'mud';
    case 'ice': return 'snow';
    case 'tidal': case 'spring': return 'water';
    case 'road': return 'stone';
  }
  switch (biome) {
    case BIOME.SAND: case BIOME.DRY: return 'sand';
    case BIOME.SHALLOW: case BIOME.DEEP: return 'water';
    case BIOME.HILL: case BIOME.MOUNTAIN: case BIOME.CAVE_FLOOR: case BIOME.RUIN_FLOOR: case BIOME.CITY_STONE: case BIOME.CITY_FLOOR: return 'stone';
    case BIOME.PEAK: case BIOME.PLATEAU: return 'snow';
    case BIOME.BRIDGE: return 'wood';
    default: return 'grass';
  }
}

/** The sound played for each kind of footstep (see core/audio/sfx.ts). */
export const STEP_SOUND: Record<Step, string> = {
  grass: 'stepGrass', sand: 'stepSand', stone: 'stepStone', snow: 'stepSnow', water: 'stepWater', wood: 'stepWood', mud: 'stepMud'
};

/** World units walked between two footsteps. */
export const STRIDE = 34;
