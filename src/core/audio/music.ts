// Procedural music as data. A track is a mode, a chord loop, a tempo and a few voices; `barNotes` turns one bar
// into note events. The melody is generated from a seed, so a track always plays the same tune, and layers are
// added as combat heats up. Pure and deterministic: the runtime (app/audio.ts) schedules and synthesizes.

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type VoiceKind = 'pad' | 'bass' | 'lead' | 'arp' | 'bell' | 'kick' | 'snare' | 'hat';

export interface NoteEvent { beat: number; len: number; midi: number; voice: VoiceKind; vol: number }

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11]
};

export interface TrackDef {
  id: string;
  tempo: number;               // beats per minute, 4 beats per bar
  root: number;                // MIDI tonic of the bass (48 = C3)
  scale: keyof typeof SCALES;
  darkScale?: keyof typeof SCALES;   // used in the harsh far regions
  chords: number[];            // scale degree of each bar's chord, looped
  lead: { wave: Wave; density: number; octave: number; vol: number };
  pad: { wave: Wave; vol: number };
  bass: { wave: Wave; style: 'long' | 'pulse' | 'walk'; vol: number };
  arp?: { wave: Wave; pattern: number[]; vol: number };     // chord-tone indices per eighth note
  drums?: 'always' | 'combat';  // default 'combat'
  bells?: boolean;              // sparse high notes (cave drips, town chimes)
  seed: number;
}

const T = (d: Partial<TrackDef> & Pick<TrackDef, 'id' | 'tempo' | 'root' | 'scale' | 'chords' | 'seed'>): TrackDef => ({
  lead: { wave: 'triangle', density: 0.55, octave: 2, vol: 0.07 },
  pad: { wave: 'triangle', vol: 0.035 },
  bass: { wave: 'triangle', style: 'pulse', vol: 0.09 },
  ...d
});

export const TRACKS: Record<string, TrackDef> = {
  title: T({ id: 'title', tempo: 72, root: 50, scale: 'dorian', chords: [0, 5, 3, 4, 0, 5, 6, 4], seed: 11,
    lead: { wave: 'triangle', density: 0.45, octave: 2, vol: 0.07 }, pad: { wave: 'sawtooth', vol: 0.025 }, bass: { wave: 'triangle', style: 'long', vol: 0.08 },
    arp: { wave: 'sine', pattern: [0, 1, 2, 3, 2, 1, 0, 2], vol: 0.03 } }),
  field: T({ id: 'field', tempo: 96, root: 48, scale: 'major', darkScale: 'aeolian', chords: [0, 4, 5, 3, 0, 4, 3, 4], seed: 21,
    lead: { wave: 'square', density: 0.6, octave: 2, vol: 0.04 }, arp: { wave: 'triangle', pattern: [0, 2, 1, 2, 0, 2, 1, 2], vol: 0.035 } }),
  forest: T({ id: 'forest', tempo: 84, root: 45, scale: 'dorian', darkScale: 'phrygian', chords: [0, 6, 3, 4, 0, 6, 2, 4], seed: 31,
    lead: { wave: 'sine', density: 0.5, octave: 2, vol: 0.08 }, pad: { wave: 'triangle', vol: 0.04 }, arp: { wave: 'sine', pattern: [0, 1, 2, 1, 3, 1, 2, 1], vol: 0.035 } }),
  desert: T({ id: 'desert', tempo: 90, root: 52, scale: 'phrygianDominant', darkScale: 'phrygian', chords: [0, 1, 0, 6, 0, 1, 5, 1], seed: 41,
    lead: { wave: 'sawtooth', density: 0.55, octave: 1, vol: 0.035 }, bass: { wave: 'triangle', style: 'walk', vol: 0.09 } }),
  shore: T({ id: 'shore', tempo: 100, root: 53, scale: 'lydian', darkScale: 'dorian', chords: [0, 1, 4, 0, 5, 1, 4, 4], seed: 51,
    lead: { wave: 'triangle', density: 0.5, octave: 2, vol: 0.07 }, arp: { wave: 'sine', pattern: [0, 2, 3, 2, 1, 2, 3, 2], vol: 0.03 } }),
  mountain: T({ id: 'mountain', tempo: 76, root: 50, scale: 'aeolian', darkScale: 'phrygian', chords: [0, 5, 2, 6, 0, 3, 4, 4], seed: 61,
    lead: { wave: 'triangle', density: 0.42, octave: 2, vol: 0.07 }, pad: { wave: 'sawtooth', vol: 0.028 }, bass: { wave: 'triangle', style: 'long', vol: 0.1 } }),
  town: T({ id: 'town', tempo: 108, root: 55, scale: 'mixolydian', chords: [0, 3, 6, 0, 3, 4, 6, 4], seed: 71,
    lead: { wave: 'square', density: 0.7, octave: 1, vol: 0.04 }, bass: { wave: 'triangle', style: 'walk', vol: 0.09 },
    arp: { wave: 'triangle', pattern: [0, 2, 1, 2, 0, 2, 1, 2], vol: 0.03 }, bells: true }),
  cave: T({ id: 'cave', tempo: 66, root: 47, scale: 'phrygian', chords: [0, 1, 0, 6], seed: 81,
    lead: { wave: 'sine', density: 0.25, octave: 2, vol: 0.06 }, pad: { wave: 'sine', vol: 0.05 }, bass: { wave: 'sine', style: 'long', vol: 0.11 }, bells: true }),
  dungeon: T({ id: 'dungeon', tempo: 80, root: 48, scale: 'harmonicMinor', chords: [0, 5, 3, 4, 0, 5, 1, 4], seed: 91,
    lead: { wave: 'square', density: 0.4, octave: 1, vol: 0.035 }, pad: { wave: 'sawtooth', vol: 0.03 }, bass: { wave: 'square', style: 'pulse', vol: 0.06 } }),
  boss: T({ id: 'boss', tempo: 140, root: 52, scale: 'harmonicMinor', chords: [0, 0, 5, 4, 0, 0, 1, 4], seed: 101, drums: 'always',
    lead: { wave: 'sawtooth', density: 0.75, octave: 1, vol: 0.04 }, bass: { wave: 'square', style: 'pulse', vol: 0.07 },
    arp: { wave: 'square', pattern: [0, 1, 2, 1, 0, 1, 2, 3], vol: 0.025 } })
};

/** A small seeded generator (mulberry32), so a track's tune never changes. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const scaleOf = (t: TrackDef, dark = false) => SCALES[(dark && t.darkScale) || t.scale];

/** MIDI note of scale `degree` (any integer, wraps into octaves) above the track root, plus `octave` octaves. */
export function degreeToMidi(t: TrackDef, degree: number, octave = 0, dark = false): number {
  const sc = scaleOf(t, dark);
  const n = sc.length;
  const o = Math.floor(degree / n);
  return t.root + sc[((degree % n) + n) % n] + 12 * (o + octave);
}

export const chordOf = (t: TrackDef, bar: number): number[] => {
  const d = t.chords[((bar % t.chords.length) + t.chords.length) % t.chords.length];
  return [d, d + 2, d + 4, d + 7];
};

export const secondsPerBar = (t: TrackDef, dark = false) => (60 / (t.tempo * (dark ? 0.93 : 1))) * 4;

// rhythm cells in eighth notes for the lead: 1 = a note starts, 0 = rest (notes hold until the next start)
const RHYTHMS = [
  [1, 0, 1, 0, 1, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 0, 1, 0, 0, 1, 0], [1, 0, 0, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 0, 0, 0], [0, 0, 1, 0, 1, 0, 1, 0], [1, 0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 0, 1, 1, 1, 0]
];

export interface BarOptions { intensity?: number; dark?: boolean }

/**
 * The notes of one bar. Layers by intensity: pad, bass and a sparse lead always; arpeggio from 0.3; drums and a
 * doubled bass from 0.6 (boss tracks always drum). The lead repeats in 4-bar phrases with a varied answer.
 */
export function barNotes(t: TrackDef, bar: number, opts: BarOptions = {}): NoteEvent[] {
  const intensity = Math.max(0, Math.min(1, opts.intensity ?? 0));
  const dark = !!opts.dark;
  const out: NoteEvent[] = [];
  const chord = chordOf(t, bar);
  const loopBar = ((bar % 8) + 8) % 8;
  const m = (deg: number, oct: number) => degreeToMidi(t, deg, oct, dark);

  // pad: the chord, held all bar
  for (const d of chord.slice(0, 3)) out.push({ beat: 0, len: 4, midi: m(d, 1), voice: 'pad', vol: t.pad.vol });

  // bass
  const root = chord[0];
  if (t.bass.style === 'long') out.push({ beat: 0, len: 4, midi: m(root, 0), voice: 'bass', vol: t.bass.vol });
  else if (t.bass.style === 'pulse') for (let b = 0; b < 4; b++) out.push({ beat: b, len: 0.9, midi: m(root, 0), voice: 'bass', vol: t.bass.vol * (b % 2 ? 0.75 : 1) });
  else [root, root + 2, root + 4, root + 2].forEach((d, b) => out.push({ beat: b, len: 0.95, midi: m(d, 0), voice: 'bass', vol: t.bass.vol }));
  if (intensity >= 0.6) for (let b = 0; b < 8; b++) out.push({ beat: b / 2, len: 0.4, midi: m(root, -1), voice: 'bass', vol: t.bass.vol * 0.6 });

  // lead: phrase rhythm from the bar's place in the 4-bar phrase, pitches walk around chord tones
  const phrase = loopBar % 4, answer = loopBar >= 4;
  const rr = rng(t.seed * 31 + phrase * 7 + (answer && phrase === 3 ? 101 : 0));
  const density = t.lead.density * (0.75 + intensity * 0.5);
  let rhythm = RHYTHMS[Math.floor(rr() * RHYTHMS.length)];
  if (density < 0.45) rhythm = rhythm.map((v, i) => (i % 2 ? 0 : v));
  const pr = rng(t.seed * 977 + loopBar * 13 + 5);
  let deg = chord[Math.floor(pr() * 3)];
  const starts = rhythm.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  starts.forEach((s, k) => {
    const next = starts[k + 1] ?? 8;
    const strong = s % 4 === 0;
    if (strong) deg = chord[Math.floor(pr() * 3)];
    else deg += pr() < 0.5 ? -1 : 1;
    if (pr() < density || strong) out.push({ beat: s / 2, len: Math.max(0.4, (next - s) / 2 - 0.05), midi: m(deg, t.lead.octave), voice: 'lead', vol: t.lead.vol });
  });

  // arpeggio
  if (t.arp && intensity >= 0.3) {
    t.arp.pattern.forEach((idx, i) => out.push({ beat: i / 2, len: 0.45, midi: m(chord[idx % chord.length], 2), voice: 'arp', vol: t.arp!.vol }));
  }

  // bells: a sparse high note now and then
  if (t.bells) {
    const br = rng(t.seed * 53 + loopBar);
    if (br() < 0.55) out.push({ beat: Math.floor(br() * 8) / 2, len: 1.5, midi: m(chord[Math.floor(br() * 3)], 3), voice: 'bell', vol: 0.03 });
  }

  // drums
  if (t.drums === 'always' || intensity >= 0.6) {
    const heavy = t.drums === 'always' || intensity >= 0.85;
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 4 || (heavy && i === 6)) out.push({ beat: i / 2, len: 0.3, midi: 36, voice: 'kick', vol: 0.16 });
      if (i === 2 || i === 6) out.push({ beat: i / 2, len: 0.2, midi: 38, voice: 'snare', vol: 0.09 });
      out.push({ beat: i / 2, len: 0.08, midi: 42, voice: 'hat', vol: i % 2 ? 0.025 : 0.035 });
    }
  }
  return out;
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Which track fits the moment. `place` is the interior kind, if inside; `group` the overworld biome group. */
export function pickTrack(s: { title?: boolean; boss?: boolean; place?: string | null; dungeon?: boolean; group?: string; sailing?: boolean }): string {
  if (s.title) return 'title';
  if (s.boss) return 'boss';
  if (s.place === 'city') return 'town';
  if (s.place) return s.dungeon ? 'dungeon' : 'cave';
  if (s.sailing) return 'shore';
  return TRACKS[s.group ?? ''] ? s.group! : 'field';
}
