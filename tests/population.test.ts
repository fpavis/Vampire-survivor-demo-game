import { describe, expect, it } from 'vitest';
import { OverworldSource } from '../src/core/world/terrain';
import { POPULATION, Population, pickRosterEntry } from '../src/core/world/population';
import { BIOME, isSolidBiome, isWaterBiome, ROSTERS, WARLORDS } from '../src/core/world/biomes';
import { ENEMY_TYPES } from '../src/core/config';

function allCamps(seed: number, radiusChunks: number) {
  const src = new OverworldSource(seed);
  const pop = new Population(src);
  const camps = [];
  for (let cy = -radiusChunks; cy <= radiusChunks; cy++) for (let cx = -radiusChunks; cx <= radiusChunks; cx++) camps.push(...pop.campsForChunk(cx, cy));
  return { src, pop, camps };
}

describe('population', () => {
  it('is deterministic for a seed', () => {
    const a = allCamps(77, 14).camps, b = allCamps(77, 14).camps;
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(40);
  });

  it('never places camps near the start', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const c of allCamps(seed, 5).camps) expect(Math.hypot(c.tx, c.ty)).toBeGreaterThanOrEqual(POPULATION.noCampRadius);
    }
  });

  it('puts camps on walkable ground with valid monsters and sane leashes', () => {
    const { src, camps } = allCamps(31, 14);
    for (const c of camps) {
      const b = src.biomeAt(c.tx, c.ty);
      expect(isSolidBiome(b) || isWaterBiome(b), c.id).toBe(false);
      expect(c.members.length).toBeGreaterThan(0);
      for (const m of c.members) expect(ENEMY_TYPES[m.type], m.type).toBeDefined();
      expect(c.leash).toBeGreaterThan(300);
      expect(c.level).toBeGreaterThanOrEqual(1);
    }
  });

  it('camp level grows with distance and only uses species allowed at that level', () => {
    const { camps } = allCamps(5, 60);
    const near = camps.filter((c) => Math.hypot(c.tx, c.ty) < 150 && !c.lair);
    const far = camps.filter((c) => Math.hypot(c.tx, c.ty) > 700 && !c.lair);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    const avg = (l: typeof camps) => l.reduce((s, c) => s + c.level, 0) / l.length;
    expect(avg(far)).toBeGreaterThan(avg(near) + 4);
    for (const c of near) {
      for (const m of c.members) {
        const entry = (ROSTERS[c.group] ?? []).find((e) => e.type === m.type);
        if (entry) expect(entry.level).toBeLessThanOrEqual(c.level);
      }
    }
  });

  it('camps get denser in more dangerous zones', () => {
    const { camps } = allCamps(8, 70);
    const per = (lo: number, hi: number) => {
      let chunks = 0;
      for (let cy = -70; cy <= 70; cy++) for (let cx = -70; cx <= 70; cx++) { const d = Math.hypot(cx * 12, cy * 12); if (d >= lo && d < hi) chunks++; }
      return camps.filter((c) => { const d = Math.hypot(c.tx, c.ty); return d >= lo && d < hi && !c.lair; }).length / chunks;
    };
    expect(per(500, 840)).toBeGreaterThan(per(30, 200) * 1.05);
  });

  it('warlord lairs are far, rare, deterministic and use the regional warlord', () => {
    const { camps } = allCamps(19, 80);
    const lairs = camps.filter((c) => c.lair);
    expect(lairs.length).toBeGreaterThan(2);
    for (const l of lairs) {
      expect(Math.hypot(l.tx, l.ty)).toBeGreaterThanOrEqual(POPULATION.lairMinDistance);
      expect(l.members[0].type).toBe(WARLORDS[l.group]);
      expect(l.id.startsWith('lair:')).toBe(true);
    }
    expect(lairs.length).toBeLessThan(camps.length * 0.2);
  });

  it('roster picking respects the level gate', () => {
    for (let i = 0; i < 100; i++) {
      const e = pickRosterEntry('field', 1, i / 100);
      expect(e.level).toBeLessThanOrEqual(1);
      expect(e.type).toBe('SLIME');
    }
    const types = new Set<string>();
    for (let i = 0; i < 100; i++) types.add(pickRosterEntry('field', 9, i / 100).type);
    expect(types.size).toBeGreaterThan(1);
  });

  it('start area contains only level one content', () => {
    const src = new OverworldSource(11);
    for (let a = 0; a < 6.28; a += 0.3) expect(src.levelAt(Math.round(Math.cos(a) * 60), Math.round(Math.sin(a) * 60))).toBe(1);
    expect(BIOME.GRASS).toBeDefined();
  });
});
