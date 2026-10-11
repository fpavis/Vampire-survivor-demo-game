import { describe, expect, it } from 'vitest';
import { BIOME } from '../src/core/world/biomes';
import {
  IMMUNITY, SURFACES, SURFACE_IDS, enemyEffect, isImmune, playerEffect, surfaceAt, surfaceByNum, SURFACE_NUM, surfaceScale
} from '../src/core/world/surfaces';
import { CLAIM_SECONDS, Sites, newClaim, stepClaim } from '../src/core/world/sites';
import { OverworldSource } from '../src/core/world/terrain';
import { NODES, isNode, nodeId, rollYield } from '../src/core/economy/gather';
import { RUMORS, RUNE_SLOTS, SPELL_SLOTS, innCost, runePrice, spellPrice, stockFor, rumorFor } from '../src/core/economy/shop';
import { ENEMY_TYPES } from '../src/core/config';
import { RUNES, TEMPLATES } from '../src/core/spells/spells';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('surfaces', () => {
  const src = new OverworldSource(1234);
  const scan = (r: number) => {
    const found: Record<string, number> = {};
    for (let ty = -r; ty <= r; ty += 1) for (let tx = -r; tx <= r; tx += 1) {
      const s = surfaceAt(src.seed, tx, ty, src.biomeAt(tx, ty), src.levelAt(tx, ty));
      if (s) found[s] = (found[s] ?? 0) + 1;
    }
    return found;
  };

  it('is deterministic', () => {
    for (let i = 0; i < 400; i++) {
      const tx = (i * 37) % 300 - 150, ty = (i * 53) % 300 - 150, b = src.biomeAt(tx, ty), l = src.levelAt(tx, ty);
      expect(surfaceAt(src.seed, tx, ty, b, l)).toBe(surfaceAt(src.seed, tx, ty, b, l));
    }
  });

  it('keeps the start area, water and walls free of surfaces', () => {
    for (let ty = -25; ty <= 25; ty++) for (let tx = -25; tx <= 25; tx++) if (Math.hypot(tx, ty) < 26) expect(surfaceAt(src.seed, tx, ty, BIOME.GRASS, 1)).toBeNull();
    expect(surfaceAt(src.seed, 200, 200, BIOME.DEEP, 5)).toBeNull();
    expect(surfaceAt(src.seed, 200, 200, BIOME.MOUNTAIN, 5)).toBeNull();
  });

  it('fits surfaces to biomes: swamp in forest, quicksand in desert, lava only in the foothills and deep', () => {
    const found: Record<string, Set<number>> = {};
    for (let ty = -260; ty <= 260; ty += 2) for (let tx = -260; tx <= 260; tx += 2) {
      const b = src.biomeAt(tx, ty), s = surfaceAt(src.seed, tx, ty, b, src.levelAt(tx, ty));
      if (s) (found[s] ||= new Set()).add(b);
    }
    for (const b of found.swamp ?? []) expect(b).toBe(BIOME.FOREST);
    for (const b of found.quicksand ?? []) expect(b).toBe(BIOME.DRY);
    for (const b of found.lava ?? []) expect(b).toBe(BIOME.HILL);
    expect(Object.keys(found).length).toBeGreaterThanOrEqual(4);
  });

  it('never places lava in low-level land and grows patches with level', () => {
    for (let i = 0; i < 4000; i++) expect(surfaceAt(src.seed, 100 + (i % 80), 100 + Math.floor(i / 80), BIOME.HILL, 3)).not.toBe('lava');
    const count = (level: number) => { let n = 0; for (let ty = 100; ty < 260; ty++) for (let tx = 100; tx < 260; tx++) if (surfaceAt(src.seed, tx, ty, BIOME.HILL, level) === 'lava') n++; return n; };
    expect(count(40)).toBeGreaterThan(count(8));
  });

  it('player effects: lava hurts, swamp slows, spring heals, well boosts mana, glyph speeds spells', () => {
    expect(playerEffect('lava', 1).dps).toBeGreaterThan(0);
    expect(playerEffect('swamp', 1).speed).toBeLessThan(1);
    expect(playerEffect('spring', 1).heal).toBeGreaterThan(0);
    expect(playerEffect('manawell', 1).manaRegen).toBeGreaterThan(1);
    expect(playerEffect('glyph', 1).haste).toBeGreaterThan(1);
    expect(playerEffect(null, 1)).toEqual({ dps: 0, speed: 1, heal: 0, manaRegen: 1, haste: 1 });
    expect(playerEffect('lava', 40).dps).toBeGreaterThan(playerEffect('lava', 1).dps);
    expect(surfaceScale(1)).toBe(1);
  });

  it('immunities: fire-proof golems ignore lava, fliers ignore everything, others burn', () => {
    expect(isImmune('GOLEM', false, 'lava')).toBe(true);
    expect(isImmune('SLIME', false, 'lava')).toBe(false);
    for (const s of SURFACE_IDS) expect(isImmune('BEE', true, s)).toBe(true);
    expect(enemyEffect('lava', 'GOLEM', false, 5).dps).toBe(0);
    expect(enemyEffect('lava', 'SLIME', false, 5).dps).toBeGreaterThan(0);
    expect(enemyEffect('swamp', 'SPIDER', false, 5).speed).toBe(1);
    expect(enemyEffect('swamp', 'WOLF', false, 5).speed).toBeLessThan(1);
  });

  it('immunity table only names real enemies and surfaces', () => {
    for (const [k, list] of Object.entries(IMMUNITY)) {
      expect(ENEMY_TYPES[k], k).toBeTruthy();
      for (const s of list) expect(SURFACES[s], s).toBeTruthy();
    }
  });

  it('numeric ids round trip', () => {
    for (const s of SURFACE_IDS) expect(surfaceByNum(SURFACE_NUM[s])?.id).toBe(s);
    expect(surfaceByNum(0)).toBeNull();
  });

  it('some surfaces exist in a normal world', () => {
    const f = scan(220);
    expect(Object.keys(f).length).toBeGreaterThanOrEqual(3);
  });
});

describe('claim zones and ambush plates', () => {
  const src = new OverworldSource(777);
  const sites = new Sites(src);

  it('are deterministic and sit on walkable land away from the start', () => {
    let claim = 0, trig = 0;
    for (let cy = -8; cy <= 8; cy++) for (let cx = -8; cx <= 8; cx++) {
      const a = sites.forCell(cx, cy), b = new Sites(src).forCell(cx, cy);
      expect(a).toEqual(b);
      if (!a) continue;
      a.kind === 'claim' ? claim++ : trig++;
      expect(Math.hypot(a.tx, a.ty)).toBeGreaterThanOrEqual(22);
      expect(a.level).toBeGreaterThanOrEqual(1);
    }
    expect(claim).toBeGreaterThan(5);
    expect(trig).toBeGreaterThan(3);
  });

  it('near() finds sites around a point', () => {
    const any = sites.near(0, 0, 200);
    expect(any.length).toBeGreaterThan(5);
  });

  it('hold-out fills while inside, drains outside, sends waves and completes once', () => {
    const st = newClaim();
    let waves = 0, done = 0;
    for (let t = 0; t < CLAIM_SECONDS * 2; t += 0.1) {
      const r = stepClaim(st, true, 0.1, 3);
      if (r.spawnWave) waves++;
      if (r.completed) done++;
    }
    expect(waves).toBe(3);
    expect(done).toBe(1);
    expect(st.done).toBe(true);
    expect(st.progress).toBe(1);
    expect(stepClaim(st, true, 5, 3)).toEqual({ spawnWave: false, completed: false });
  });

  it('leaving drains progress slowly and never below zero; waves are not re-sent', () => {
    const st = newClaim();
    for (let t = 0; t < CLAIM_SECONDS * 0.5; t += 0.1) stepClaim(st, true, 0.1, 3);
    const mid = st.progress;
    const sent = st.wavesSent;
    expect(mid).toBeGreaterThan(0.4);
    for (let t = 0; t < 10; t += 0.1) stepClaim(st, false, 0.1, 3);
    expect(st.progress).toBeLessThan(mid);
    expect(st.progress).toBeGreaterThan(0);
    for (let t = 0; t < 400; t += 0.1) stepClaim(st, false, 0.1, 3);
    expect(st.progress).toBe(0);
    expect(st.wavesSent).toBe(sent);
    let again = 0;
    for (let t = 0; t < CLAIM_SECONDS * 2; t += 0.1) if (stepClaim(st, true, 0.1, 3).spawnWave) again++;
    expect(st.wavesSent).toBe(3);
    expect(again).toBe(3 - sent);
  });
});

describe('gathering', () => {
  it('node ids are stable and yields respect their ranges', () => {
    expect(nodeId('oak', 100.4, 55.6)).toBe('oak:100,56');
    const r = seeded(3);
    for (let i = 0; i < 300; i++) for (const t of Object.keys(NODES)) {
      const y = rollYield(t, r);
      expect(y[0].resource).toBe(NODES[t].resource);
      expect(y[0].amount).toBeGreaterThanOrEqual(NODES[t].min);
      expect(y[0].amount).toBeLessThanOrEqual(NODES[t].max);
    }
    expect(rollYield('ore', r).map((y) => y.resource).sort()).toEqual(['iron', 'stone']);
    expect(isNode('oak')).toBe(true);
    expect(isNode('flowerbed')).toBe(false);
    expect(rollYield('flowerbed', r)).toEqual([]);
  });
});

describe('shops, inns and talk', () => {
  it('stock is deterministic per town and epoch, and rotates', () => {
    const a = stockFor(99, 4), b = stockFor(99, 4), c = stockFor(99, 5), d = stockFor(100, 4);
    expect(a).toEqual(b);
    expect(a).toHaveLength(SPELL_SLOTS + RUNE_SLOTS);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    expect(JSON.stringify(d)).not.toBe(JSON.stringify(a));
  });

  it('only sells real items, without duplicates inside one stock', () => {
    for (let town = 0; town < 40; town++) for (let epoch = 0; epoch < 5; epoch++) {
      const s = stockFor(town * 977, epoch, 10);
      const keys = new Set<string>();
      for (const it of s) {
        if (it.kind === 'spell') expect(TEMPLATES[it.tpl]).toBeTruthy(); else expect(RUNES[it.id]).toBeTruthy();
        expect(it.price).toBeGreaterThan(0);
        keys.add(it.kind + ('tpl' in it ? it.tpl : it.id));
      }
      expect(keys.size).toBe(s.length);
    }
  });

  it('prices grow with rarity and with the level of the town', () => {
    expect(runePrice('spark')).toBeGreaterThan(runePrice('swift'));
    expect(runePrice('swift', 60)).toBeGreaterThan(runePrice('swift', 1));
    expect(spellPrice('meteor')).toBeGreaterThan(0);
    expect(spellPrice('dash', 30)).toBeGreaterThan(spellPrice('dash', 1));
  });

  it('shops cost more than salvage pays (no gold loop)', async () => {
    const { runeValue } = await import('../src/core/loot/loot');
    for (const id of Object.keys(RUNES)) expect(runePrice(id)).toBeGreaterThan(runeValue(id));
  });

  it('inn cost grows with party level; rumours are stable', () => {
    expect(innCost(30)).toBeGreaterThan(innCost(2));
    expect(rumorFor(5)).toBe(rumorFor(5));
    expect(RUMORS.length).toBeGreaterThan(10);
    expect(rumorFor(123, 'east')).not.toContain('{dir}');
  });
});
