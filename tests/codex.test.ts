import { describe, expect, it } from 'vitest';
import { estimateDps } from '../src/core/spells/estimate';
import { DpsMeter } from '../src/core/spells/meter';
import { canSocket, makeSpell, previewRune, resolveSpell, RUNES } from '../src/core/spells/spells';
import { BESTIARY_ORDER, bestiaryEntry, discover, emptyCodex } from '../src/core/codex/codex';
import { HERO_DEFS, healerLine, healerQuote, newHero } from '../src/core/party/party';
import { ENEMY_TYPES } from '../src/core/config';

describe('damage estimate', () => {
  it('is zero for spells that deal no damage', () => {
    expect(estimateDps(resolveSpell(makeSpell('heal')), 5)).toBe(0);
  });
  it('never drops when more monsters stand together', () => {
    for (const tpl of ['bolt', 'nova', 'lightning', 'orbit', 'meteor', 'cloud', 'glaive', 'wisp']) {
      const r = resolveSpell(makeSpell(tpl, 3));
      expect(estimateDps(r, 5)).toBeGreaterThanOrEqual(estimateDps(r, 1));
    }
  });
  it('rises with a faster rune and with spell level', () => {
    const plain = makeSpell('bolt', 2);
    const swift = { ...plain, runes: plain.runes.map((r, i) => (i === 0 ? 'swift' : r)) };
    expect(estimateDps(resolveSpell(swift))).toBeGreaterThan(estimateDps(resolveSpell(plain)));
    expect(estimateDps(resolveSpell(makeSpell('bolt', 5)))).toBeGreaterThan(estimateDps(resolveSpell(makeSpell('bolt', 1))));
  });
  it('counts a wide area as hitting the whole group', () => {
    const r = resolveSpell(makeSpell('nova', 2));
    expect(estimateDps(r, 5)).toBeGreaterThanOrEqual(estimateDps(r, 1) * 4);
  });
});

describe('training dummy meter', () => {
  it('averages the damage over the window', () => {
    const m = new DpsMeter(5);
    for (let t = 0; t <= 5; t++) m.add(t, 10);
    expect(m.dps(5)).toBeCloseTo(60 / 5);
    expect(m.total).toBe(60);
  });
  it('drops hits older than the window and keeps the best rate', () => {
    const m = new DpsMeter(5);
    for (let t = 0; t < 4; t++) m.add(t, 100);
    const early = m.dps(4);
    expect(early).toBeGreaterThan(0);
    expect(m.dps(20)).toBe(0);
    expect(m.peak).toBeCloseTo(early);
  });
  it('counts a single burst over at least one second', () => {
    const m = new DpsMeter(5);
    m.add(10, 50);
    expect(m.dps(10)).toBe(50);
  });
  it('knows when it has gone idle, and resets', () => {
    const m = new DpsMeter(5);
    m.add(1, 5);
    expect(m.idle(3)).toBe(false);
    expect(m.idle(8)).toBe(true);
    m.reset();
    expect(m.total).toBe(0);
    expect(m.dps(1)).toBe(0);
    m.add(2, 0);
    expect(m.total).toBe(0);
  });
});

describe('Resonance rune', () => {
  it('fits auto-cast damage spells only', () => {
    expect(canSocket(makeSpell('bolt'), 'resonance', 0).ok).toBe(true);
    expect(canSocket(makeSpell('slam'), 'resonance', 0).ok).toBe(false);
    expect(canSocket(makeSpell('heal'), 'resonance', 0).ok).toBe(false);
  });
  it('casts the next spell on a kill', () => {
    expect(RUNES.resonance.trigger).toMatchObject({ on: 'kill', payload: 'cast' });
    expect(previewRune(makeSpell('bolt'), 'resonance', 0)).toContain('On kill: casts your next spell');
  });
});

describe('codex', () => {
  it('records each discovery once', () => {
    const cx = emptyCodex();
    expect(discover(cx.monsters, 'SLIME')).toBe(true);
    expect(discover(cx.monsters, 'SLIME')).toBe(false);
    expect(cx.monsters).toEqual(['SLIME']);
  });
  it('has a bestiary entry for every monster, warlords last', () => {
    expect(BESTIARY_ORDER.length).toBe(Object.keys(ENEMY_TYPES).length);
    for (const type of BESTIARY_ORDER) {
      const b = bestiaryEntry(type)!;
      expect(b.name).toBeTruthy();
      expect(b.behaviour.length).toBeGreaterThan(10);
    }
    const firstBoss = BESTIARY_ORDER.findIndex((t) => bestiaryEntry(t)!.boss);
    expect(firstBoss).toBeGreaterThan(0);
    expect(BESTIARY_ORDER.slice(firstBoss).every((t) => bestiaryEntry(t)!.boss)).toBe(true);
    expect(bestiaryEntry('NOPE')).toBeNull();
  });
});

describe('healer lines', () => {
  const hero = (over = {}) => ({ ...newHero(HERO_DEFS[0], [], [null, null, null]), ...over });
  it('speaks to the party as it is', () => {
    const well = [healerQuote(hero())];
    const hurt = [healerQuote(hero({ health: 10 }))];
    const fallen = [healerQuote(hero({ dead: true, health: 0 })), healerQuote(hero())];
    expect(healerLine(well, 0, 0)).toMatch(/whole|mend|hale/i);
    expect(healerLine(hurt, 9999, 0)).toMatch(/wound|skin|weary/i);
    expect(healerLine(fallen, 9999, 0)).toMatch(/fallen|back|far away/i);
    expect(healerLine(hurt, 0, 0)).toMatch(/gold|tithe|coin/i);
  });
  it('varies with the visit', () => {
    const well = [healerQuote(hero())];
    expect(new Set([0, 1, 2].map((n) => healerLine(well, 0, n))).size).toBe(3);
    expect(healerLine(well, 0, -1)).toBeTruthy();
  });
});

import { rollSkillDrop, TEMPLATES } from '../src/core/spells/spells';
import { dungeonAffinity, dungeonPower, LOOT_AFFINITY } from '../src/core/loot/loot';
import { makeRng } from '../src/core/world/noise';

describe('dungeon-weighted loot', () => {
  const schoolShare = (affinity: string[], school: string) => {
    const rand = makeRng(42);
    let spells = 0, hits = 0;
    for (let i = 0; i < 20000; i++) {
      const d = rollSkillDrop(rand, 1, affinity);
      if (d.kind === 'spell') { spells++; if (TEMPLATES[d.tpl].core === school) hits++; }
    }
    return hits / spells;
  };
  it('favours the schools of the dungeon\'s region', () => {
    expect(schoolShare(['fire'], 'fire')).toBeGreaterThan(schoolShare([], 'fire') * 1.8);
    expect(schoolShare(['frost', 'lightning'], 'frost')).toBeGreaterThan(schoolShare([], 'frost') * 1.5);
  });
  it('uses the realm for plateau and sea dungeons, the region otherwise', () => {
    expect(dungeonAffinity('desert', 'land')).toEqual(LOOT_AFFINITY.desert);
    expect(dungeonAffinity('mountain', 'plateau')).toEqual(LOOT_AFFINITY.plateau);
    expect(dungeonAffinity('shore', 'sea')).toEqual(LOOT_AFFINITY.sea);
    expect(dungeonAffinity('nowhere')).toEqual([]);
    for (const list of Object.values(LOOT_AFFINITY)) for (const s of list) expect(Object.values(TEMPLATES).some((t) => t.core === s), s).toBe(true);
  });
  it('gives rarer runes deeper down', () => {
    const rare = (bonus: number) => {
      const rand = makeRng(7); let r = 0, n = 0;
      for (let i = 0; i < 20000; i++) { const d = rollSkillDrop(rand, 1 + bonus); if (d.kind === 'rune') { n++; if (d.id === 'spark' || d.id === 'echo' || d.id === 'splinter' || d.id === 'resonance' || d.id === 'vampiric' || d.id === 'aftershock') r++; } }
      return r / n;
    };
    expect(dungeonPower(0)).toBe(0);
    expect(dungeonPower(3)).toBe(1.5);
    expect(rare(dungeonPower(3))).toBeGreaterThan(rare(0));
  });
});
