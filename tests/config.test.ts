import { describe, expect, it } from 'vitest';
import { xpForLevel, ENEMY_TYPES } from '../src/core/config';
import { ROSTERS, WARLORDS, INTERIOR_ROSTERS } from '../src/core/world/biomes';

describe('config sanity', () => {
  it('xp requirement grows with level', () => {
    let prev = 0;
    for (let l = 1; l <= 120; l++) {
      const x = xpForLevel(l);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });

  it('every rostered enemy exists and has an AI config', () => {
    const names = new Set<string>();
    for (const roster of Object.values(ROSTERS)) for (const r of roster) names.add(r.type);
    for (const w of Object.values(WARLORDS)) names.add(w);
    for (const list of Object.values(INTERIOR_ROSTERS)) for (const n of list) names.add(n);
    for (const n of names) {
      expect(ENEMY_TYPES[n], n).toBeDefined();
      expect(ENEMY_TYPES[n].ai.kind, n).toBeTruthy();
    }
  });
});
