import { describe, expect, it } from 'vitest';
import { BEDS, STEP_SOUND, ambientFor, footstepFor, type BedId } from '../src/core/audio/ambience';
import { SFX } from '../src/core/audio/sfx';
import { BIOME } from '../src/core/world/biomes';

describe('ambient beds', () => {
  it('follow the region, and places and the sea win over it', () => {
    expect(ambientFor({ group: 'forest' })).toBe('forest');
    expect(ambientFor({ group: 'shore' })).toBe('shore');
    expect(ambientFor({ group: 'mountain' })).toBe('mountain');
    expect(ambientFor({ group: 'desert' })).toBe('desert');
    expect(ambientFor({ group: 'field' })).toBe('field');
    expect(ambientFor({ group: null })).toBe('field');
    expect(ambientFor({ group: 'forest', place: 'city' })).toBe('town');
    expect(ambientFor({ group: 'forest', place: 'cave' })).toBe('cave');
    expect(ambientFor({ group: 'forest', place: 'ruins', dungeon: true })).toBe('dungeon');
    expect(ambientFor({ group: 'shore', sailing: true })).toBe('sea');
    expect(ambientFor({ group: 'shore', title: true })).toBe('silence');
  });
  it('are quiet sound beds: every band and call stays soft', () => {
    for (const [id, bed] of Object.entries(BEDS) as [BedId, (typeof BEDS)[BedId]][]) {
      for (const b of bed.bands) { expect(b.vol, id).toBeLessThanOrEqual(0.12); if (b.swell) expect(b.swell.depth).toBeLessThanOrEqual(1); }
      for (const e of bed.events) { expect(e.vol, id).toBeLessThanOrEqual(0.05); expect(e.every[1]).toBeGreaterThanOrEqual(e.every[0]); }
    }
    expect(BEDS.silence.bands.length + BEDS.silence.events.length).toBe(0);
  });
});

describe('footsteps', () => {
  it('sound like the ground underfoot', () => {
    expect(footstepFor(BIOME.GRASS)).toBe('grass');
    expect(footstepFor(BIOME.FOREST)).toBe('grass');
    expect(footstepFor(BIOME.DRY)).toBe('sand');
    expect(footstepFor(BIOME.SAND)).toBe('sand');
    expect(footstepFor(BIOME.SHALLOW)).toBe('water');
    expect(footstepFor(BIOME.CAVE_FLOOR)).toBe('stone');
    expect(footstepFor(BIOME.CITY_FLOOR)).toBe('stone');
    expect(footstepFor(BIOME.PLATEAU)).toBe('snow');
    expect(footstepFor(BIOME.BRIDGE)).toBe('wood');
  });
  it('let a surface win over the biome', () => {
    expect(footstepFor(BIOME.GRASS, 'mud')).toBe('mud');
    expect(footstepFor(BIOME.GRASS, 'ice')).toBe('snow');
    expect(footstepFor(BIOME.DRY, 'road')).toBe('stone');
    expect(footstepFor(BIOME.GRASS, 'spring')).toBe('water');
    expect(footstepFor(BIOME.GRASS, 'glyph')).toBe('grass');
  });
  it('have a sound for every kind of ground, and the stingers exist', () => {
    for (const name of Object.values(STEP_SOUND)) expect(SFX[name], name).toBeTruthy();
    for (const name of ['stingDiscover', 'stingBoss', 'stingVictory']) expect(SFX[name], name).toBeTruthy();
  });
});
