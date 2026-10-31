import { describe, expect, it } from 'vitest';
import { SFX, sfxLength, spatial, voiceLayers } from '../src/core/audio/sfx';
import { SCALES, TRACKS, barNotes, degreeToMidi, pickTrack, scaleOf } from '../src/core/audio/music';

describe('sound effects', () => {
  it('every sound has playable layers', () => {
    for (const [name, def] of Object.entries(SFX)) {
      expect(def.layers.length, name).toBeGreaterThan(0);
      for (const l of def.layers) {
        expect(l.t, name).toBeGreaterThan(0);
        expect(l.f, name).toBeGreaterThan(0);
      }
      expect(sfxLength(def)).toBeLessThan(2);
    }
  });

  it('spreads pitch within the jitter and applies a pitch multiplier', () => {
    const def = SFX.hit;
    for (const r of [0, 0.5, 1]) {
      const k = voiceLayers(def, r)[0].f / def.layers[0].f;
      expect(Math.abs(k - 1)).toBeLessThanOrEqual((def.jitter ?? 0) + 1e-9);
    }
    expect(voiceLayers(SFX.gem, 0.5, 2)[0].f).toBeCloseTo(SFX.gem.layers[0].f * 2);
  });

  it('pans toward the source and goes silent far away', () => {
    expect(spatial(400, 0)!.pan).toBeGreaterThan(0);
    expect(spatial(-400, 0)!.pan).toBeLessThan(0);
    expect(spatial(0, 0)!.gain).toBe(1);
    expect(spatial(100, 0)!.gain).toBeGreaterThan(spatial(900, 0)!.gain);
    expect(spatial(5000, 0)).toBeNull();
  });
});

describe('procedural music', () => {
  const pitched = new Set(['pad', 'bass', 'lead', 'arp', 'bell']);

  it('stays in the track scale and inside the bar', () => {
    for (const t of Object.values(TRACKS)) {
      for (const dark of [false, true]) {
        const sc = scaleOf(t, dark);
        for (let bar = 0; bar < 16; bar++) {
          for (const n of barNotes(t, bar, { intensity: 1, dark })) {
            expect(n.beat).toBeGreaterThanOrEqual(0);
            expect(n.beat).toBeLessThan(4);
            expect(n.len).toBeGreaterThan(0);
            if (pitched.has(n.voice)) expect(sc).toContain((((n.midi - t.root) % 12) + 12) % 12);
          }
        }
      }
    }
  });

  it('plays the same tune every time', () => {
    const t = TRACKS.forest;
    expect(barNotes(t, 5, { intensity: 0.4 })).toEqual(barNotes(t, 5, { intensity: 0.4 }));
    expect(barNotes(t, 5)).toEqual(barNotes(t, 13));            // an 8-bar loop
  });

  it('adds layers as combat heats up', () => {
    const t = TRACKS.field;
    const calm = barNotes(t, 0, { intensity: 0 });
    const hot = barNotes(t, 0, { intensity: 1 });
    expect(calm.some((n) => n.voice === 'kick')).toBe(false);
    expect(hot.some((n) => n.voice === 'kick')).toBe(true);
    expect(hot.some((n) => n.voice === 'arp')).toBe(true);
    expect(barNotes(TRACKS.boss, 0, { intensity: 0 }).some((n) => n.voice === 'kick')).toBe(true);
  });

  it('maps scale degrees across octaves', () => {
    const t = TRACKS.field;
    expect(degreeToMidi(t, 0)).toBe(t.root);
    expect(degreeToMidi(t, 7)).toBe(t.root + 12);
    expect(degreeToMidi(t, -7)).toBe(t.root - 12);
    expect(SCALES.major).toHaveLength(7);
  });

  it('picks a track for each situation', () => {
    expect(pickTrack({ title: true })).toBe('title');
    expect(pickTrack({ boss: true, place: 'city' })).toBe('boss');
    expect(pickTrack({ place: 'city' })).toBe('town');
    expect(pickTrack({ place: 'cave', dungeon: true })).toBe('dungeon');
    expect(pickTrack({ place: 'ruins' })).toBe('cave');
    expect(pickTrack({ sailing: true, group: 'forest' })).toBe('shore');
    expect(pickTrack({ group: 'desert' })).toBe('desert');
    expect(pickTrack({ group: 'nowhere' })).toBe('field');
    for (const id of ['title', 'boss', 'town', 'dungeon', 'cave', 'field', 'forest', 'desert', 'shore', 'mountain']) expect(TRACKS[id]).toBeDefined();
  });
});
