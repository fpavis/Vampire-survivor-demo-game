import { describe, expect, it } from 'vitest';
import { XP_LEVEL, simulateLevel, xpLevelFactor } from '../src/core/hero/progression';
import { CARDS, CARD_IDS, MASTERY_IDS, TOTAL_RANKS, computeStats, offerCards, ranksTaken, type Picks } from '../src/core/hero/stats';
import { cardDamageFactor, focusedPicks, partyPowerAt, soloFactor } from '../src/core/hero/powerCurve';
import { enemyHealthScale } from '../src/core/world/difficulty';
import { heroScaled, makeSpell, resolveSpell } from '../src/core/spells/spells';
import { rollKillLoot } from '../src/core/loot/loot';
import { HERO_SOFT_CAP } from '../src/core/config';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
// lands rising from level 1 to `top` over a run of `kills` kills (like walking outward from the start)
const ramp = (top: number, kills: number) => (k: number) => Math.max(1, Math.round(1 + (top - 1) * k / kills));

describe('experience relative to the hero\'s level', () => {
  it('gives full XP near the source\'s level, a catch-up bonus below it, and next to nothing far above it', () => {
    expect(xpLevelFactor(10)).toBe(1);
    expect(xpLevelFactor(10, null)).toBe(1);
    expect(xpLevelFactor(10, 10)).toBe(1);
    expect(xpLevelFactor(10 + XP_LEVEL.free, 10)).toBe(1);
    expect(xpLevelFactor(11 + XP_LEVEL.free, 10)).toBeCloseTo(XP_LEVEL.decay);
    expect(xpLevelFactor(5, 10)).toBeCloseTo(1.2);
    expect(xpLevelFactor(1, 90)).toBe(XP_LEVEL.catchUpMax);
    expect(xpLevelFactor(97, 29)).toBe(XP_LEVEL.floor);
  });

  it('never rises as the hero outgrows the source', () => {
    for (const src of [1, 7, 29, 60]) {
      let last = Infinity;
      for (let h = 1; h <= 120; h++) {
        const f = xpLevelFactor(h, src);
        expect(f).toBeLessThanOrEqual(last);
        expect(f).toBeGreaterThan(0);
        last = f;
      }
    }
  });

  it('reproduces the playtest under the old rule, and keeps the party near the land under the new one', () => {
    // 43 minutes, lands up to level 29: the old rule took the hero to about 97 and resting heroes past 60
    const kills = 3500, zone = ramp(29, kills);
    expect(simulateLevel({ kills, zone, growth: 1.3, relative: false })).toBeGreaterThanOrEqual(90);
    expect(simulateLevel({ kills, zone, share: 0.5, relative: false })).toBeGreaterThanOrEqual(60);
    const hero = simulateLevel({ kills, zone, growth: 1.3 });
    const bench = simulateLevel({ kills, zone, share: 0.5 });
    expect(hero).toBeGreaterThanOrEqual(30);
    expect(hero).toBeLessThanOrEqual(42);
    expect(bench).toBeGreaterThanOrEqual(28);
    expect(bench).toBeLessThanOrEqual(hero);
  });

  it('settles a few levels over the land however long the party grinds there', () => {
    const at = (kills: number) => simulateLevel({ kills, zone: 29, growth: 1.3 });
    expect(at(3000)).toBeLessThanOrEqual(45);
    expect(at(20000)).toBeLessThanOrEqual(29 + 25);         // six times the grind, a handful of levels more
  });

  it('lets a hero who comes late to a land catch up faster than before', () => {
    const fast = simulateLevel({ kills: 60, zone: 29 });
    const plain = simulateLevel({ kills: 60, zone: 29, relative: false });
    expect(fast).toBeGreaterThan(plain);
  });
});

describe('passive cards', () => {
  it('have small steps and enough ranks for every level to the soft cap', () => {
    expect(CARD_IDS).toHaveLength(16);
    expect(TOTAL_RANKS).toBe(160);
    expect(TOTAL_RANKS).toBeGreaterThanOrEqual(HERO_SOFT_CAP - 1);
    for (const id of CARD_IDS) expect(CARDS[id].max).toBe(10);
    expect(computeStats({ might: 1 }).might).toBeCloseTo(1.08);
  });

  it('offer mastery once the ordinary cards run out, so no level is ever wasted', () => {
    const full: Picks = Object.fromEntries(CARD_IDS.map((id) => [id, CARDS[id].max]));
    const rand = seeded(4);
    for (let i = 0; i < 50; i++) {
      const cards = offerCards(full, rand, 3);
      expect(cards).toHaveLength(3);
      for (const c of cards) expect(MASTERY_IDS).toContain(c.id);
    }
    const almost = { ...full, greed: 9 };
    const mix = offerCards(almost, rand, 3);
    expect(mix.map((c) => c.id)).toContain('greed');
    expect(mix.filter((c) => CARDS[c.id].mastery)).toHaveLength(2);
    // mastery has no cap: deep ranks still offer the next one
    const deep = { ...full, 'mastery-might': 40 };
    const again = offerCards(deep, () => 0, 3);
    expect(again.find((c) => c.id === 'mastery-might')?.toLevel).toBe(41);
    expect(computeStats(deep).might).toBeCloseTo(1 + 0.8 + 0.8);
    expect(ranksTaken(deep)).toBe(200);
  });

  it('never offers mastery while ordinary cards are plentiful', () => {
    const rand = seeded(8);
    for (let i = 0; i < 100; i++) for (const c of offerCards({ might: 3 }, rand, 3)) expect(CARDS[c.id].mastery).toBeFalsy();
  });

  it('Reach widens the spells that cover ground and Persistence lengthens the ones that linger', () => {
    const nova = resolveSpell(makeSpell('nova', 3));
    expect(heroScaled(nova, 1.5, 1.6).p.radius).toBeCloseTo(nova.p.radius * 1.5);
    const bolt = resolveSpell(makeSpell('bolt', 3));
    expect(heroScaled(bolt, 1.5, 1.6)).toBe(bolt);
    const cloud = resolveSpell(makeSpell('cloud', 2));
    expect(heroScaled(cloud, 1, 1.6).p.duration).toBeCloseTo(cloud.p.duration * 1.6);
    const dash = resolveSpell(makeSpell('dash', 2));
    expect(heroScaled(dash, 1.5, 1.6).p.duration).toBe(dash.p.duration);      // a dash is not a lingering effect
    expect(heroScaled(nova, 1, 1)).toBe(nova);
  });

  it('Fortune makes finds more likely', () => {
    const count = (luck: number) => {
      const rand = seeded(21);
      let gold = 0;
      for (let i = 0; i < 4000; i++) if (rollKillLoot(rand, { level: 10, luck }).gold) gold++;
      return gold;
    };
    expect(count(1.6)).toBeGreaterThan(count(1) * 1.4);
  });
});

describe('power curve', () => {
  it('cards add far less to the party than they did in the playtest', () => {
    const kills = 3500, zone = ramp(29, kills);
    const now = partyPowerAt(zone, kills);
    const before = partyPowerAt(zone, kills, false);
    expect(now.level).toBeLessThan(before.level / 2);
    expect(now.factor).toBeLessThan(before.factor * 0.9);
    expect(now.factor).toBeLessThanOrEqual(4.5);
  });

  it('a focused damage build grows in small steps and has a ceiling before mastery', () => {
    let last = soloFactor(1);
    for (let lv = 2; lv <= 32; lv++) {
      const f = soloFactor(lv);
      expect(f / last).toBeLessThan(1.12);           // no single level adds more than about a tenth
      last = f;
    }
    expect(soloFactor(99)).toBeCloseTo(soloFactor(31));
    expect(cardDamageFactor(computeStats(focusedPicks(30)))).toBeLessThan(3.8);
  });

  it('the lands outgrow the cards: further out, monsters gain health faster than the cards add damage', () => {
    let last = Infinity;
    for (const z of [5, 10, 20, 30, 45, 60]) {
      const kills = 120 * z;
      const ratio = partyPowerAt(ramp(z, kills), kills).factor / enemyHealthScale(z);
      expect(ratio).toBeLessThan(last);
      last = ratio;
    }
  });
});
