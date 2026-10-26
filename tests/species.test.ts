import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ENEMY_TYPES, perceptionOf, PERCEPTION_DEFAULT } from '../src/core/config';
import { ROSTERS } from '../src/core/world/biomes';
import { bestiaryEntry } from '../src/core/codex/codex';
import { DIFFICULTY, tierOf } from '../src/core/world/difficulty';

const NEW = ['THORNBACK', 'WIGHT', 'MANTIS', 'THORNWITCH', 'SANDWORM', 'DJINN', 'SIREN', 'LURKER', 'HARPY', 'YETI'];

describe('tiered species', () => {
  it('give every region a new monster for tier 2 and another for tier 3', () => {
    for (const [group, roster] of Object.entries(ROSTERS)) {
      const t2 = roster.filter((r) => tierOf(r.level) === 2), t3 = roster.filter((r) => tierOf(r.level) === 3);
      expect(t2.length, group).toBeGreaterThanOrEqual(1);
      expect(t3.length, group).toBeGreaterThanOrEqual(1);
      expect(t2[0].level).toBe(2 * DIFFICULTY.tierSize + 1);
      expect(t3[0].level).toBe(3 * DIFFICULTY.tierSize + 1);
    }
  });
  it('are real monsters: art, perception, a bestiary entry, and sturdier than the region\'s first kinds', () => {
    const art = readFileSync(new URL('../src/render/enemyArt.ts', import.meta.url), 'utf8');
    const exported = art.slice(art.indexOf('export const ENEMY_ART'));
    for (const key of NEW) {
      const t = ENEMY_TYPES[key];
      expect(t, key).toBeTruthy();
      expect(exported.includes(`${t.art},`) || exported.includes(`${t.art}:`) || exported.includes(` ${t.art}\n`), `${key} art`).toBe(true);
      expect(art.includes(`function ${t.art}(body`), `${key} builder`).toBe(true);
      expect(perceptionOf(key), key).not.toEqual(PERCEPTION_DEFAULT);
      const b = bestiaryEntry(key)!;
      expect(b.name).toBe(t.name);
      expect(b.behaviour.length).toBeGreaterThan(10);
      expect(t.health).toBeGreaterThanOrEqual(50);
    }
  });
  it('every monster in a roster exists', () => {
    for (const roster of Object.values(ROSTERS)) for (const r of roster) expect(ENEMY_TYPES[r.type], r.type).toBeTruthy();
  });
});
